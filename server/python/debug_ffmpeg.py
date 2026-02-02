
import os
import sys
import subprocess

print("=== DIAGNOSTIC FFmpeg ===")

# 1. Vérifier USER_HOME
user_home = os.path.expanduser("~")
print(f"USER_HOME: {user_home}")

# 2. Reconstruire le chemin exact utilisé dans le serveur
target_path = os.path.join(user_home, r"AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8.0.1-full_build\bin")
print(f"Chemin testé: {target_path}")

# 3. Vérifier existence dossier et fichier
if os.path.exists(target_path):
    print("✅ Le dossier existe.")
    exe_path = os.path.join(target_path, "ffmpeg.exe")
    if os.path.exists(exe_path):
        print("✅ ffmpeg.exe trouvé à l'intérieur.")
    else:
        print("❌ ffmpeg.exe ABSENT du dossier !")
else:
    print("❌ Le dossier N'EXISTE PAS !")

# 4. Tester l'ajout au PATH et l'exécution
print("\nTest d'exécution via subprocess...")
os.environ['PATH'] = target_path + os.pathsep + os.environ['PATH']

try:
    # On imite ce que fait Whisper (capture_output=True)
    result = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ SUCCÈS : FFmpeg s'est lancé correctement !")
        print(f"Version détectée: {result.stdout.splitlines()[0]}")
    else:
        print(f"⚠️ ÉCHEC : Code retour {result.returncode}")
        print(result.stderr)
except FileNotFoundError:
    print("❌ WinError 2 : Le fichier spécifié est introuvable (même après ajout au PATH)")
except Exception as e:
    print(f"❌ Erreur inattendue : {e}")

print("\n=== FIN DIAGNOSTIC ===")
