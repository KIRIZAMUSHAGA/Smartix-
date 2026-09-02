"""
SmartClips Models - Version SQLAlchemy pour MongoDB
Style identique à ton news_models.py existant
Version 2.0 avec support studio d'édition vidéo
"""

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, JSON, Float, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import uuid

# =============================
# SMARTCLIPS PRINCIPAL
# =============================

class SmartClip(Base):
    __tablename__ = "smartclips"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_url = Column(Text, nullable=False, unique=True)
    thumbnail_url = Column(Text)
    title = Column(String(200))
    description = Column(Text)
    duration = Column(Float)
    
    # Tags (stocké comme JSON - MongoDB gère ça très bien)
    tags = Column(JSON, default=list)
    source = Column(String(50), default="pixabay", index=True)
    
    # Auteur
    author_id = Column(String(100))
    author_name = Column(String(100))
    author_avatar = Column(Text)
    
    # Stats
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    
    # Relations (stockées comme listes d'IDs - pratique pour MongoDB)
    liked_by = Column(JSON, default=list)  # Liste des user_ids qui ont liké
    saved_by = Column(JSON, default=list)  # Liste des user_ids qui ont sauvegardé
    
    # Métadonnées
    quality = Column(String(10), default="HD")
    language = Column(String(10), default="fr")
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    scraped_at = Column(TIMESTAMP)
    
    # Statut
    is_active = Column(Boolean, default=True)
    
    # Relation avec les projets studio
    studio_projects = relationship("SmartClipStudioProject", back_populates="smartclip")


# =============================
# SMARTCLIPS STUDIO
# =============================

class SmartClipStudioProject(Base):
    """Projet d'édition vidéo dans SmartClips Studio"""
    __tablename__ = "smartclips_studio_projects"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(100), nullable=False, index=True)
    
    # Fichiers
    original_filename = Column(String(255))
    original_path = Column(Text)
    processed_url = Column(Text)
    thumbnail_url = Column(Text)
    
    # État
    status = Column(String(50), default="uploaded")  # uploaded, processing, completed, error
    progress = Column(Integer, default=0)  # 0-100
    error = Column(Text)
    
    # Éléments d'édition
    elements = Column(JSON, default=list)  # Liste des éléments (texte, stickers)
    filter_type = Column(String(50))  # grayscale, sepia, etc.
    audio_url = Column(Text)
    audio_volume = Column(Float, default=0.8)
    
    # Métadonnées vidéo
    duration = Column(Float)
    width = Column(Integer)
    height = Column(Integer)
    bitrate = Column(Integer)
    
    # SmartClip associé (si publié)
    smartclip_id = Column(String(50), ForeignKey("smartclips.id"))
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, onupdate=func.now())
    completed_at = Column(TIMESTAMP)
    
    # Relation
    smartclip = relationship("SmartClip", back_populates="studio_projects")
    
    # Index
    __table_args__ = (
        Index('idx_studio_projects_user_status', 'user_id', 'status'),
        Index('idx_studio_projects_created', 'created_at'),
    )


class SmartClipStudioElement(Base):
    """Élément individuel dans un projet studio (texte, sticker)"""
    __tablename__ = "smartclips_studio_elements"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(50), ForeignKey("smartclips_studio_projects.id"), nullable=False, index=True)
    
    # Type
    type = Column(String(20), nullable=False)  # text, sticker, shape
    
    # Contenu
    content = Column(Text)  # texte ou emoji
    font_size = Column(Integer, default=24)
    color = Column(String(20), default="#ffffff")
    
    # Position et transformation
    x = Column(Float, default=50)  # pourcentage
    y = Column(Float, default=50)  # pourcentage
    rotation = Column(Integer, default=0)
    scale = Column(Float, default=1.0)
    
    # Timing (dans la vidéo)
    start_time = Column(Float, default=0)
    duration = Column(Float, default=5)
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())
    
    # Index
    __table_args__ = (
        Index('idx_studio_elements_project', 'project_id'),
    )


class SmartClipStudioJob(Base):
    """Job d'export vidéo en arrière-plan"""
    __tablename__ = "smartclips_studio_jobs"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(50), ForeignKey("smartclips_studio_projects.id"), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    
    # État
    status = Column(String(50), default="pending")  # pending, processing, completed, error
    progress = Column(Integer, default=0)
    error = Column(Text)
    
    # Résultat
    output_url = Column(Text)
    
    # Métriques
    started_at = Column(TIMESTAMP)
    completed_at = Column(TIMESTAMP)
    duration_ms = Column(Integer)
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())
    
    # Index
    __table_args__ = (
        Index('idx_studio_jobs_user_status', 'user_id', 'status'),
        Index('idx_studio_jobs_project', 'project_id'),
    )


class SmartClipStudioTemplate(Base):
    """Modèles prédéfinis pour l'édition rapide"""
    __tablename__ = "smartclips_studio_templates"
    
    id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Données du template
    thumbnail_url = Column(Text)
    elements = Column(JSON, default=list)
    filter_type = Column(String(50))
    audio_url = Column(Text)
    audio_volume = Column(Float, default=0.8)
    
    # Métadonnées
    category = Column(String(50))
    is_premium = Column(Boolean, default=False)
    usage_count = Column(Integer, default=0)
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())
    
    # Index
    __table_args__ = (
        Index('idx_studio_templates_category', 'category'),
        Index('idx_studio_templates_usage', 'usage_count'),
    )


# =============================
# MODÈLES EXISTANTS (inchangés)
# =============================

class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, unique=True, index=True)
    favorite_tags = Column(JSON, default=list)
    excluded_tags = Column(JSON, default=list)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())


class UserProgress(Base):
    __tablename__ = "user_progress"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, unique=True, index=True)
    last_watched_index = Column(Integer, default=0)
    last_watched_id = Column(String(50))
    last_watched_timestamp = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP, onupdate=func.now())


class WatchedVideo(Base):
    __tablename__ = "watched_videos"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    video_id = Column(String(50), nullable=False, index=True)
    watch_duration = Column(Float)
    completed = Column(Boolean, default=False)
    watched_at = Column(TIMESTAMP, server_default=func.now())


class VideoLike(Base):
    __tablename__ = "video_likes"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    video_id = Column(String(50), nullable=False, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class VideoComment(Base):
    __tablename__ = "video_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String(50), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    parent_id = Column(Integer, nullable=True)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0)
    liked_by = Column(JSON, default=list)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())


class VideoSave(Base):
    __tablename__ = "video_saves"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    video_id = Column(String(50), nullable=False, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


class ScrapingStatus(Base):
    __tablename__ = "scraping_status"
    
    id = Column(String(50), primary_key=True, default="current")
    status = Column(String(50), default="idle")
    videos_found = Column(Integer, default=0)
    videos_added = Column(Integer, default=0)
    start_time = Column(TIMESTAMP)
    end_time = Column(TIMESTAMP)
    last_error = Column(Text)
    updated_at = Column(TIMESTAMP, onupdate=func.now())


class ScrapingSession(Base):
    __tablename__ = "scraping_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    session_date = Column(TIMESTAMP, server_default=func.now())
    new_videos = Column(Integer, default=0)
    completed = Column(Boolean, default=True)
