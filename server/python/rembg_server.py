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
# if sys.platform == 'win32':
#     import codecs
#     sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
#     sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

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

# Global sessions cache
sessions = {}


def get_session(model_name):
    if model_name not in sessions:
        print(f"Initialisation de la session pour le modele: {model_name}...")
        sessions[model_name] = new_session(model_name, providers=["CPUExecutionProvider"])
    return sessions[model_name]


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
    model_name = request.form.get('model', 'u2net')
    
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
        print(f"Traitement de {file.filename} avec le modele {model_name} sur CPU...")
        
        # Use specific model session
        session = get_session(model_name)
        output_data = remove(input_data, session=session)
        
        output_buffer = io.BytesIO(output_data)
        output_buffer.seek(0)
        
        print(f"Arriere-plan supprime avec {model_name}!")
        
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
        'status': 'ready',
        'available_models': [
            {'id': 'u2net', 'name': 'U2NET', 'description': 'Equilibre (Par defaut)', 'efficiency': 'Medium', 'power': 'Medium'},
            {'id': 'u2netp', 'name': 'U2NETP', 'description': 'Tres rapide, moins de ram', 'efficiency': 'High', 'power': 'Low'},
            {'id': 'u2net_human_seg', 'name': 'Human Seg', 'description': 'Specialise pour les humains', 'efficiency': 'Medium', 'power': 'Medium'},
            {'id': 'isnet-general-use', 'name': 'ISNET General', 'description': 'Haute precision, plus lourd', 'efficiency': 'Low', 'power': 'High'},
            {'id': 'silueta', 'name': 'Silueta', 'description': 'Rapide pour les silhouettes', 'efficiency': 'High', 'power': 'Low'}
        ]
    })


if __name__ == '__main__':
    print("REMBG Server (CPU) starting on http://localhost:5100")
    app.run(host='0.0.0.0', port=5100, debug=False)
