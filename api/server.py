from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import ConnectionError
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB setup with error handling
try:
    MONGO_URI = os.getenv('MONGODB_URI')
    if not MONGO_URI:
        raise ValueError("MONGODB_URI environment variable not set")
    
    client = MongoClient(MONGO_URI)
    # Test connection
    client.admin.command('ping')
    db = client.wormgpt
    keys_collection = db.keys
    print("Successfully connected to MongoDB")
except Exception as e:
    print(f"MongoDB connection error: {str(e)}")
    raise

@app.route('/')
def index():
    return jsonify({
        'status': 'alive',
        'message': 'WormGPT API Server is running'
    })

@app.route('/validate-key', methods=['POST'])
def validate_key():
    try:
        data = request.json
        key = data.get('key', '').upper()
        
        # Add logging
        print(f"Validating key: {key}")
        
        key_data = keys_collection.find_one({'key': key})
        print(f"Found key data: {key_data}")
        
        if not key_data:
            return jsonify({
                'valid': False,
                'message': 'Invalid key'
            })

        key_data['_id'] = str(key_data['_id'])
        return jsonify({
            'valid': True,
            'key': key_data['key'],
            'expiryTime': key_data['expiry_time'],
            'message': 'Key validated successfully'
        })

    except Exception as e:
        print(f"Validation error: {str(e)}")
        return jsonify({
            'valid': False,
            'message': 'Server error'
        })

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'alive'})

# Update port configuration
port = int(os.environ.get("PORT", 8080))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port)
