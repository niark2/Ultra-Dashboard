@echo off
echo ===================================
echo    Whisper STT Server Launcher
echo ===================================
echo.

REM Vérifier si Python est installé
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Python n'est pas installé ou non trouvé dans le PATH
    echo Installez Python depuis https://python.org
    pause
    exit /b 1
)

echo [INFO] Vérification des dépendances...
pip show openai-whisper >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installation de openai-whisper...
    pip install openai-whisper flask flask-cors
)

echo.
echo [INFO] Démarrage du serveur Whisper STT...
echo [INFO] Le premier démarrage télécharge le modèle (~140MB pour base)
echo.
python whisper_server.py

pause
