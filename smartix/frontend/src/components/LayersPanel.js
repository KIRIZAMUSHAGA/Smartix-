import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Eye, EyeOff } from 'lucide-react';
import PropTypes from 'prop-types';

/**
 * LayersPanel - Manage z-index and element visibility
 * Replaces the need for manual z-index tweaking
 */
const LayersPanel = ({ elements, layerOrder, selectedElement, onSelectElement, onReorderElement, onDeleteElement, onToggleVisibility }) => {
  // Build visible order from layerOrder
  const orderedElements = layerOrder
    .map(id => elements.find(el => el.id === id))
    .filter(el => el != null);

  const getElementLabel = (element) => {
    if (element.type === 'text') return `Text: "${element.content?.substring(0, 20) || 'Untitled'}..."`;
    if (element.type === 'sticker') return `Sticker: ${element.content?.split('/').pop()?.split('.')[0] || 'Sticker'}`;
    if (element.type === 'drawing') return 'Drawing';
    if (element.type === 'image') return 'Image';
    return `${element.type || 'Element'}`;
  };

  return (
    <div className="md:w-1/4 md:border-l md:border-white/10 md:bg-black/80 md:overflow-y-auto p-4 space-y-2">
      <h3 className="text-white font-bold mb-4 text-lg">🎬 Calques ({orderedElements.length})</h3>
      
      {orderedElements.length === 0 ? (
        <p className="text-white/60 text-sm">Aucun élément ajouté</p>
      ) : (
        <div className="space-y-1">
          {orderedElements.map((element, idx) => (
            <div
              key={element.id}
              onClick={() => onSelectElement(element.id)}
              className={`p-3 rounded-lg cursor-pointer transition flex items-center justify-between ${
                selectedElement === element.id
                  ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border border-cyan-400'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {getElementLabel(element)}
                </p>
                <p className="text-white/50 text-xs">z: {orderedElements.length - idx}</p>
              </div>

              <div className="flex gap-1 ml-2">
                {/* Visibility toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility?.(element.id);
                  }}
                  className="p-1 hover:bg-white/10 rounded transition"
                  title={element.opacity > 0 ? 'Masquer' : 'Afficher'}
                >
                  {element.opacity > 0 ? (
                    <Eye className="w-4 h-4 text-white/70" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-white/40" />
                  )}
                </button>

                {/* Move up */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx < orderedElements.length - 1) {
                      onReorderElement(element.id, 'up');
                    }
                  }}
                  disabled={idx >= orderedElements.length - 1}
                  className="p-1 hover:bg-white/10 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Avant"
                >
                  <ChevronUp className="w-4 h-4 text-white" />
                </button>

                {/* Move down */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx > 0) {
                      onReorderElement(element.id, 'down');
                    }
                  }}
                  disabled={idx <= 0}
                  className="p-1 hover:bg-white/10 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Arrière"
                >
                  <ChevronDown className="w-4 h-4 text-white" />
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteElement(element.id);
                  }}
                  className="p-1 hover:bg-red-500/20 rounded transition"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-white/10">
        <p className="text-white/60 text-xs text-center">
          Haut = Avant | Bas = Arrière
        </p>
      </div>
    </div>
  );
};

LayersPanel.propTypes = {
  elements: PropTypes.array.isRequired,
  layerOrder: PropTypes.any.isRequired,
  selectedElement: PropTypes.any.isRequired,
  onSelectElement: PropTypes.func.isRequired,
  onReorderElement: PropTypes.func.isRequired,
  onDeleteElement: PropTypes.func.isRequired,
  onToggleVisibility: PropTypes.func.isRequired,
};

export default LayersPanel;
