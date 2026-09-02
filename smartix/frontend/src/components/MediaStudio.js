import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  X, Sliders, Sparkles, Smile, Type, Sticker, MoreVertical,
  Music, UserCheck, Zap, PenTool, Glasses,
  ArrowLeft, Share2, Settings, Eye
} from 'lucide-react';

const MediaStudio = ({ onMediaSave, onClose, initialMedia }) => {
  const [media, setMedia] = useState(initialMedia || null);
  const [mediaType, setMediaType] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    temperature: 0
  });
  const fileInputRef = useRef(null);

  // 6 CATÉGORIES PRINCIPALES
  const categories = [
    { id: 'adjustments', label: 'Ajustements', icon: Sliders },
    { id: 'effects', label: 'Effets', icon: Sparkles },
    { id: 'beauty', label: 'Beauté', icon: Smile },
    { id: 'text', label: 'Texte', icon: Type },
    { id: 'stickers', label: 'Stickers', icon: Sticker },
    { id: 'tools', label: 'Plus', icon: MoreVertical }
  ];

  // OUTILS RAPIDES DROITE
  const quickTools = [
    { id: 'music', label: 'Musique', icon: Music },
    { id: 'identify', label: 'Identifier', icon: UserCheck },
    { id: 'filters', label: 'Filtres', icon: Zap },
    { id: 'draw', label: 'Dessin', icon: PenTool },
    { id: 'ar', label: 'AR Lens', icon: Glasses }
  ];

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setMedia(event.target?.result);
      if (file.type.startsWith('image/')) {
        setMediaType('image');
      } else if (file.type.startsWith('video/')) {
        setMediaType('video');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!media) return;
    onMediaSave?.({
      media,
      mediaType,
      filters
    });
    onClose?.();
  };

  const renderMediaWithEffects = () => {
    const style = {
      filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) hue-rotate(${filters.temperature}deg)`
    };

    return (
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-[9/16] w-full max-w-xs mx-auto shadow-2xl">
        {mediaType === 'image' && (
          <img src={media} alt="Preview" style={style} className="w-full h-full object-cover" />
        )}
        {mediaType === 'video' && (
          <video src={media} style={style} className="w-full h-full object-cover" />
        )}
      </div>
    );
  };

  const renderCategoryPanel = () => {
    switch (activeCategory) {
      case 'adjustments':
        return (
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Ajustements</h3>
            {['brightness', 'contrast', 'saturation', 'temperature'].map((key) => (
              <div key={key}>
                <label className="text-white text-sm">{key.charAt(0).toUpperCase() + key.slice(1)}: {filters[key]}</label>
                <input
                  type="range"
                  min={key === 'temperature' ? '-50' : '0'}
                  max={key === 'temperature' ? '50' : '150'}
                  value={filters[key]}
                  onChange={(e) => setFilters({ ...filters, [key]: parseInt(e.target.value) })}
                  className="w-full mt-2"
                />
              </div>
            ))}
          </div>
        );
      case 'effects':
        return <div className="text-white font-semibold">Effets (À venir)</div>;
      case 'beauty':
        return <div className="text-white font-semibold">Beauté (À venir)</div>;
      case 'text':
        return <div className="text-white font-semibold">Texte (À venir)</div>;
      case 'stickers':
        return <div className="text-white font-semibold">Stickers (À venir)</div>;
      case 'tools':
        return <div className="text-white font-semibold">Outils Plus (À venir)</div>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0A0E1A] via-[#1A1F3A] to-[#0A0E1A] flex flex-col">
      
      {/* TOP BAR - Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-md border-b border-cyan-500/20">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5 text-cyan-400" />
        </button>
        <div className="flex gap-3">
          <button className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <Settings className="w-5 h-5 text-white" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <Eye className="w-5 h-5 text-white" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-lg transition-all">
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* CENTER - Story Preview 9:16 */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          {media ? (
            renderMediaWithEffects()
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-[9/16] w-full max-w-xs bg-gradient-to-br from-cyan-500/10 to-violet-500/10 border-2 border-dashed border-cyan-400/50 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400 transition-all"
            >
              <div className="text-4xl mb-3">📸</div>
              <p className="text-white font-semibold">Sélectionne une image</p>
              <p className="text-gray-400 text-sm mt-1">ou vidéo</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaUpload}
            className="hidden"
          />
        </div>

        {/* RIGHT SIDEBAR - Quick Tools */}
        <div className="w-20 bg-black/40 backdrop-blur-md border-l border-cyan-500/20 flex flex-col items-center justify-center gap-4 py-8">
          {quickTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                title={tool.label}
                className="p-3 rounded-full bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-400 transition-all group relative"
              >
                <Icon className="w-5 h-5 text-cyan-400" />
                <span className="absolute right-20 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CATEGORY PANEL - Left/Bottom */}
      {activeCategory && (
        <div className="bg-black/60 backdrop-blur-md border-t border-cyan-500/20 p-4 max-h-48 overflow-y-auto">
          <div className="max-w-2xl mx-auto">
            {renderCategoryPanel()}
          </div>
        </div>
      )}

      {/* BOTTOM BAR - 6 Categories */}
      <div className="bg-black/40 backdrop-blur-md border-t border-cyan-500/20 px-4 py-4">
        <div className="flex gap-3 justify-center">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-br from-cyan-500 to-violet-500 text-white shadow-lg shadow-cyan-500/50'
                    : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white border border-cyan-500/20'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PUBLISH BUTTON - Floating */}
      {media && (
        <div className="fixed bottom-32 right-8">
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-violet-500 text-white font-bold rounded-full shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/75 transition-all hover:scale-105"
          >
            Publier
          </button>
        </div>
      )}
    </div>
  );
};

MediaStudio.propTypes = {
  onMediaSave: PropTypes.func,
  onClose: PropTypes.func,
  initialMedia: PropTypes.object,
};

export default MediaStudio;
