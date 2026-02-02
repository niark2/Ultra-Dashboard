/**
 * Toolbox Module
 * Comprehensive suite of mini-tools
 */

export function initToolbox() {
    initQRCode();
    initPasswordGen();
    initTextUtils();
    initUnitConverter();
    initCurrencyConverter();
    initMirror();
}

/**
 * Currency Converter logic
 */
function initCurrencyConverter() {
    const fromVal = document.getElementById('cur-from-val');
    const toVal = document.getElementById('cur-to-val');
    const fromType = document.getElementById('cur-from-type');
    const toType = document.getElementById('cur-to-type');
    const swapBtn = document.getElementById('cur-swap');
    const rateInfo = document.getElementById('cur-rate-info');

    if (!fromVal) return;

    const convert = async () => {
        const amount = parseFloat(fromVal.value);
        if (isNaN(amount) || amount <= 0) {
            toVal.value = '';
            return;
        }

        const base = fromType.value;
        const target = toType.value;

        if (base === target) {
            toVal.value = amount.toFixed(2);
            rateInfo.textContent = `1 ${base} = 1.00 ${target}`;
            return;
        }

        try {
            rateInfo.textContent = 'Mise à jour du taux...';
            const response = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${base}&to=${target}`);
            const data = await response.json();

            if (data.rates && data.rates[target]) {
                const result = data.rates[target];
                toVal.value = result.toFixed(2);
                const singleRate = result / amount;
                rateInfo.textContent = `1 ${base} = ${singleRate.toFixed(4)} ${target}`;
            }
        } catch (error) {
            console.error('Currency API error:', error);
            rateInfo.textContent = 'Erreur lors de la récupération du taux';
        }
    };

    let timeout = null;
    fromVal.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(convert, 500);
    });

    [fromType, toType].forEach(el => el.addEventListener('change', convert));

    swapBtn.addEventListener('click', () => {
        const temp = fromType.value;
        fromType.value = toType.value;
        toType.value = temp;
        convert();
    });

    convert();
}

/**
 * QR Code Generator logic
 */
function initQRCode() {
    const input = document.getElementById('qr-input');
    const resultDiv = document.getElementById('qrcode-result');
    const downloadBtn = document.getElementById('qr-download');

    if (!input || !resultDiv) return;

    let timeout = null;

    input.addEventListener('input', () => {
        clearTimeout(timeout);
        const text = input.value.trim();

        if (!text) {
            resultDiv.innerHTML = '<p style="color: var(--text-muted); font-size: 12px;">Votre QR code apparaîtra ici</p>';
            downloadBtn.classList.add('hidden');
            return;
        }

        timeout = setTimeout(() => {
            resultDiv.innerHTML = '';
            QRCode.toCanvas(text, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }, (error, canvas) => {
                if (error) {
                    console.error(error);
                    resultDiv.innerHTML = '<p style="color: #ef4444; font-size: 12px;">Erreur de génération</p>';
                    return;
                }
                resultDiv.appendChild(canvas);
                downloadBtn.classList.remove('hidden');
            });
        }, 300);
    });

    downloadBtn.addEventListener('click', () => {
        const canvas = resultDiv.querySelector('canvas');
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = 'qrcode.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

/**
 * Password Generator logic
 */
function initPasswordGen() {
    const lengthInput = document.getElementById('pass-length');
    const lengthVal = document.getElementById('pass-length-val');
    const resultSpan = document.getElementById('pass-result');
    const genBtn = document.getElementById('pass-gen');
    const copyBtn = document.getElementById('pass-copy');

    const checkUpper = document.getElementById('pass-upper');
    const checkLower = document.getElementById('pass-lower');
    const checkNum = document.getElementById('pass-num');
    const checkSym = document.getElementById('pass-sym');

    if (!lengthInput || !genBtn) return;

    lengthInput.addEventListener('input', () => {
        lengthVal.textContent = lengthInput.value;
    });

    const generate = () => {
        const length = parseInt(lengthInput.value);
        const chars = {
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            lower: 'abcdefghijklmnopqrstuvwxyz',
            num: '0123456789',
            sym: '!@#$%^&*()_+~`|}{[]:;?><,./-='
        };

        let charset = '';
        if (checkUpper.checked) charset += chars.upper;
        if (checkLower.checked) charset += chars.lower;
        if (checkNum.checked) charset += chars.num;
        if (checkSym.checked) charset += chars.sym;

        if (!charset) charset = chars.lower; // Fallback

        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        resultSpan.textContent = password;
    };

    genBtn.addEventListener('click', generate);

    copyBtn.addEventListener('click', () => {
        const text = resultSpan.textContent;
        if (text === '********') return;

        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px; color: var(--success);"></i>';
            if (window.lucide) window.lucide.createIcons();
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                if (window.lucide) window.lucide.createIcons();
            }, 2000);
        });
    });
}

/**
 * Text Utilities logic
 */
function initTextUtils() {
    const input = document.getElementById('text-input');
    const charCount = document.getElementById('text-count-chars');
    const wordCount = document.getElementById('text-count-words');
    const buttons = document.querySelectorAll('[data-action]');

    if (!input) return;

    input.addEventListener('input', () => {
        const text = input.value;
        charCount.textContent = `${text.length} caractères`;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        wordCount.textContent = `${words} mots`;
    });

    buttons.forEach(btn => {
        if (btn.closest('.tool-card').querySelector('.tool-title').textContent !== 'Outils Texte') return;

        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            let text = input.value;

            switch (action) {
                case 'upper':
                    text = text.toUpperCase();
                    break;
                case 'lower':
                    text = text.toLowerCase();
                    break;
                case 'title':
                    text = text.toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');
                    break;
                case 'clean':
                    text = text.trim().replace(/\s+/g, ' ');
                    break;
            }

            input.value = text;
            input.dispatchEvent(new Event('input'));
        });
    });
}

