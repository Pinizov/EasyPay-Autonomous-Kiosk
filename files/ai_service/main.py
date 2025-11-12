from flask import Flask, request, jsonify
import face_recognition
import numpy as np
app = Flask(__name__)

def get_embedding(img_b64):
    # Decode base64 and get face embedding
    import base64, io
    from PIL import Image
    arr = face_recognition.load_image_file(io.BytesIO(base64.b64decode(img_b64)))
    enc = face_recognition.face_encodings(arr)
    return enc[0].tolist() if enc else [0]*128

@app.route('/api/face/embed', methods=['POST'])
def embed():
    image = request.json['image']
    embedding = get_embedding(image)
    return jsonify({'embedding': embedding})

@app.route('/api/face/verify', methods=['POST'])
def verify():
    image = request.json['image']
    known = np.array(request.json['known_embedding'], dtype=float)
    embedding = get_embedding(image)
    similarity = np.dot(known, embedding) / (np.linalg.norm(known) * np.linalg.norm(embedding))
    return jsonify({'verified': similarity > 0.6, 'score': float(similarity)})

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)