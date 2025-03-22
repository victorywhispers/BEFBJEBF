from flask import Flask, request, jsonify
from flask_cors import CORS
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
)

load_dotenv()

# Get SECRET_KEY from environment or use default
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')

app = Flask(__name__)
CORS(app)

def setup_mongodb():
    try:
        MONGO_URI = os.getenv('MONGODB_URI')
        if not MONGO_URI:
            MONGO_URI = "mongodb+srv://wormgpt_admin:iwontgiveup@cluster0.o6pjf.mongodb.net/wormgpt?retryWrites=true&w=majority&appName=Cluster0"
        
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        # Test connection
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

@app.route('/validate-key', methods=['POST'])
@require_api_key
def validate_key():
    try:
        data = request.json
        key = data.get('key', '').upper()
        
        if not key or not re.match(r'^WR-[A-Z0-9]{10}$', key):
            return jsonify({
                'valid': False,
                'message': 'Invalid key format'
            })
        
        # Add logging
        logging.info(f"Validating key: {key}")
        
        key_data = keys_collection.find_one({'key': key})
        logging.info(f"Found key data: {key_data}")
        
        if not key_data:
            return jsonify({
                'valid': False,
                'message': 'Invalid or unknown key'
            })

        # Check if key is expired
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

        # Check if key has been revoked
        if key_data.get('revoked', False):
            return jsonify({
                'valid': False,
                'message': 'Key has been revoked'
            })

        # Check usage limit for trial keys
        if key_data.get('type') == 'trial':
            usage_count = key_data.get('usage_count', 0)
            max_uses = key_data.get('max_uses', 1)
            if usage_count >= max_uses:
                return jsonify({
                    'valid': False,
                    'message': 'Key usage limit exceeded'
                })
            
            # Increment usage count
            keys_collection.update_one(
                {'key': key},
                {'$inc': {'usage_count': 1}}
            )

        key_data['_id'] = str(key_data['_id'])
        return jsonify({
            'valid': True,
            'key': key_data['key'],
            'expiryTime': key_data['expiry_time'],
            'type': key_data.get('type', 'trial'),
            'message': 'Key validated successfully'
        })

    except Exception as e:
        logging.error(f"Validation error: {str(e)}")
        return jsonify({
            'valid': False,
            'message': 'Server error'
        })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'alive'})

if __name__ == '__main__':
    try:
        port = int(os.environ.get("PORT", 8080))
        logging.info(f"Starting server on port {port}")
        app.run(
            host='0.0.0.0', 
            port=port,
            use_reloader=True,  # Enable auto-reload
            threaded=True       # Enable threading
        )
    except Exception as e:
        logging.error(f"Server error: {str(e)}")
        client.close()
        sys.exit(1)
