"""
EasyPay Kiosk - AI Face Recognition Service
Production-ready face recognition API with enrollment and verification
"""

import os
import json
import base64
import logging
from io import BytesIO
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import face_recognition
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
import redis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/ai_service.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Redis connection for caching face encodings
try:
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        password=os.getenv('REDIS_PASSWORD', ''),
        db=1,
        decode_responses=False
    )
    redis_client.ping()
    logger.info("Connected to Redis successfully")
except Exception as e:
    logger.warning(f"Redis connection failed: {e}. Face encodings won't be cached.")
    redis_client = None

# Configuration
FACE_DATA_DIR = os.getenv('FACE_DATA_DIR', '/app/face_data')
TOLERANCE = float(os.getenv('FACE_TOLERANCE', '0.6'))
MODEL = os.getenv('FACE_MODEL', 'large')  # 'large' or 'small'

os.makedirs(FACE_DATA_DIR, exist_ok=True)


def decode_image_from_base64(base64_string: str) -> np.ndarray:
    """
    Decode base64 image string to numpy array
    
    Args:
        base64_string: Base64 encoded image string
        
    Returns:
        numpy array of the image in RGB format
    """
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(base64_string)
        image = Image.open(BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        return np.array(image)
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        raise ValueError(f"Invalid image data: {e}")


def get_face_encoding(image: np.ndarray, num_jitters: int = 1) -> Optional[List[float]]:
    """
    Extract face encoding from image
    
    Args:
        image: Image as numpy array
        num_jitters: Number of times to re-sample for better accuracy
        
    Returns:
        128-dimensional face encoding or None if no face found
    """
    try:
        face_locations = face_recognition.face_locations(image, model=MODEL)
        
        if len(face_locations) == 0:
            logger.warning("No face detected in image")
            return None
        
        if len(face_locations) > 1:
            logger.warning(f"Multiple faces detected ({len(face_locations)}). Using the first one.")
        
        # Get encoding for the first face
        face_encodings = face_recognition.face_encodings(
            image, 
            face_locations, 
            num_jitters=num_jitters,
            model=MODEL
        )
        
        if len(face_encodings) == 0:
            return None
        
        return face_encodings[0].tolist()
    except Exception as e:
        logger.error(f"Error extracting face encoding: {e}")
        return None


def compare_faces(known_encoding: List[float], unknown_encoding: List[float]) -> Tuple[bool, float]:
    """
    Compare two face encodings
    
    Args:
        known_encoding: Known face encoding
        unknown_encoding: Unknown face encoding to verify
        
    Returns:
        Tuple of (is_match, distance)
    """
    try:
        known_array = np.array([known_encoding])
        unknown_array = np.array(unknown_encoding)
        
        # Calculate distance
        distance = face_recognition.face_distance(known_array, unknown_array)[0]
        
        # Check if match
        is_match = distance <= TOLERANCE
        
        return is_match, float(distance)
    except Exception as e:
        logger.error(f"Error comparing faces: {e}")
        return False, 1.0


def save_face_encoding(user_id: str, encoding: List[float]) -> bool:
    """
    Save face encoding to file and Redis cache
    
    Args:
        user_id: User identifier
        encoding: Face encoding to save
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Save to file
        file_path = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
        with open(file_path, 'w') as f:
            json.dump({
                'user_id': user_id,
                'encoding': encoding,
                'created_at': datetime.utcnow().isoformat(),
                'model': MODEL
            }, f)
        
        # Cache in Redis
        if redis_client:
            try:
                redis_client.setex(
                    f"face_encoding:{user_id}",
                    3600,  # 1 hour cache
                    json.dumps(encoding)
                )
            except Exception as e:
                logger.warning(f"Failed to cache encoding in Redis: {e}")
        
        logger.info(f"Face encoding saved for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving face encoding: {e}")
        return False


def load_face_encoding(user_id: str) -> Optional[List[float]]:
    """
    Load face encoding from Redis cache or file
    
    Args:
        user_id: User identifier
        
    Returns:
        Face encoding or None if not found
    """
    try:
        # Try Redis cache first
        if redis_client:
            try:
                cached = redis_client.get(f"face_encoding:{user_id}")
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis cache miss: {e}")
        
        # Load from file
        file_path = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
        if not os.path.exists(file_path):
            return None
        
        with open(file_path, 'r') as f:
            data = json.load(f)
            encoding = data.get('encoding')
            
            # Cache in Redis for next time
            if redis_client and encoding:
                try:
                    redis_client.setex(
                        f"face_encoding:{user_id}",
                        3600,
                        json.dumps(encoding)
                    )
                except Exception:
                    pass
            
            return encoding
    except Exception as e:
        logger.error(f"Error loading face encoding for user {user_id}: {e}")
        return None


# API Endpoints

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ai_face_recognition',
        'timestamp': datetime.utcnow().isoformat(),
        'redis_connected': redis_client is not None and redis_client.ping() if redis_client else False
    }), 200


@app.route('/api/face/enroll', methods=['POST'])
def enroll_face():
    """
    Enroll a new face for a user
    
    Request JSON:
    {
        "user_id": "uuid-string",
        "image": "base64-encoded-image"
    }
    
    Response JSON:
    {
        "success": true,
        "message": "Face enrolled successfully",
        "user_id": "uuid-string"
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'user_id' not in data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: user_id and image'
            }), 400
        
        user_id = data['user_id']
        image_base64 = data['image']
        
        # Decode image
        image = decode_image_from_base64(image_base64)
        
        # Extract face encoding (use more jitters for enrollment for better quality)
        encoding = get_face_encoding(image, num_jitters=2)
        
        if encoding is None:
            return jsonify({
                'success': False,
                'error': 'No face detected in the image. Please ensure your face is clearly visible.'
            }), 400
        
        # Save encoding
        if not save_face_encoding(user_id, encoding):
            return jsonify({
                'success': False,
                'error': 'Failed to save face encoding'
            }), 500
        
        logger.info(f"Face enrolled for user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Face enrolled successfully',
            'user_id': user_id
        }), 200
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error in enroll_face: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@app.route('/api/face/verify', methods=['POST'])
def verify_face():
    """
    Verify a face against enrolled face
    
    Request JSON:
    {
        "user_id": "uuid-string",
        "image": "base64-encoded-image"
    }
    
    Response JSON:
    {
        "success": true,
        "verified": true,
        "confidence": 0.95,
        "distance": 0.35
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'user_id' not in data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: user_id and image'
            }), 400
        
        user_id = data['user_id']
        image_base64 = data['image']
        
        # Load known encoding
        known_encoding = load_face_encoding(user_id)
        
        if known_encoding is None:
            return jsonify({
                'success': False,
                'error': 'No face enrolled for this user'
            }), 404
        
        # Decode image
        image = decode_image_from_base64(image_base64)
        
        # Extract face encoding from verification image
        unknown_encoding = get_face_encoding(image, num_jitters=1)
        
        if unknown_encoding is None:
            return jsonify({
                'success': False,
                'error': 'No face detected in the image'
            }), 400
        
        # Compare faces
        is_match, distance = compare_faces(known_encoding, unknown_encoding)
        
        # Calculate confidence score (inverse of distance, normalized)
        confidence = max(0.0, min(1.0, 1.0 - distance))
        
        logger.info(f"Face verification for user {user_id}: match={is_match}, distance={distance:.4f}")
        
        return jsonify({
            'success': True,
            'verified': is_match,
            'confidence': round(confidence, 4),
            'distance': round(distance, 4),
            'threshold': TOLERANCE
        }), 200
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error in verify_face: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@app.route('/api/face/delete/<user_id>', methods=['DELETE'])
def delete_face(user_id: str):
    """
    Delete enrolled face data for a user
    
    Response JSON:
    {
        "success": true,
        "message": "Face data deleted successfully"
    }
    """
    try:
        file_path = os.path.join(FACE_DATA_DIR, f"{user_id}.json")
        
        if os.path.exists(file_path):
            os.remove(file_path)
            
            # Remove from Redis cache
            if redis_client:
                try:
                    redis_client.delete(f"face_encoding:{user_id}")
                except Exception:
                    pass
            
            logger.info(f"Face data deleted for user {user_id}")
            
            return jsonify({
                'success': True,
                'message': 'Face data deleted successfully'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'No face data found for this user'
            }), 404
    
    except Exception as e:
        logger.error(f"Error deleting face data: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@app.route('/api/face/detect', methods=['POST'])
def detect_face():
    """
    Detect if an image contains a face (used for quality checks)
    
    Request JSON:
    {
        "image": "base64-encoded-image"
    }
    
    Response JSON:
    {
        "success": true,
        "face_detected": true,
        "face_count": 1,
        "face_locations": [[top, right, bottom, left]]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: image'
            }), 400
        
        image_base64 = data['image']
        
        # Decode image
        image = decode_image_from_base64(image_base64)
        
        # Detect faces
        face_locations = face_recognition.face_locations(image, model=MODEL)
        
        return jsonify({
            'success': True,
            'face_detected': len(face_locations) > 0,
            'face_count': len(face_locations),
            'face_locations': face_locations
        }), 200
    
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Error in detect_face: {e}")
        return jsonify({
            'success': False,
            'error': 'Internal server error'
        }), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting AI Face Recognition Service on port {port}")
    logger.info(f"Face recognition model: {MODEL}")
    logger.info(f"Face match tolerance: {TOLERANCE}")
    
    # Create logs directory
    os.makedirs('logs', exist_ok=True)
    
    if debug:
        app.run(host='0.0.0.0', port=port, debug=True)
    else:
        # Use gunicorn in production
        from gunicorn.app.base import BaseApplication
        
        class StandaloneApplication(BaseApplication):
            def __init__(self, app, options=None):
                self.options = options or {}
                self.application = app
                super().__init__()
            
            def load_config(self):
                for key, value in self.options.items():
                    self.cfg.set(key.lower(), value)
            
            def load(self):
                return self.application
        
        options = {
            'bind': f'0.0.0.0:{port}',
            'workers': 2,
            'worker_class': 'sync',
            'timeout': 120,
            'accesslog': 'logs/access.log',
            'errorlog': 'logs/error.log',
            'loglevel': 'info'
        }
        
        StandaloneApplication(app, options).run()