/**
 * Unit Converter logic
 */
function initUnitConverter() {
    const fromInput = document.getElementById('unit-from-val');
    const toInput = document.getElementById('unit-to-val');
    const typeSelect = document.getElementById('unit-type');
    const swapBtn = document.getElementById('unit-swap');

    if (!fromInput || !toInput) return;

    const convert = () => {
        const val = parseFloat(fromInput.value);
        if (isNaN(val)) {
            toInput.value = '';
            return;
        }

        const type = typeSelect.value;
        let result;

        switch (type) {
            case 'length':
                result = val * 3.28084; // m to ft
                break;
            case 'weight':
                result = val * 2.20462; // kg to lb
                break;
            case 'temp':
                result = (val * 9 / 5) + 32; // C to F
                break;
        }

        toInput.value = result.toFixed(2);
    };

    fromInput.addEventListener('input', convert);
    typeSelect.addEventListener('change', convert);

    swapBtn.addEventListener('click', () => {
        const type = typeSelect.value;
        const val = parseFloat(fromInput.value);

        // This is a simple version, ideally we'd have a more robust bi-directional system
        // But for "Mini Tools", simple is fine.
        // Let's just invert the current type label/conversion for feedback if we wanted
        // For now, let's just reverse the last result into the input
        if (toInput.value) {
            fromInput.value = toInput.value;
            convert();
        }
    });
}

/**
 * Webcam Mirror logic
 */
function initMirror() {
    const video = document.getElementById('mirrorVideo');
    const canvas = document.getElementById('mirrorCanvas');
    const placeholder = document.getElementById('mirrorPlaceholder');
    const toggleBtn = document.getElementById('mirrorToggle');
    const captureBtn = document.getElementById('mirrorCapture');
    const downloadBtn = document.getElementById('mirrorDownload');
    const deviceSelect = document.getElementById('mirrorDeviceSelect');

    if (!video || !toggleBtn) return;

    let stream = null;
    let isActive = false;
    let devices = [];

    // Enumerate available video devices
    async function loadDevices() {
        try {
            const mediaDevices = await navigator.mediaDevices.enumerateDevices();
            devices = mediaDevices.filter(device => device.kind === 'videoinput');

            if (devices.length > 1) {
                deviceSelect.innerHTML = '<option value="">Sélectionner une caméra...</option>';
                devices.forEach((device, index) => {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.textContent = device.label || `Caméra ${index + 1}`;
                    deviceSelect.appendChild(option);
                });
                deviceSelect.style.display = 'block';
            }
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }

    // Start webcam stream
    async function startMirror(deviceId = null) {
        try {
            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true,
                audio: false
            };

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;

            // Show video, hide placeholder
            video.style.display = 'block';
            placeholder.style.display = 'none';
            captureBtn.style.display = 'block';

            // Update button
            toggleBtn.innerHTML = '<i data-lucide="video-off" style="width: 14px; height: 14px;"></i> Désactiver';
            if (window.lucide) window.lucide.createIcons();

            isActive = true;

            // Load devices after getting permission
            await loadDevices();
        } catch (error) {
            console.error('Error accessing webcam:', error);
            alert('Impossible d\'accéder à la webcam. Vérifiez les permissions.');
        }
    }

    // Stop webcam stream
    function stopMirror() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        video.style.display = 'none';
        canvas.style.display = 'none';
        placeholder.style.display = 'flex';
        captureBtn.style.display = 'none';
        downloadBtn.style.display = 'none';

        toggleBtn.innerHTML = '<i data-lucide="video" style="width: 14px; height: 14px;"></i> Activer';
        if (window.lucide) window.lucide.createIcons();

        isActive = false;
    }

    // Capture photo from video
    function capturePhoto() {
        if (!isActive) return;

        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Show canvas, hide video
        video.style.display = 'none';
        canvas.style.display = 'block';
        downloadBtn.style.display = 'block';

        // Update capture button to "Retour"
        captureBtn.innerHTML = '<i data-lucide="rotate-ccw" style="width: 14px; height: 14px;"></i> Retour';
        if (window.lucide) window.lucide.createIcons();
    }

    // Return to live view
    function returnToLive() {
        video.style.display = 'block';
        canvas.style.display = 'none';
        downloadBtn.style.display = 'none';

        captureBtn.innerHTML = '<i data-lucide="camera" style="width: 14px; height: 14px;"></i> Capturer';
        if (window.lucide) window.lucide.createIcons();
    }

    // Download captured image
    function downloadImage() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        link.download = `webcam-capture-${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    // Event listeners
    toggleBtn.addEventListener('click', () => {
        if (isActive) {
            stopMirror();
        } else {
            startMirror();
        }
    });

    captureBtn.addEventListener('click', () => {
        if (canvas.style.display === 'block') {
            returnToLive();
        } else {
            capturePhoto();
        }
    });

    downloadBtn.addEventListener('click', downloadImage);

    deviceSelect.addEventListener('change', (e) => {
        if (e.target.value && isActive) {
            stopMirror();
            startMirror(e.target.value);
        }
    });
}
