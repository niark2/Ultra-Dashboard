"""
Whisper STT Server - Speech-to-Text API
"""
import os

# === MODELS DIRECTORY CONFIGURATION ===
# Store models in project's models/ folder instead of user's home directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(PROJECT_ROOT, "models", "whisper")
os.makedirs(MODELS_DIR, exist_ok=True)

# Set XDG_CACHE_HOME to redirect whisper cache to project folder
os.environ['XDG_CACHE_HOME'] = os.path.dirname(MODELS_DIR)
# === END MODELS CONFIGURATION ===

os.environ['CUDA_VISIBLE_DEVICES'] = ''

from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import sys
import tempfile
import codecs

# Force UTF-8 for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

# Add FFmpeg to PATH - Dynamic Search
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
USER_HOME = os.path.expanduser("~")

def find_ffmpeg():
    """Dynamically find ffmpeg in common locations including WinGet packages"""
    search_locations = [
        PROJECT_ROOT,
        os.path.join(PROJECT_ROOT, "server", "python"),
        os.path.join(USER_HOME, r"AppData\Local\Microsoft\WinGet\Packages"),
        r"C:\Program Files\ffmpeg\bin",
        r"C:\ffmpeg\bin"
    ]

    print("🔎 Whisper: Recherche de FFmpeg...")
    
    # Check explicitly defined locations first
    for loc in search_locations:
        if not os.path.exists(loc):
            continue
            
        # Recursive search in these locations (useful for WinGet UUID folders)
        for root, dirs, files in os.walk(loc):
            if "ffmpeg.exe" in files:
                ffmpeg_path = os.path.join(root, "ffmpeg.exe")
                print(f"✅ FFmpeg trouvé: {ffmpeg_path}")
                return os.path.dirname(ffmpeg_path)
                
    return None

ffmpeg_dir = find_ffmpeg()
if ffmpeg_dir:
    if ffmpeg_dir not in os.environ['PATH']:
        os.environ['PATH'] = ffmpeg_dir + os.pathsep + os.environ['PATH']
        print(f"➕ Ajouté au PATH: {ffmpeg_dir}")
else:
    print("⚠️ FFmpeg non trouvé automatiquement. Assurez-vous qu'il est installé.")

try:
    import whisper
except ImportError as e:
    print(f"Erreur import: {e}")
    print("Installez: pip install openai-whisper flask flask-cors")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

MAX_SIZE_MB = 500
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm', 'mp4', 'mpeg', 'mpga'}

# Available Whisper models
AVAILABLE_MODELS = {
    'tiny': 'Tiny (~1GB RAM, très rapide, précision basse)',
    'base': 'Base (~1GB RAM, rapide, précision correcte)',
    'small': 'Small (~2GB RAM, équilibré)',
    'medium': 'Medium (~5GB RAM, bonne précision)',
    'large': 'Large (~10GB RAM, meilleure précision)'
}

# Cache for loaded models
loaded_models = {}


def get_model(model_name):
    """Load and cache Whisper model"""
    if model_name not in AVAILABLE_MODELS:
        model_name = 'base'
    
    if model_name not in loaded_models:
        print(f"Chargement du modèle Whisper '{model_name}'...")
        loaded_models[model_name] = whisper.load_model(model_name)
        print(f"Modèle '{model_name}' chargé!")
    
    return loaded_models[model_name]


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'whisper-stt'})


@app.route('/models', methods=['GET'])
def get_models():
    return jsonify({
        'models': [
            {'id': key, 'name': key.capitalize(), 'description': value}
            for key, value in AVAILABLE_MODELS.items()
        ],
        'default': 'base'
    })


@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    tmp_path = None
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Aucun fichier fourni'}), 400

        file = request.files['file']
        model_name = request.form.get('model', 'base')
        language = request.form.get('language', None)

        if file.filename == '':
            return jsonify({'error': 'Nom de fichier vide'}), 400

        if not allowed_file(file.filename):
            return jsonify({'error': 'Extension non autorisee'}), 400

        file.seek(0, os.SEEK_END)
        size_mb = file.tell() / (1024 * 1024)
        file.seek(0)

        if size_mb > MAX_SIZE_MB:
            return jsonify({'error': f'Fichier trop volumineux ({size_mb:.1f}MB)'}), 400

        # Save to temp file
        ext = file.filename.rsplit('.', 1)[1].lower()
        with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name

        print(f"Transcription de {file.filename} ({size_mb:.2f}MB) avec modele '{model_name}'...")

        # Load model and transcribe
        model = get_model(model_name)
        
        # Transcribe options
        options = {
            'fp16': False  # Force FP32 on CPU
        }
        if language:
            options['language'] = language

        result = model.transcribe(tmp_path, **options)

        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

        print("Transcription terminee!")

        return jsonify({
            'success': True,
            'text': result['text'],
            'language': result.get('language', 'unknown')
        })

    except Exception as e:
        # Avoid UnicodeEncodeError on Windows print
        error_msg = str(e)
        print(f"Erreur STT: {error_msg[:200]}...")
        
        # Clean up temp file on error
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass
                
        return jsonify({'error': f'Erreur de transcription: {error_msg}'}), 500


@app.route('/info', methods=['GET'])
def get_info():
    return jsonify({
        'service': 'Whisper Speech-to-Text',
        'max_size_mb': MAX_SIZE_MB,
        'allowed_extensions': list(ALLOWED_EXTENSIONS),
        'available_models': list(AVAILABLE_MODELS.keys()),
        'status': 'ready'
    })


import torch
# Optimize CPU threads - allow override via env
num_cores = os.cpu_count() or 4
env_threads = os.environ.get('AI_THREADS')
if env_threads:
    try:
        torch.set_num_threads(int(env_threads))
        print(f"🧵 Thread count set from AI_THREADS: {env_threads}")
    except ValueError:
        torch.set_num_threads(num_cores)
else:
    torch.set_num_threads(num_cores)

if __name__ == '__main__':
    print("Whisper STT Server starting on http://localhost:5200")
    # Pre-load default model
    get_model('base')
    app.run(host='0.0.0.0', port=5200, debug=False)
