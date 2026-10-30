#!/usr/bin/env bash
# ==============================================================================
# SkillProof Environment & System Prerequisites Check Script
# ==============================================================================
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
RESET="\033[0m"

echo -e "${BOLD}======================================================${RESET}"
echo -e "${BOLD}         SkillProof Environment Diagnostic Check       ${RESET}"
echo -e "${BOLD}======================================================${RESET}"
echo ""

FAILURES=0
WARNINGS=0

# Ensure local workspace tools are checked if available
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -d "$WORKSPACE_DIR/.tools/bin" ]; then
  export PATH="$WORKSPACE_DIR/.tools/bin:$PATH"
fi

# 1. Node.js Check
echo -n "Checking Node.js (>= 20 LTS required, 22 recommended)... "
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    echo -e "${GREEN}OK (v${NODE_VER})${RESET}"
  else
    echo -e "${RED}FAIL (v${NODE_VER} detected; >= 20 required)${RESET}"
    echo "  -> Please update Node.js using nvm or official NodeSource repository."
    FAILURES=$((FAILURES + 1))
  fi
else
  echo -e "${RED}FAIL (Not found in PATH)${RESET}"
  echo "  -> Install Node.js LTS via: https://nodejs.org"
  FAILURES=$((FAILURES + 1))
fi

# 2. npm Check
echo -n "Checking npm (>= 9 required)... "
if command -v npm >/dev/null 2>&1; then
  NPM_VER=$(npm -v)
  echo -e "${GREEN}OK (v${NPM_VER})${RESET}"
else
  echo -e "${RED}FAIL (Not found in PATH)${RESET}"
  FAILURES=$((FAILURES + 1))
fi

# 3. Git Check
echo -n "Checking Git... "
if command -v git >/dev/null 2>&1; then
  GIT_VER=$(git --version | awk '{print $3}')
  echo -e "${GREEN}OK (v${GIT_VER})${RESET}"
else
  echo -e "${RED}FAIL (git is not installed)${RESET}"
  echo "  -> Run: sudo apt update && sudo apt install -y git"
  FAILURES=$((FAILURES + 1))
fi

# 4. Docker Engine Check
echo -n "Checking Docker Engine... "
if command -v docker >/dev/null 2>&1; then
  DOCKER_VER=$(docker --version | awk '{print $3}' | sed 's/,//')
  echo -e "${GREEN}OK (v${DOCKER_VER})${RESET}"
  
  echo -n "Checking Docker daemon access (permissions)... "
  if docker info >/dev/null 2>&1; then
    echo -e "${GREEN}OK (Daemon accessible)${RESET}"
  else
    echo -e "${YELLOW}WARNING (Cannot reach Docker daemon without sudo)${RESET}"
    echo "  -> To enable rootless/user access: sudo usermod -aG docker \$USER"
    echo "  -> Security Note: Membership in the 'docker' group is root-equivalent."
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${YELLOW}WARNING (Docker Engine not installed)${RESET}"
  echo "  -> Docker Engine is required for MongoDB Compose and the Sandbox Runner."
  echo "  -> Installation guide: https://docs.docker.com/engine/install/ubuntu/"
  WARNINGS=$((WARNINGS + 1))
fi

# 5. Docker Compose Check
echo -n "Checking Docker Compose... "
if docker compose version >/dev/null 2>&1; then
  COMPOSE_VER=$(docker compose version | awk '{print $4}')
  echo -e "${GREEN}OK (${COMPOSE_VER})${RESET}"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_VER=$(docker-compose --version | awk '{print $3}' | sed 's/,//')
  echo -e "${GREEN}OK (${COMPOSE_VER})${RESET}"
else
  echo -e "${YELLOW}WARNING (Docker Compose plugin not found)${RESET}"
  WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo -e "${BOLD}------------------------------------------------------${RESET}"
if [ $FAILURES -eq 0 ]; then
  if [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}All prerequisites satisfied! System ready for SkillProof.${RESET}"
  else
    echo -e "${YELLOW}${BOLD}Core prerequisites met with $WARNINGS warning(s). Check messages above.${RESET}"
  fi
  exit 0
else
  echo -e "${RED}${BOLD}Prerequisite check failed with $FAILURES blocking error(s).${RESET}"
  exit 1
fi
