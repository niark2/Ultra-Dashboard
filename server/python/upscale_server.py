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

app = Flask(__name__)
CORS(app)

# Global model reference
model = None
model_loaded = False

def get_model():
    """Load super-image model on first use"""
    global model, model_loaded
    if model is None and not model_loaded:
        try:
            from super_image import EdsrModel, ImageLoader
            print("Loading EDSR x4 model...")
            model = EdsrModel.from_pretrained('eugenesiow/edsr-base', scale=4)
            model_loaded = True
            print("Model loaded successfully!")
        except ImportError:
            print("super-image not installed. Run: pip install super-image")
            model_loaded = True  # Mark as tried
        except Exception as e:
            print(f"Error loading model: {e}")
            model_loaded = True
    return model

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'service': 'upscale'})

@app.route('/upscale', methods=['POST'])
def upscale_image():
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

    file = request.files['file']
    scale = int(request.form.get('scale', 4))
    denoise = request.form.get('denoise', 'false').lower() == 'true'

    if file.filename == '':
        return jsonify({'error': 'Nom de fichier vide'}), 400

    mdl = get_model()
    if mdl is None:
        return jsonify({'error': 'Modele non disponible. Installez super-image: pip install super-image'}), 500

    try:
        from super_image import ImageLoader
        import cv2
        
        # Load image
        img = Image.open(file.stream).convert('RGB')
        print(f"Upscaling {file.filename} (x{scale}, denoise={denoise})...")
        
        # Apply denoising if requested
        if denoise:
            img_array = np.array(img)
            # OpenCV denoising (h=10 for luminance, hColor=10 for color)
            denoised = cv2.fastNlMeansDenoisingColored(img_array, None, 10, 10, 7, 21)
            img = Image.fromarray(denoised)
            print("Denoising applied")
        
        # Prepare for model
        inputs = ImageLoader.load_image(img)
        
        # Run inference
        with __import__('torch').no_grad():
            preds = mdl(inputs)
        
        # Convert tensor output to PIL Image
        output_tensor = preds.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu().numpy()
        output_array = (output_tensor * 255).astype(np.uint8)
        output_img = Image.fromarray(output_array)
        
        # Handle scale != 4 by resizing
        if scale != 4:
            new_w = img.width * scale
            new_h = img.height * scale
            output_img = output_img.resize((new_w, new_h), Image.LANCZOS)
        
        # Save to buffer
        output_buffer = io.BytesIO()
        output_img.save(output_buffer, format='PNG')
        output_buffer.seek(0)
        
        print(f"Upscale finished for {file.filename}")
        
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
    print("AI Upscale Server starting on http://localhost:5300")
    # Pre-load model
    get_model()
    app.run(host='0.0.0.0', port=5300, debug=False)
