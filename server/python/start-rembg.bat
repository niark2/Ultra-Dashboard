@echo off
echo ========================================
echo    REMBG Server - Background Remover
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Python installation...
python --version 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

echo.
echo Installing dependencies if needed...
pip install -r requirements.txt -q

echo.
echo Starting REMBG Server on http://localhost:5100
echo (Press Ctrl+C to stop)
echo.

python rembg_server.py

pause
