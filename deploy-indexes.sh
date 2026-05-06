#!/usr/bin/env bash
# Deploy somente os índices do Firestore para o projeto apreco-app-br.
# Pré-requisito: firebase-tools instalado globalmente
#   npm install -g firebase-tools
#   firebase login
#
# Uso:
#   bash deploy-indexes.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "→ Deployando índices Firestore (firestore.indexes.json)..."
firebase deploy --only firestore:indexes --project apreco-app-br

echo "✓ Índices deployados com sucesso."
