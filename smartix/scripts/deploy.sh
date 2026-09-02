#!/bin/bash
# scripts/deploy.sh — Déploiement de Vibe-Coding sur Kubernetes
# Usage : ./scripts/deploy.sh [--env production|staging] [--region eu-west|us-east|all]

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

ENV=${ENV:-production}
REGION=${REGION:-eu-west}
NAMESPACE=vibe-coding
IMAGE_REGISTRY=${IMAGE_REGISTRY:-docker.io/vibecoding}
API_VERSION=${API_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo "latest")}

echo "╔══════════════════════════════════════════════════════╗"
echo "║   🚀 Déploiement Vibe-Coding sur Kubernetes          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Environnement : $ENV"
echo "  Région        : $REGION"
echo "  Version       : $API_VERSION"
echo "  Namespace     : $NAMESPACE"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Vérifications préalables
# ─────────────────────────────────────────────────────────────────────────────

check_prerequisites() {
  echo "🔍 Vérification des prérequis..."

  for cmd in kubectl docker git; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "❌ $cmd n'est pas installé"
      exit 1
    fi
  done

  if ! kubectl cluster-info &>/dev/null; then
    echo "❌ Impossible de se connecter au cluster Kubernetes"
    exit 1
  fi

  echo "✅ Prérequis OK"
}

# ─────────────────────────────────────────────────────────────────────────────
# Build des images Docker
# ─────────────────────────────────────────────────────────────────────────────

build_images() {
  echo ""
  echo "📦 Build des images Docker..."

  docker build \
    -t "${IMAGE_REGISTRY}/api:${API_VERSION}" \
    -t "${IMAGE_REGISTRY}/api:latest" \
    -f Dockerfile.api \
    --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --build-arg GIT_COMMIT="${API_VERSION}" \
    .

  docker build \
    -t "${IMAGE_REGISTRY}/sandbox:${API_VERSION}" \
    -t "${IMAGE_REGISTRY}/sandbox:latest" \
    -f docker/Dockerfile.sandbox \
    .

  docker build \
    -t "${IMAGE_REGISTRY}/frontend:${API_VERSION}" \
    -t "${IMAGE_REGISTRY}/frontend:latest" \
    -f Dockerfile.frontend \
    --build-arg REACT_APP_API_URL="https://api.vibe-coding.smartix.com" \
    ./frontend

  echo "✅ Images buildées"
}

# ─────────────────────────────────────────────────────────────────────────────
# Push des images vers le registry
# ─────────────────────────────────────────────────────────────────────────────

push_images() {
  echo ""
  echo "📤 Push des images vers le registry..."

  for image in api sandbox frontend; do
    docker push "${IMAGE_REGISTRY}/${image}:${API_VERSION}"
    docker push "${IMAGE_REGISTRY}/${image}:latest"
    echo "  ✅ ${image}:${API_VERSION} poussée"
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# Déploiement sur Kubernetes
# ─────────────────────────────────────────────────────────────────────────────

deploy_kubernetes() {
  echo ""
  echo "⚙️ Déploiement sur Kubernetes..."

  # Namespace
  kubectl apply -f k8s/namespace.yaml

  # Configurations
  kubectl apply -f k8s/configmap.yaml
  kubectl apply -f k8s/regional-config.yaml

  # Vérifier que les secrets existent
  if ! kubectl get secret db-secret -n "${NAMESPACE}" &>/dev/null; then
    echo "⚠️  Secret db-secret manquant — création depuis les variables d'environnement..."
    kubectl create secret generic db-secret \
      --from-literal=url="${DATABASE_URL}" \
      -n "${NAMESPACE}" \
      --dry-run=client -o yaml | kubectl apply -f -
  fi

  # Mettre à jour la version des images
  sed -i "s|vibe-coding/api:latest|${IMAGE_REGISTRY}/api:${API_VERSION}|g" k8s/deployment.yaml
  sed -i "s|vibe-coding/sandbox:latest|${IMAGE_REGISTRY}/sandbox:${API_VERSION}|g" k8s/deployment.yaml
  sed -i "s|vibe-coding/frontend:latest|${IMAGE_REGISTRY}/frontend:${API_VERSION}|g" k8s/deployment.yaml

  # Déployer les workloads
  kubectl apply -f k8s/deployment.yaml
  kubectl apply -f k8s/service.yaml
  kubectl apply -f k8s/ingress.yaml
  kubectl apply -f k8s/hpa.yaml
  kubectl apply -f k8s/custom-metrics.yaml

  echo "✅ Manifests appliqués"
}

# ─────────────────────────────────────────────────────────────────────────────
# Attente de la disponibilité
# ─────────────────────────────────────────────────────────────────────────────

wait_for_rollout() {
  echo ""
  echo "⏳ Attente du déploiement..."

  kubectl rollout status deployment/vibe-coding-api -n "${NAMESPACE}" --timeout=300s
  kubectl rollout status deployment/vibe-coding-frontend -n "${NAMESPACE}" --timeout=180s

  echo ""
  echo "⏳ Vérification de la santé des pods..."
  kubectl wait \
    --for=condition=ready pod \
    -l app=vibe-coding-api \
    -n "${NAMESPACE}" \
    --timeout=300s

  echo "✅ Tous les pods sont prêts"
}

# ─────────────────────────────────────────────────────────────────────────────
# Smoke tests post-déploiement
# ─────────────────────────────────────────────────────────────────────────────

smoke_tests() {
  echo ""
  echo "🧪 Smoke tests..."

  API_ENDPOINT="https://api.vibe-coding.smartix.com"

  for endpoint in /health /ready; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_ENDPOINT}${endpoint}" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
      echo "  ✅ ${endpoint} → 200 OK"
    else
      echo "  ⚠️  ${endpoint} → ${STATUS} (le déploiement peut encore être en cours)"
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# Résumé final
# ─────────────────────────────────────────────────────────────────────────────

print_summary() {
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║   ✅ Déploiement terminé avec succès !               ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
  echo "  Version déployée : $API_VERSION"
  echo "  URL API          : https://api.vibe-coding.smartix.com"
  echo "  URL Frontend     : https://vibe-coding.smartix.com"
  echo ""
  echo "  Pods en cours :"
  kubectl get pods -n "${NAMESPACE}" -l app=vibe-coding-api 2>/dev/null || true
  echo ""
  echo "  HPA status :"
  kubectl get hpa -n "${NAMESPACE}" 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# Exécution
# ─────────────────────────────────────────────────────────────────────────────

check_prerequisites
build_images
push_images
deploy_kubernetes
wait_for_rollout
smoke_tests
print_summary
