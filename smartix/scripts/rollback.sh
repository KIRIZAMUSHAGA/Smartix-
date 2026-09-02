#!/bin/bash
# scripts/rollback.sh — Rollback d'un déploiement Vibe-Coding
# Usage : ./scripts/rollback.sh [--revision N] [--deployment vibe-coding-api]

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

NAMESPACE=vibe-coding
DEPLOYMENT=${DEPLOYMENT:-vibe-coding-api}
REVISION=${REVISION:-0}   # 0 = version précédente

echo "╔══════════════════════════════════════════════════════╗"
echo "║   ⏪ Rollback Vibe-Coding                            ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Deployment : $DEPLOYMENT"
echo "  Namespace  : $NAMESPACE"
echo "  Révision   : ${REVISION:-précédente}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Vérifications
# ─────────────────────────────────────────────────────────────────────────────

if ! kubectl get deployment "${DEPLOYMENT}" -n "${NAMESPACE}" &>/dev/null; then
  echo "❌ Deployment '${DEPLOYMENT}' introuvable dans le namespace '${NAMESPACE}'"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Afficher l'historique
# ─────────────────────────────────────────────────────────────────────────────

echo "📋 Historique des révisions disponibles :"
kubectl rollout history deployment/"${DEPLOYMENT}" -n "${NAMESPACE}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Confirmation interactive
# ─────────────────────────────────────────────────────────────────────────────

if [ "${AUTO_CONFIRM:-false}" != "true" ]; then
  read -r -p "⚠️  Confirmer le rollback ? (y/N) : " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Rollback annulé"
    exit 0
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Rollback
# ─────────────────────────────────────────────────────────────────────────────

echo "⏪ Rollback en cours..."

if [ "${REVISION}" -gt 0 ] 2>/dev/null; then
  kubectl rollout undo deployment/"${DEPLOYMENT}" \
    -n "${NAMESPACE}" \
    --to-revision="${REVISION}"
else
  kubectl rollout undo deployment/"${DEPLOYMENT}" -n "${NAMESPACE}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Attente de stabilisation
# ─────────────────────────────────────────────────────────────────────────────

echo "⏳ Attente de la stabilisation..."
kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout=300s

kubectl wait \
  --for=condition=ready pod \
  -l "app=${DEPLOYMENT}" \
  -n "${NAMESPACE}" \
  --timeout=300s

# ─────────────────────────────────────────────────────────────────────────────
# Vérification de santé post-rollback
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "🧪 Vérification de santé post-rollback..."

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "https://api.vibe-coding.smartix.com/health" 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
  echo "  ✅ /health → 200 OK"
else
  echo "  ⚠️  /health → ${HEALTH_STATUS}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Résumé
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   ✅ Rollback terminé                                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Révision active :"
kubectl rollout history deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" | tail -2
echo ""
echo "  Pods actifs :"
kubectl get pods -n "${NAMESPACE}" -l "app=${DEPLOYMENT}"
