"""
Upscale Server - AI Image Upscaling (CPU Mode)
Uses super-image library with EDSR model
"""
import os
import sys
import io

# === MODELS DIRECTORY CONFIGURATION ===
# Store models in project's models/ folder instead of user's home directory
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(PROJECT_ROOT, "models", "huggingface")
os.makedirs(MODELS_DIR, exist_ok=True)

# Set HF_HOME to redirect HuggingFace/transformers cache to project folder
os.environ['HF_HOME'] = MODELS_DIR
os.environ['TRANSFORMERS_CACHE'] = MODELS_DIR
os.environ['HUGGINGFACE_HUB_CACHE'] = MODELS_DIR
# === END MODELS CONFIGURATION ===

# Force UTF-8 for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())

from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from PIL import Image
import numpy as np

# Force CPU mode
os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['ORT_DISABLE_ALL_CUDA'] = '1'

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

app = Flask(__name__)
CORS(app)

# Global models cache: {(model_name, scale): model_object}
models = {}

MODEL_MAPPING = {
    'edsr': 'eugenesiow/edsr-base',
    'msrn': 'eugenesiow/msrn',
    'pan': 'eugenesiow/pan',
    'drln': 'eugenesiow/drln'
}

def get_model(model_name='pan', scale=4):
    """Load super-image model based on name and scale"""
    global models
    
    # Normalize model name
    model_key = model_name.lower()
    if model_key not in MODEL_MAPPING:
        model_key = 'pan'
        
    cache_key = (model_key, scale)
    
    if cache_key not in models:
        try:
            from super_image import EdsrModel, MsrnModel, PanModel, DrlnModel
            
            pretrained_id = MODEL_MAPPING[model_key]
            print(f"Loading {model_key} model for x{scale}...")
            
            if model_key == 'edsr':
                from super_image import EdsrModel
                models[cache_key] = EdsrModel.from_pretrained(pretrained_id, scale=scale)
            elif model_key == 'msrn':
                from super_image import MsrnModel
                models[cache_key] = MsrnModel.from_pretrained(pretrained_id, scale=scale)
            elif model_key == 'pan':
                from super_image import PanModel
                models[cache_key] = PanModel.from_pretrained(pretrained_id, scale=scale)
            elif model_key == 'drln':
                from super_image import DrlnModel
                models[cache_key] = DrlnModel.from_pretrained(pretrained_id, scale=scale)
            
            print(f"Model {model_key} x{scale} loaded successfully!")
        except Exception as e:
            print(f"Error loading model {model_key} x{scale}: {e}")
            return None
            
    return models[cache_key]

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok', 
        'service': 'upscale',
        'device': 'cpu',
        'threads': torch.get_num_threads()
    })

@app.route('/info', methods=['GET'])
def get_info():
    return jsonify({
        'models': [
            {'id': 'pan', 'name': 'PAN (Pixel Attention)', 'description': 'Très rapide, idéal pour CPU (Fait par défaut)', 'speed': 'Rapide'},
            {'id': 'edsr', 'name': 'EDSR (Base)', 'description': 'Équilibré et robuste', 'speed': 'Médium'},
            {'id': 'msrn', 'name': 'MSRN', 'description': 'Multi-échelle, bons détails', 'speed': 'Médium'},
        ],
        'scales': [2, 3, 4]
    })

@app.route('/upscale', methods=['POST'])
def upscale_image():
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

    file = request.files['file']
    scale = int(request.form.get('scale', 4))
    model_name = request.form.get('model', 'pan')
    denoise = request.form.get('denoise', 'false').lower() == 'true'

    if file.filename == '':
        return jsonify({'error': 'Nom de fichier vide'}), 400

    mdl = get_model(model_name, scale)
    if mdl is None:
        # Fallback to PAN x4 if requested combination fails
        mdl = get_model('pan', 4)
        if mdl is None:
            return jsonify({'error': 'Modèle non disponible'}), 500

    import time
    start_time = time.time()
    
    try:
        from super_image import ImageLoader
        import cv2
        
        # Load image
        load_start = time.time()
        img = Image.open(file.stream).convert('RGB')
        w, h = img.size
        pixels = w * h
        print(f"🖼️ Image chargée: {w}x{h} ({pixels/1e6:.1f}MP) - Fichier: {file.filename}")
        
        if pixels > 12000000: # > 12MP is massive for CPU upscale
            print(f"⚠️ ATTENTION: Image très grande ({pixels/1e6:.1f}MP). Le traitement sur CPU sera TRÈS LENT.")
        
        load_end = time.time()
        
        # Apply denoising if requested (before upscaling to save time)
        if denoise:
            denoise_start = time.time()
            print("✨ Début du débruitage (Denoise)...")
            img_array = np.array(img)
            # Denoising on smaller image is much faster
            # Reduced searchWindowSize from 21 to 7 for massive CPU speedup
            denoised = cv2.fastNlMeansDenoisingColored(img_array, None, 10, 10, 7, 7)
            img = Image.fromarray(denoised)
            denoise_end = time.time()
            print(f"✨ Débruité en {denoise_end - denoise_start:.2f}s")
        
        # Prepare for model
        prep_start = time.time()
        inputs = ImageLoader.load_image(img)
        prep_end = time.time()
        
        # Run inference
        print(f"🚀 Début de l'agrandissement x{scale} avec {model_name}...")
        inf_start = time.time()
        with torch.no_grad():
            preds = mdl(inputs)
        inf_end = time.time()
        print(f"🚀 Agrandissement terminé en {inf_end - inf_start:.2f}s")
        
        # Convert tensor output to PIL Image
        save_start = time.time()
        output_tensor = preds.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu().numpy()
        output_array = (output_tensor * 255).astype(np.uint8)
        output_img = Image.fromarray(output_array)
        
        # Save to buffer
        output_buffer = io.BytesIO()
        output_img.save(output_buffer, format='PNG')
        output_buffer.seek(0)
        save_end = time.time()
        
        total_time = time.time() - start_time
        print(f"🏁 Traitement total: {total_time:.2f}s")
        
        return send_file(
            output_buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name=f"upscaled-{os.path.splitext(file.filename)[0]}.png"
        )

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Erreur de traitement: {str(e)}'}), 500

if __name__ == '__main__':
    print(f"AI Upscale Server starting on http://localhost:5300 (CPU Mode, {torch.get_num_threads()} threads)")
    # Pre-load only PAN model to be light and fast
    get_model('pan', 4)
    app.run(host='0.0.0.0', port=5300, debug=False)

