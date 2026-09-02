// src/components/clips/ClipOptionsMenu.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Share2, MoreVertical, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

// =============================
// HOOK GLOBAL DE CLICK OUTSIDE (SINGLETON)
// =============================
let globalListeners = new Map();
let isGlobalListenerActive = false;

const addGlobalClickListener = (id, callback) => {
  globalListeners.set(id, callback);
  
  if (!isGlobalListenerActive) {
    isGlobalListenerActive = true;
    document.addEventListener('mousedown', (event) => {
      for (const [_, listener] of globalListeners) {
        listener(event);
      }
    });
  }
};

const removeGlobalClickListener = (id) => {
  globalListeners.delete(id);
  
  if (globalListeners.size === 0) {
    isGlobalListenerActive = false;
    document.removeEventListener('mousedown', () => {});
  }
};

let idCounter = 0;

// =============================
// COMPOSANT PRINCIPAL
// =============================
const ClipOptionsMenu = ({ clip, handleDownload, user, isOnline, onMenuOpen, onMenuClose }) => {
  const [open, setOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);
  
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const firstMenuItemRef = useRef(null);
  const componentId = useRef(`clip-menu-${Date.now()}-${idCounter++}`);
  
  // =============================
  // VALIDATION ROBUSTE DE L'URL
  // =============================
  const isValidVideoUrl = useCallback((url) => {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, []);
  
  // =============================
  // VALIDATION DU CLIP
  // =============================
  const validateClip = useCallback(() => {
    if (!clip) {
      toast.error('Clip invalide');
      return false;
    }
    if (!isValidVideoUrl(clip.video_url)) {
      toast.error('URL de la vidéo invalide');
      return false;
    }
    return true;
  }, [clip, isValidVideoUrl]);
  
  // =============================
  // GESTION DU CLICK OUTSIDE (GLOBAL)
  // =============================
  const handleClickOutside = useCallback((event) => {
    if (!open) return;
    
    const isClickInside = menuRef.current?.contains(event.target) || 
                          buttonRef.current?.contains(event.target);
    
    if (!isClickInside) {
      setOpen(false);
      onMenuClose?.();
    }
  }, [open, onMenuClose]);
  
  useEffect(() => {
    addGlobalClickListener(componentId.current, handleClickOutside);
    return () => {
      removeGlobalClickListener(componentId.current);
    };
  }, [handleClickOutside]);
  
  // =============================
  // DÉTECTION DU CLAVIER POUR LE FOCUS
  // =============================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        setIsKeyboardNavigation(true);
      }
    };
    
    const handleMouseDown = () => {
      setIsKeyboardNavigation(false);
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
  
  // =============================
  // GESTION DU CLAVIER (ÉCHAP, FLÈCHES)
  // =============================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;
      
      switch (e.key) {
        case 'Escape':
          setOpen(false);
          buttonRef.current?.focus();
          onMenuClose?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (firstMenuItemRef.current) {
            firstMenuItemRef.current.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          // Dernier élément du menu
          const menuItems = menuRef.current?.querySelectorAll('[role="menuitem"]');
          if (menuItems && menuItems.length > 0) {
            menuItems[menuItems.length - 1].focus();
          }
          break;
        default:
          break;
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onMenuClose]);
  
  // =============================
  // CALCUL DE LA POSITION DU MENU
  // =============================
  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const menuHeight = 120; // Estimation
    const menuWidth = 160;
    
    let top = rect.top + rect.height / 2;
    let left = rect.right + 8;
    
    // Ajustement si déborde à droite
    if (left + menuWidth > viewportWidth) {
      left = rect.left - menuWidth - 8;
    }
    
    // Ajustement si déborde en bas
    if (top + menuHeight / 2 > viewportHeight) {
      top = viewportHeight - menuHeight / 2 - 8;
    }
    
    // Ajustement si déborde en haut
    if (top - menuHeight / 2 < 0) {
      top = menuHeight / 2 + 8;
    }
    
    setMenuPosition({ top, left });
  }, []);
  
  useEffect(() => {
    if (open) {
      updateMenuPosition();
      window.addEventListener('resize', updateMenuPosition);
      window.addEventListener('scroll', updateMenuPosition);
    }
    
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition);
    };
  }, [open, updateMenuPosition]);
  
  // =============================
  // TOGGLE MENU (AVEC SETTER FONCTIONNEL)
  // =============================
  const toggleMenu = useCallback((e) => {
    e.stopPropagation();
    
    if (!isOnline) {
      toast.error('Hors-ligne : options non disponibles');
      return;
    }
    
    setOpen(prev => {
      const newState = !prev;
      if (newState) {
        updateMenuPosition();
        onMenuOpen?.();
      } else {
        onMenuClose?.();
      }
      return newState;
    });
  }, [isOnline, updateMenuPosition, onMenuOpen, onMenuClose]);
  
  // =============================
  // TÉLÉCHARGEMENT
  // =============================
  const handleDownloadClick = useCallback(async (e) => {
    e.stopPropagation();
    
    if (!isOnline) {
      toast.error('Hors-ligne : téléchargement impossible');
      return;
    }
    
    if (!validateClip()) return;
    
    if (!handleDownload) {
      toast.error('Téléchargement non disponible');
      return;
    }
    
    setIsDownloading(true);
    try {
      await handleDownload(clip);
      toast.success('Téléchargement démarré');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    } finally {
      setIsDownloading(false);
      setOpen(false);
    }
  }, [isOnline, validateClip, handleDownload, clip]);
  
  // =============================
  // PARTAGE (AVEC FALLBACK ROBUSTE)
  // =============================
  const handleShare = useCallback(async (e) => {
    e.stopPropagation();
    
    if (!isOnline) {
      toast.error('Hors-ligne : impossible de partager');
      return;
    }
    
    if (!validateClip()) return;
    
    const shareText = clip.description?.trim() || 'Regarde ce SmartClip !';
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'SmartClip',
          text: shareText,
          url: clip.video_url,
        });
        toast.success('Partagé !');
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clip.video_url);
        toast.success('Lien copié dans le presse-papier !');
      } else {
        // Fallback final
        const input = document.createElement('input');
        input.value = clip.video_url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        toast.success('Lien copié !');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share error:', error);
        
        // Dernier fallback : afficher le lien
        if (window.confirm('Impossible de partager automatiquement. Voulez-vous copier le lien manuellement ?')) {
          window.prompt('Copiez ce lien :', clip.video_url);
        } else {
          toast.error('Erreur lors du partage');
        }
      }
    }
    setOpen(false);
  }, [isOnline, validateClip, clip]);
  
  // =============================
  // RENDU DU MENU (PORTAL)
  // =============================
  const renderMenu = () => {
    if (!open) return null;
    
    return createPortal(
      <div 
        ref={menuRef}
        className="fixed flex flex-col gap-2 bg-[#1A1A1A]/95 backdrop-blur-md p-2 rounded-lg shadow-xl z-[100] border border-white/10 min-w-[160px]"
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
          transform: 'translateY(-50%)'
        }}
        role="menu"
        aria-label="Options du clip"
      >
        <button 
          ref={firstMenuItemRef}
          onClick={handleDownloadClick}
          disabled={isDownloading || !isOnline}
          className="flex items-center gap-3 px-4 py-2.5 text-white hover:text-[#44B0FF] hover:bg-white/5 rounded-lg transition-all w-full text-left disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          role="menuitem"
          aria-label="Télécharger la vidéo"
          tabIndex={0}
        >
          {isDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          Télécharger
          {!isOnline && <span className="text-xs ml-auto">(hors-ligne)</span>}
        </button>
        
        <button 
          onClick={handleShare}
          disabled={!isOnline}
          className="flex items-center gap-3 px-4 py-2.5 text-white hover:text-[#44B0FF] hover:bg-white/5 rounded-lg transition-all w-full text-left disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          role="menuitem"
          aria-label="Partager la vidéo"
          tabIndex={0}
        >
          <Share2 className="w-5 h-5" />
          Partager
          {!isOnline && <span className="text-xs ml-auto">(hors-ligne)</span>}
        </button>
        
        {/* Lien externe pour les cas extrêmes */}
        {isValidVideoUrl(clip?.video_url) && (
          <a
            href={clip.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all w-full text-left focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
            role="menuitem"
            aria-label="Ouvrir dans le navigateur"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-5 h-5" />
            Ouvrir dans le navigateur
          </a>
        )}
      </div>,
      document.body
    );
  };
  
  return (
    <>
      <div className="relative flex flex-col items-center gap-4">
        <button 
          ref={buttonRef}
          onClick={toggleMenu}
          disabled={!isOnline}
          className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#005CFF]"
          aria-label="Options"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <MoreVertical className="w-7 h-7 text-white"/>
        </button>
      </div>
      
      {renderMenu()}
    </>
  );
};

ClipOptionsMenu.propTypes = {
  clip: PropTypes.object.isRequired,
  handleDownload: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  isOnline: PropTypes.bool.isRequired,
  onMenuOpen: PropTypes.func.isRequired,
  onMenuClose: PropTypes.func.isRequired,
};

export default ClipOptionsMenu;
