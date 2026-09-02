from sqlalchemy import Column, Integer, Text, TIMESTAMP, ForeignKey, Boolean, Index, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class NewsSource(Base):
    __tablename__ = "news_source"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    base_url = Column(Text)
    rss_url = Column(Text, unique=True)  # ← Éviter doublons RSS
    country = Column(Text)
    language = Column(Text)
    priority = Column(Integer, default=0)
    
    # Stats et monitoring
    last_checked = Column(TIMESTAMP)
    last_success = Column(TIMESTAMP)
    last_error = Column(Text)
    error_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    total_articles = Column(Integer, default=0)
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())

    # Relations
    news = relationship("News", back_populates="source", cascade="save-update")
    
    __table_args__ = (
        Index('idx_news_source_active', 'is_active', 'priority'),
        Index('idx_news_source_last_checked', 'last_checked'),
    )

class News(Base):
    __tablename__ = "news"
    
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(
        Integer, 
        ForeignKey("news_source.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Contenu
    title = Column(Text, nullable=False)
    summary = Column(Text)
    content = Column(Text)
    content_html = Column(Text)  # ← Version HTML formatée
    
    # URLs
    url = Column(Text, nullable=False, unique=True)
    canonical_url = Column(Text)
    image_url = Column(Text)
    local_image_path = Column(Text)
    
    # Métadonnées
    country = Column(Text)
    language = Column(Text)
    category = Column(Text)
    tags = Column(Text)  # ← Stocker comme JSON string ou tableau
    
    # Statistiques
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    
    # Statut
    is_duplicate = Column(Boolean, default=False)
    processed = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    
    # Hash pour déduplication
    dedup_hash = Column(Text, index=True, unique=True)  # ← Unique !
    
    # Dates
    published_at = Column(TIMESTAMP, index=True)
    fetched_at = Column(TIMESTAMP, server_default=func.now())
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())
    expires_at = Column(TIMESTAMP)  # Pour nettoyage automatique

    # Relations
    source = relationship("NewsSource", back_populates="news")
    likes = relationship("NewsLike", back_populates="news", cascade="all, delete-orphan")
    comments = relationship("NewsComment", back_populates="news", cascade="all, delete-orphan")
    
    __table_args__ = (
        # Index pour recherche
        Index('idx_news_published_at', 'published_at'),
        Index('idx_news_country', 'country'),
        Index('idx_news_category', 'category'),
        Index('idx_news_language', 'language'),
        
        # Index composés pour les filtres fréquents
        Index('idx_news_country_date', 'country', 'published_at'),
        Index('idx_news_category_date', 'category', 'published_at'),
        Index('idx_news_source_date', 'source_id', 'published_at'),
        
        # Index pour statut
        Index('idx_news_active', 'is_active', 'published_at'),
        Index('idx_news_duplicate', 'is_duplicate'),
        
        # Index pour full-text (selon DB)
        # MySQL: besoin de migration séparée pour FULLTEXT
        # PostgreSQL: utiliser GIN avec migration séparée
        
        # Contraintes
        CheckConstraint('LENGTH(title) <= 500', name='check_news_title_length'),
        CheckConstraint('LENGTH(summary) <= 2000', name='check_news_summary_length'),
    )

class NewsLike(Base):
    __tablename__ = "news_like"
    
    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, ForeignKey("news.id", ondelete="CASCADE"))
    user_id = Column(Text, nullable=False, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # Relations
    news = relationship("News", back_populates="likes")
    
    __table_args__ = (
        # Éviter les likes en double
        Index('idx_news_like_unique', 'news_id', 'user_id', unique=True),
        Index('idx_news_like_created', 'created_at'),
        Index('idx_news_like_user_date', 'user_id', 'created_at'),
    )

class NewsComment(Base):
    __tablename__ = "news_comment"
    
    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, ForeignKey("news.id", ondelete="CASCADE"))
    user_id = Column(Text, nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("news_comment.id"), nullable=True)  # Pour les réponses
    
    message = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0)
    
    # Statut
    is_edited = Column(Boolean, default=False)
    is_deleted = Column(Boolean, default=False)
    
    # Dates
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())

    # Relations
    news = relationship("News", back_populates="comments")
    replies = relationship("NewsComment", backref="parent", remote_side=[id])
    
    __table_args__ = (
        Index('idx_news_comment_news', 'news_id', 'created_at'),
        Index('idx_news_comment_user', 'user_id', 'created_at'),
        Index('idx_news_comment_parent', 'parent_id'),
        CheckConstraint('LENGTH(message) <= 2000', name='check_comment_length'),
    )
