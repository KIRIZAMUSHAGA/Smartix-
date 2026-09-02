# =============================
# Smartix Dockerfile - Production Ready
# =============================

# 1. Image de base
FROM python:3.10-slim

# 2. Métadonnées
LABEL maintainer="Smartix Team"
LABEL description="Smartix Platform - Éducation & IA"

# 3. Variables d'environnement
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV TZ=Africa/Kinshasa

# 4. Installer FFmpeg et les dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 5. Vérifier FFmpeg
RUN ffmpeg -version

# 6. Créer le dossier de travail
WORKDIR /app

# 7. Copier les fichiers de dépendances
COPY requirements.txt .
COPY requirements-dev.txt . 2>/dev/null || true

# 8. Installer les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# 9. Copier tout le code source
COPY . .

# 10. Créer les dossiers d'upload
RUN mkdir -p uploads/smartclips_studio/{uploads,processed,temp} \
    && mkdir -p uploads/avatars \
    && mkdir -p uploads/posts \
    && mkdir -p logs

# 11. Créer un utilisateur non-root pour la sécurité
RUN useradd -m -u 1000 smartix && chown -R smartix:smartix /app
USER smartix

# 12. Exposer le port
EXPOSE 8000

# 13. Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 14. Commande de démarrage
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
