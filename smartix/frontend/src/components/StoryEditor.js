import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowLeft, MoreVertical, Share2, Plus, RotateCcw, RotateCw, Sparkles,
  Type, Music, Smile, UserCheck, Zap, PenTool, Grid3x2, Upload,
  Wand2, X, Copy, Lock, Trash2, ChevronDown
} from 'lucide-react';

const StoryEditor = ({ onMediaSave, onClose, initialMedia }) => {
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [activeToolPanel, setActiveToolPanel] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [globalStyle, setGlobalStyle] = useState('none');
  const [canvasRef, setCanvasRef] = useState(useRef(null));
  const fileInputRef = useRef(null);

  // OUTILS LATÉRAUX - Exact comme demandé
  const toolsRight = [
    { id: 'text', label: 'Texte AI+', icon: Type, color: 'from-cyan-400 to-blue-500' },
    { id: 'music', label: 'Musique', icon: Music, color: 'from-violet-400 to-purple-500' },
    { id: 'stickers', label: 'Stickers & Emojis', icon: Smile, color: 'from-pink-400 to-rose-500' },
    { id: 'identify', label: 'Identifier', icon: UserCheck, color: 'from-green-400 to-emerald-500' },
    { id: 'effects', label: 'Effets', icon: Zap, color: 'from-yellow-400 to-orange-500' },
    { id: 'draw', label: 'Dessin', icon: PenTool, color: 'from-indigo-400 to-blue-600' },
    { id: 'templates', label: 'Templates', icon: Grid3x2, color: 'from-teal-400 to-cyan-500' },
    { id: 'import', label: 'Import', icon: Upload, color: 'from-gray-400 to-slate-500' },
  ];

  // STYLES GLOBAUX IA
  const globalStyles = [
    { id: 'neon', label: 'Neon Tech', colors: 'from-cyan-500 via-purple-500 to-pink-500' },
    { id: 'galaxy', label: 'Smartix Galaxy', colors: 'from-indigo-600 via-purple-600 to-pink-600' },
    { id: 'student', label: 'Étudiant Pro', colors: 'from-blue-500 to-cyan-500' },
    { id: 'minimal', label: 'Minimal Clean', colors: 'from-slate-200 to-white' },
    { id: 'dark', label: 'Dark Material', colors: 'from-gray-900 to-black' },
  ];

  // Ajouter un élément à l'historique
  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.stringify(elements));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(JSON.parse(history[historyIndex - 1]));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(JSON.parse(history[historyIndex + 1]));
    }
  };

  // AJOUTER TEXTE
  const addText = () => {
    const newText = {
      id: Date.now(),
      type: 'text',
      content: 'Nouveau texte',
      x: 540,
      y: 960,
      fontSize: 32,
      color: '#FFFFFF',
      fontStyle: 'bold',
      rotation: 0,
      opacity: 100,
      effect: 'none'
    };
    setElements([...elements, newText]);
    saveToHistory();
    setSelectedElement(newText.id);
  };

  // AJOUTER STICKER
  const addSticker = (emoji) => {
    const newSticker = {
      id: Date.now(),
      type: 'sticker',
      content: emoji,
      x: 540,
      y: 960,
      size: 60,
      rotation: 0,
      opacity: 100
    };
    setElements([...elements, newSticker]);
    saveToHistory();
    setSelectedElement(newSticker.id);
  };

  // DUPLIQUER ÉLÉMENT
  const duplicateElement = () => {
    if (selectedElement) {
      const element = elements.find(e => e.id === selectedElement);
      if (element) {
        const newElement = { ...element, id: Date.now(), x: element.x + 20, y: element.y + 20 };
        setElements([...elements, newElement]);
        saveToHistory();
        setSelectedElement(newElement.id);
      }
    }
  };

  // SUPPRIMER ÉLÉMENT
  const deleteElement = () => {
    if (selectedElement) {
      setElements(elements.filter(e => e.id !== selectedElement));
      saveToHistory();
      setSelectedElement(null);
    }
  };

  // PUBLIER
  const handlePublish = () => {
    // Créer une capture du canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.toBlob(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          onMediaSave?.({
            media: reader.result,
            mediaType: 'image',
            elements: elements,
            globalStyle: globalStyle
          });
        };
        reader.readAsDataURL(blob);
      });
    }
  };

  // ÉLÉMENT SÉLECTIONNÉ
  const selected = elements.find(e => e.id === selectedElement);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-black to-gray-950 flex flex-col overflow-hidden">
      {/* 🔵 BARRE SUPÉRIEURE */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur">
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="Retour"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-2">
          {/* Plus */}
          <div className="relative group">
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <MoreVertical className="w-5 h-5 text-white" />
            </button>
            <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-white/20 rounded-lg shadow-lg py-2 min-w-max opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button className="w-full px-4 py-2 text-white text-sm hover:bg-white/10 text-left">
                Enregistrer comme modèle
              </button>
              <button className="w-full px-4 py-2 text-white text-sm hover:bg-white/10 text-left">
                Exporter haute qualité
              </button>
              <button className="w-full px-4 py-2 text-white text-sm hover:bg-white/10 text-left">
                Dupliquer story
              </button>
            </div>
          </div>

          {/* Partager */}
          <button
            onClick={handlePublish}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-600 hover:to-violet-600 text-white rounded-full font-semibold transition-all"
          >
            <Share2 className="w-4 h-4" />
            Partager
          </button>
        </div>
      </div>

      {/* 📐 ZONE PRINCIPALE */}
      <div className="flex-1 flex items-center justify-center gap-8 p-8 overflow-auto">
        {/* Canvas - 1080x1920 */}
        <div className="flex-shrink-0">
          <div
            ref={canvasRef}
            className={`relative w-[270px] h-[480px] bg-gradient-to-br ${
              globalStyle === 'neon' ? 'from-cyan-500 via-purple-500 to-pink-500' :
              globalStyle === 'galaxy' ? 'from-indigo-600 via-purple-600 to-pink-600' :
              globalStyle === 'student' ? 'from-blue-500 to-cyan-500' :
              globalStyle === 'minimal' ? 'from-slate-200 to-white' :
              globalStyle === 'dark' ? 'from-gray-900 to-black' :
              'from-black to-gray-900'
            } rounded-[12px] shadow-2xl overflow-hidden border border-white/10 cursor-crosshair`}
            onClick={() => setSelectedElement(null)}
          >
            {/* Élements sur le canvas */}
            {elements.map(element => (
              <div
                key={element.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedElement(element.id);
                }}
                className={`absolute cursor-move transition-all ${
                  selectedElement === element.id ? 'ring-2 ring-cyan-400' : ''
                }`}
                style={{
                  left: `${(element.x / 1080) * 100}%`,
                  top: `${(element.y / 1920) * 100}%`,
                  transform: `rotate(${element.rotation}deg)`,
                  opacity: element.opacity / 100,
                }}
                draggable
                onDragEnd={(e) => {
                  const newElements = elements.map(el =>
                    el.id === element.id
                      ? { ...el, x: element.x + e.deltaX, y: element.y + e.deltaY }
                      : el
                  );
                  setElements(newElements);
                }}
              >
                {element.type === 'text' && (
                  <p
                    style={{
                      fontSize: `${(element.fontSize / 1080) * 270}px`,
                      color: element.color,
                      fontWeight: element.fontStyle === 'bold' ? 'bold' : 'normal',
                    }}
                    className="whitespace-nowrap font-sans"
                  >
                    {element.content}
                  </p>
                )}
                {element.type === 'sticker' && (
                  <div style={{ fontSize: `${(element.size / 1080) * 270}px` }}>
                    {element.content}
                  </div>
                )}
              </div>
            ))}

            {/* Grille de repères */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-1/3 left-0 right-0 h-px bg-violet-500/50"></div>
              <div className="absolute top-2/3 left-0 right-0 h-px bg-violet-500/50"></div>
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-violet-500/50"></div>
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-violet-500/50"></div>
            </div>
          </div>
        </div>

        {/* 🔶 BARRE LATÉRALE OUTILS */}
        <div className="flex flex-col gap-3">
          {toolsRight.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveToolPanel(activeToolPanel === tool.id ? null : tool.id)}
              className={`p-3 rounded-full transition-all duration-300 ${
                activeToolPanel === tool.id
                  ? `bg-gradient-to-r ${tool.color} shadow-lg scale-110`
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              title={tool.label}
            >
              <tool.icon className={`w-5 h-5 ${activeToolPanel === tool.id ? 'text-white' : 'text-white/70'}`} />
            </button>
          ))}

          {/* Mode IA */}
          <div className="border-t border-white/20 pt-3 mt-3">
            <button className="p-3 rounded-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 hover:shadow-lg hover:shadow-purple-500/50 transition-all animate-pulse">
              <Wand2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* 🟢 BARRE INFÉRIEURE */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-black/50 backdrop-blur">
        <div className="flex items-center gap-3">
          {/* Ajouter média */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            title="Ajouter média"
          >
            <Plus className="w-5 h-5 text-cyan-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  // Ajouter comme background
                  const canvas = canvasRef.current;
                  if (canvas) {
                    canvas.style.backgroundImage = `url(${event.target?.result})`;
                    canvas.style.backgroundSize = 'cover';
                  }
                };
                reader.readAsDataURL(file);
              }
            }}
          />

          {/* Templates IA */}
          <button className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
            Templates
          </button>

          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-full transition-colors"
            title="Annuler"
          >
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-full transition-colors"
            title="Rétablir"
          >
            <RotateCw className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Style global IA */}
        <div className="flex items-center gap-2">
          {globalStyles.map(style => (
            <button
              key={style.id}
              onClick={() => setGlobalStyle(style.id)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                globalStyle === style.id
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🟪 PANNEAU CONTEXTUEL (Bottom Right) */}
      {selected && (
        <div className="fixed bottom-20 right-6 bg-gray-800 border border-white/20 rounded-lg shadow-2xl p-3 space-y-2">
          {selected.type === 'text' && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-white/70">Taille</label>
                <input
                  type="range"
                  min="8"
                  max="72"
                  value={selected.fontSize}
                  onChange={(e) => {
                    const updated = elements.map(el =>
                      el.id === selected.id ? { ...el, fontSize: parseInt(e.target.value) } : el
                    );
                    setElements(updated);
                  }}
                  className="w-32 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/70">Opacité</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selected.opacity}
                  onChange={(e) => {
                    const updated = elements.map(el =>
                      el.id === selected.id ? { ...el, opacity: parseInt(e.target.value) } : el
                    );
                    setElements(updated);
                  }}
                  className="w-32 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-1 pt-2 border-t border-white/10">
            <button
              onClick={duplicateElement}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Dupliquer"
            >
              <Copy className="w-4 h-4 text-white" />
            </button>
            <button className="p-1 hover:bg-white/10 rounded transition-colors" title="Verrouiller">
              <Lock className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={deleteElement}
              className="p-1 hover:bg-red-500/20 rounded transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}

      {/* 🟧 PANNEAU D'OUTILS LATÉRAUX (Panel Slide) */}
      {activeToolPanel === 'text' && (
        <div className="fixed bottom-20 left-6 bg-gray-800 border border-white/20 rounded-lg shadow-2xl p-4 space-y-2 w-56">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Type className="w-4 h-4" /> Texte AI+
          </h3>
          <button
            onClick={addText}
            className="w-full px-3 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm rounded transition-all"
          >
            + Ajouter texte
          </button>
          <div className="space-y-1">
            <label className="text-xs text-white/70">Styles</label>
            <div className="grid grid-cols-2 gap-1">
              {['Tech', 'Néon', 'Scolaire', 'Soft'].map(style => (
                <button
                  key={style}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors"
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeToolPanel === 'stickers' && (
        <div className="fixed bottom-20 left-6 bg-gray-800 border border-white/20 rounded-lg shadow-2xl p-4 space-y-2 w-56">
          <h3 className="text-white font-semibold text-sm flex items-center gap-2">
            <Smile className="w-4 h-4" /> Stickers
          </h3>
          <div className="grid grid-cols-5 gap-1">
            {['😀', '🎓', '💻', '🚀', '⭐', '📚', '🎯', '🔥', '💡', '🎨'].map(emoji => (
              <button
                key={emoji}
                onClick={() => addSticker(emoji)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded text-xl transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

StoryEditor.propTypes = {
  onMediaSave: PropTypes.func,
  onClose: PropTypes.func,
  initialMedia: PropTypes.object,
};

export default StoryEditor;
