"""
Upscale Server - AI Image Upscaling (CPU Mode)
Uses super-image library with EDSR model
"""
import os
import sys
import io

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
# Optimize CPU threads
num_cores = os.cpu_count() or 4
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

def get_model(model_name='edsr', scale=4):
    """Load super-image model based on name and scale"""
    global models
    
    # Normalize model name
    model_key = model_name.lower()
    if model_key not in MODEL_MAPPING:
        model_key = 'edsr'
        
    cache_key = (model_key, scale)
    
    if cache_key not in models:
        try:
            from super_image import EdsrModel, MsrnModel, PanModel, DrlnModel
            
            pretrained_id = MODEL_MAPPING[model_key]
            print(f"Loading {model_key} model for x{scale}...")
            
            if model_key == 'edsr':
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
            {'id': 'edsr', 'name': 'EDSR (Base)', 'description': 'Équilibré et robuste', 'speed': 'Médium'},
            {'id': 'pan', 'name': 'PAN (Pixel Attention)', 'description': 'Très rapide, idéal pour CPU', 'speed': 'Rapide'},
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
    model_name = request.form.get('model', 'edsr')
    denoise = request.form.get('denoise', 'false').lower() == 'true'

    if file.filename == '':
        return jsonify({'error': 'Nom de fichier vide'}), 400

    mdl = get_model(model_name, scale)
    if mdl is None:
        # Fallback to EDSR x4 if requested combination fails
        mdl = get_model('edsr', 4)
        if mdl is None:
            return jsonify({'error': 'Modèle non disponible'}), 500

    try:
        from super_image import ImageLoader
        import cv2
        
        # Load image
        img = Image.open(file.stream).convert('RGB')
        
        # Apply denoising if requested (before upscaling to save time)
        if denoise:
            img_array = np.array(img)
            # Denoising on smaller image is much faster
            denoised = cv2.fastNlMeansDenoisingColored(img_array, None, 10, 10, 7, 21)
            img = Image.fromarray(denoised)
        
        # Prepare for model
        inputs = ImageLoader.load_image(img)
        
        # Run inference
        with torch.no_grad():
            preds = mdl(inputs)
        
        # Convert tensor output to PIL Image
        output_tensor = preds.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu().numpy()
        output_array = (output_tensor * 255).astype(np.uint8)
        output_img = Image.fromarray(output_array)
        
        # Save to buffer
        output_buffer = io.BytesIO()
        output_img.save(output_buffer, format='PNG')
        output_buffer.seek(0)
        
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
    # Pre-load default model
    get_model('edsr', 4)
    app.run(host='0.0.0.0', port=5300, debug=False)

