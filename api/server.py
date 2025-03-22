from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from pymongo import MongoClient
from pymongo.errors import PyMongoError
import datetime
import os
import signal
import sys
from dotenv import load_dotenv
import logging
import re
from functools import wraps
import hmac
import hashlib  # Add hashlib import
import requests
import threading
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
)

load_dotenv()

# Update the configuration section at the top
MONGODB_URI = "mongodb+srv://wormgpt_admin:iwontgiveup@cluster0.o6pjf.mongodb.net/wormgpt?retryWrites=true&w=majority&appName=Cluster0"
SECRET_KEY = "wormgpt_secret_key_2024"  # Hardcoded secret key
PORT = int(os.environ.get('PORT', 10000))
BASE_URL = "https://wormgpt-api.onrender.com"  # Use the actual render URL

app = Flask(__name__)
CORS(app)

def setup_mongodb():
    try:
        client = MongoClient(MONGODB_URI, 
                           serverSelectionTimeoutMS=5000,
                           connectTimeoutMS=5000,
                           socketTimeoutMS=5000)
        client.admin.command('ping')
        db = client.wormgpt
        keys_collection = db.keys
        logging.info("Successfully connected to MongoDB")
        return client, db, keys_collection
    except PyMongoError as e:
        logging.error(f"MongoDB connection error: {str(e)}")
        raise

# Initialize MongoDB connection
client, db, keys_collection = setup_mongodb()

# Signal handlers for graceful shutdown
def signal_handler(signum, frame):
    logging.info(f"Signal {signum} received. Starting graceful shutdown...")
    try:
        client.close()
        logging.info("MongoDB connection closed")
    except Exception as e:
        logging.error(f"Error during shutdown: {str(e)}")
    sys.exit(0)

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

@app.route('/')
def index():
    return jsonify({
        'status': 'alive',
        'message': 'WormGPT API Server is running'
    })

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or not verify_api_key(api_key):
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

def verify_api_key(api_key):
    expected = hmac.new(
        SECRET_KEY.encode(),
        msg=b'wormgpt_api',
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(api_key, expected)

@app.route('/validate-key', methods=['POST', 'OPTIONS'])
@cross_origin(
    allow_headers=['Content-Type', 'X-API-Key'],
    methods=['POST', 'OPTIONS']
)
@require_api_key
def validate_key():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.json
        key = data.get('key', '').upper()
        
        if not key or not re.match(r'^WR-[A-Z0-9]{10}$', key):
            return jsonify({
                'valid': False,
                'message': 'Invalid key format'
            })
        
        logging.info(f"Validating key: {key}")
        
        key_data = keys_collection.find_one({'key': key})
        logging.info(f"Found key data: {key_data}")
        
        if not key_data:
            return jsonify({
                'valid': False,
                'message': 'Invalid or unknown key'
            })

        # Format expiry time properly
        expiry_time = key_data.get('expiry_time')
        if not expiry_time:
            return jsonify({
                'valid': False,
                'message': 'Invalid key data'
            })

        if datetime.datetime.now() > expiry_time:
            return jsonify({
                'valid': False,
                'message': 'Key has expired'
            })

        # Convert expiry_time to ISO format string
        formatted_expiry = expiry_time.isoformat()

        # Remove MongoDB _id and convert expiry_time to string
        key_data = {
            'valid': True,
            'key': key_data['key'],
            'expiryTime': formatted_expiry,
            'type': key_data.get('type', 'trial'),
            'message': 'Key validated successfully',
            'usage_count': key_data.get('usage_count', 0),
            'max_uses': key_data.get('max_uses', 1)
        }

        return jsonify(key_data)

    except Exception as e:
        logging.error(f"Validation error: {str(e)}")
        return jsonify({
            'valid': False,
            'message': 'Server error'
        })

# Update keep-alive configuration
KEEP_ALIVE_URL = f"{BASE_URL}/health"
KEEP_ALIVE_INTERVAL = 60  # 1 minute interval

def keep_alive():
    """Send periodic requests to keep the server alive"""
    while True:
        try:
            # Add headers and increase timeout
            headers = {'User-Agent': 'WormGPT-KeepAlive/1.0'}
            response = requests.get(
                KEEP_ALIVE_URL, 
                timeout=10,
                headers=headers,
                verify=True  # Ensure SSL verification
            )
            if response.status_code == 200:
                logging.info(f"Keep-alive ping successful: {response.status_code}")
            else:
                logging.warning(f"Keep-alive ping returned status: {response.status_code}")
        except Exception as e:
            logging.error(f"Keep-alive error: {str(e)}")
        time.sleep(KEEP_ALIVE_INTERVAL)

# Start keep-alive thread after MongoDB setup
def start_keep_alive():
    keep_alive_thread = threading.Thread(target=keep_alive, daemon=True)
    keep_alive_thread.start()
    logging.info("Keep-alive service started")

# Add health check endpoint with detailed status
@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Test MongoDB connection
        client.admin.command('ping')
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'timestamp': datetime.datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    try:
        logging.info(f"Starting server on port {PORT}")
        
        # Start keep-alive service
        start_keep_alive()
        
        app.run(
            host='0.0.0.0', 
            port=PORT,
            use_reloader=False,  # Disable reloader to prevent duplicate threads
            threaded=True
        )
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        client.close()
        sys.exit(1)
else:
    # In production (Gunicorn)
    keep_alive_thread = threading.Thread(target=keep_alive, daemon=True)
    keep_alive_thread.start()
