from flask import Flask, request, jsonify, render_template, session, send_from_directory, make_response
from flask_cors import CORS
from agents.qube_agent import QubeAgent
import os
import json
import logging
import sys
from PIL import Image
import io
from datetime import datetime
import base64
from cryptography.fernet import Fernet

# Configure logging
log_directory = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_directory, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(log_directory, 'app.log')),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://qubeagent.iqube-staging.surge.sh", "http://localhost:5000"]}})
app.secret_key = os.urandom(24)  # for session management

# Initialize QubeAgent
qube_agent = QubeAgent()

# Mock encryption key - in production this would be securely managed
MOCK_KEY = Fernet.generate_key()
fernet = Fernet(MOCK_KEY)

def get_mock_tokeqube_data(tokeqube_id):
    """Get mock TokenQube data that mimics blockchain structure."""
    return {
        "metaQube": {
            "iQubeIdentifier": f"iQube-{tokeqube_id}",
            "iQubeCreator": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
            "ownerType": "Individual",
            "iQubeContentType": "Personal",
            "ownerIdentifiability": "Identifiable",
            "transactionDate": datetime.now().isoformat(),
            "sensitivityScore": 8,
            "verifiabilityScore": 9,
            "accuracyScore": 7,
            "riskScore": 3,
            "trustScore": 8
        },
        "blakQube": {
            "firstName": "ENC[AES256-GCM,data:VGhpcyBpcyBlbmNyeXB0ZWQgZmlyc3QgbmFtZQ==]",
            "lastName": "ENC[AES256-GCM,data:VGhpcyBpcyBlbmNyeXB0ZWQgbGFzdCBuYW1l]",
            "email": "ENC[AES256-GCM,data:dGhpc0BleGFtcGxlLmNvbQ==]",
            "phoneNumber": "ENC[AES256-GCM,data:KzEtMjM0LTU2Ny04OTAw]",
            "address": "ENC[AES256-GCM,data:MTIzIE1haW4gU3RyZWV0LCBDaXR5LCBDb3VudHJ5]",
            "metaiyeShares": "ENC[AES256-GCM,data:MTAwMA==]",
            "kyntCoinOwned": "ENC[AES256-GCM,data:NTAw]",
            "omMemberSince": "ENC[AES256-GCM,data:MjAyMi0wMS0wMQ==]",
            "omTierStatus": "ENC[AES256-GCM,data:R29sZA==]",
            "evmPublicKey": "ENC[AES256-GCM,data:MHg3MjM0NTY3ODkw]"
        }
    }

def decrypt_data(encrypted_data):
    """Decrypt the encrypted data string."""
    try:
        # Remove the ENC prefix and extract the base64 data
        if encrypted_data.startswith("ENC[AES256-GCM,data:"):
            # Extract the base64 part
            base64_data = encrypted_data[encrypted_data.index("data:") + 5:encrypted_data.index("]")]
            # For mock purposes, just decode the base64 data
            return base64.b64decode(base64_data).decode()
    except Exception as e:
        logger.error(f"Decryption error: {str(e)}")
        return None

@app.route('/')
def index():
    """Main dashboard route"""
    return render_template('index.html')

@app.route('/connect_wallet', methods=['POST'])
def connect_wallet():
    """Connect to user's Ethereum wallet."""
    try:
        data = request.json
        wallet_address = data.get('address')
        
        if not wallet_address:
            raise ValueError("No wallet address provided")
        
        # Store the connected wallet address in session
        session['wallet_address'] = wallet_address
        
        return jsonify({
            "status": "success",
            "message": "Wallet connected successfully",
            "address": wallet_address
        })
        
    except Exception as e:
        logger.error(f"Error connecting wallet: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/retrieve_tokeqube/<tokeqube_id>')
def retrieve_tokeqube(tokeqube_id):
    """Retrieve TokenQube data."""
    try:
        # Get mock data for now
        tokeqube_data = get_mock_tokeqube_data(tokeqube_id)
        return jsonify(tokeqube_data)
    except Exception as e:
        logger.error(f"Error retrieving TokenQube {tokeqube_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/share_iqube', methods=['POST'])
def share_iqube():
    """Share iQube with QubeAgent by decrypting BlakQube data."""
    try:
        data = request.json
        tokeqube_id = data.get('tokenQubeId')
        iqube_type = data.get('iQubeType')
        
        # Get the TokenQube data
        tokeqube_data = get_mock_tokeqube_data(tokeqube_id)
        
        # Get BlakQube data
        blakqube_data = tokeqube_data.get('blakQube', {})
        
        # Decrypt each field
        decrypted_data = {}
        for key, value in blakqube_data.items():
            decrypted_value = decrypt_data(value)
            if decrypted_value:
                decrypted_data[key] = decrypted_value
        
        # Store decrypted data in agent's context
        agent_context = {
            'iQubeType': iqube_type,
            'tokenQubeId': tokeqube_id,
            'decryptedData': decrypted_data
        }
        
        # Update agent's context
        update_agent_context(agent_context)
        
        return jsonify({
            'status': 'success',
            'message': 'iQube shared successfully with QubeAgent',
            'decryptedData': decrypted_data
        })
        
    except Exception as e:
        logger.error(f"Error sharing iQube: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

def update_agent_context(context_data):
    """Update QubeAgent's context with new data."""
    try:
        # Here you would update your agent's context
        # For now, we'll just log it
        logger.info(f"Updating agent context with: {context_data}")
        return True
    except Exception as e:
        logger.error(f"Error updating agent context: {str(e)}")
        return False

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
