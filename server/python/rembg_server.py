"""
REMBG Server - Background Removal API (CPU Mode)
"""
import os
# Force CPU mode - disable CUDA before importing anything else
os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['ORT_DISABLE_ALL_CUDA'] = '1'

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import sys
import io

# Force UTF-8 for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

try:
    from rembg import remove, new_session
    from PIL import Image
except ImportError as e:
    print(f"Erreur import: {e}")
    print("Installez: pip install rembg flask flask-cors pillow")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

MAX_SIZE_MB = 10
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'}

# Create session with CPU provider only
session = new_session("u2net", providers=["CPUExecutionProvider"])


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'rembg'})


@app.route('/remove', methods=['POST'])
def remove_background():
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Nom de fichier vide'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Extension non autorisee'}), 400

    file.seek(0, os.SEEK_END)
    size_mb = file.tell() / (1024 * 1024)
    file.seek(0)
    
    if size_mb > MAX_SIZE_MB:
        return jsonify({'error': f'Fichier trop volumineux ({size_mb:.1f}MB)'}), 400

    try:
        input_data = file.read()
        print(f"Traitement de {file.filename} ({size_mb:.2f}MB) sur CPU...")
        
        # Use CPU session
        output_data = remove(input_data, session=session)
        
        output_buffer = io.BytesIO(output_data)
        output_buffer.seek(0)
        
        print("Arriere-plan supprime!")
        
        return send_file(
            output_buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name=f"nobg-{os.path.splitext(file.filename)[0]}.png"
        )

    except Exception as e:
        print(f"Erreur: {str(e)}")
        return jsonify({'error': f'Erreur de traitement: {str(e)}'}), 500


@app.route('/info', methods=['GET'])
def get_info():
    return jsonify({
        'service': 'REMBG Background Remover (CPU)',
        'max_size_mb': MAX_SIZE_MB,
        'allowed_extensions': list(ALLOWED_EXTENSIONS),
        'status': 'ready'
    })


if __name__ == '__main__':
    print("REMBG Server (CPU) starting on http://localhost:5100")
    app.run(host='0.0.0.0', port=5100, debug=False)
