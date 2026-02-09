#!/bin/bash

# Couleurs pour le terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   🚀 DÉPLOIEMENT ULTRA DASHBOARD SUR VPS   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# 1. Vérification des prérequis
echo -e "\n${YELLOW}[1/6] Vérification des prérequis...${NC}"
if ! [ -x "$(command -v docker)" ]; then
  echo -e "${RED}Erreur: Docker n'est pas installé.${NC}"
  echo "Installez-le avec : curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
  exit 1
fi

if ! [ -x "$(command -v docker-compose)" ] && ! docker compose version >/dev/null 2>&1; then
  echo -e "${RED}Erreur: Docker Compose n'est pas installé.${NC}"
  exit 1
fi
echo -e "${GREEN} -> Docker et Docker Compose sont présents.${NC}"

# 2. Vérification du fichier .env
echo -e "\n${YELLOW}[2/6] Configuration de l'environnement...${NC}"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${YELLOW}Attention : .env absent. Création à partir de .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}IMPORTANT : Modifiez .env pour configurer vos clés API !${NC}"
  else
    echo -e "${RED}Erreur : Aucun fichier .env ou .env.example trouvé.${NC}"
    exit 1
  fi
else
  echo -e "${GREEN} -> Fichier .env détecté.${NC}"
fi

# 3. Préparation des dossiers et permissions
echo -e "\n${YELLOW}[3/6] Préparation des volumes et permissions...${NC}"
mkdir -p uploads data public/databank models/u2net models/whisper models/huggingface searxng
chmod -R 777 uploads data public/databank models searxng
echo -e "${GREEN} -> Dossiers créés et permissions accordées.${NC}"

# 4. Build et Lancement des containers
echo -e "\n${YELLOW}[4/6] Construction et lancement des services (cela peut prendre du temps)...${NC}"
# On utilise la nouvelle syntaxe 'docker compose' si disponible, sinon 'docker-compose'
if docker compose version >/dev/null 2>&1; then
    DOCKER_CMD="docker compose"
else
    DOCKER_CMD="docker-compose"
fi

$DOCKER_CMD up -d --build

if [ $? -eq 0 ]; then
  echo -e "${GREEN} -> Containers lancés avec succès en arrière-plan.${NC}"
else
  echo -e "${RED}Erreur lors du lancement des containers.${NC}"
  exit 1
fi

# 5. Attente des Healthchecks
echo -e "\n${YELLOW}[5/6] Attente du démarrage complet des services IA...${NC}"
echo "Note : Les serveurs IA chargent les modèles au premier démarrage, soyez patient."

# Boucle d'attente basique
for i in {1..30}; do
  RUNNING=$(docker ps --filter "status=running" --filter "name=ultra" --format "{{.Names}}" | wc -l)
  echo -ne "   Containers actifs : $RUNNING/6 (Attente $i/30s)...\r"
  sleep 2
done
echo -e "\n${GREEN} -> Services opérationnels.${NC}"

# 6. Conclusion
IP_ADDR=$(hostname -I | awk '{print $1}')
echo -e "\n${BLUE}==============================================${NC}"
echo -e "${GREEN} ✅ TERMINÉ AVEC SUCCÈS !${NC}"
echo -e " L'application est disponible sur : ${YELLOW}http://$IP_ADDR${NC}"
echo -e " Logs en direct : ${BLUE}$DOCKER_CMD logs -f ultra-dashboard${NC}"
echo -e "${BLUE}==============================================${NC}"
