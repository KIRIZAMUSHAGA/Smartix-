import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';

/**
 * DrawPanel - Extracted drawing tools panel
 * Features: Pen, Eraser, Line, Circle, Rectangle
 * Color picker, thickness controls
 */
const DrawPanel = memo(({
  drawMode, setDrawMode, drawShape, setDrawShape, drawColor, setDrawColor, drawThickness, setDrawThickness,
  onClose, showLayers
}) => {
  return (
    <>
      {!showLayers && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black to-black/80 border-t border-white/20 p-2 sm:p-4 z-40 rounded-t-2xl max-h-[80vh] sm:max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">🖌️ Outil Dessin</h3>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Drawing modes */}
            <div className="flex gap-1 sm:gap-2 flex-wrap">
              <button 
                onClick={() => { setDrawMode('pen'); setDrawShape(null); }}
                className={`flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base ${drawMode === 'pen' && !drawShape ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              >
                🖌️ Pinceau
              </button>
              <button 
                onClick={() => setDrawMode('eraser')}
                className={`flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base ${drawMode === 'eraser' ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              >
                🧹 Gomme
              </button>
              <button 
                onClick={() => { setDrawMode('pen'); setDrawShape('line'); }}
                className={`flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base ${drawShape === 'line' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              >
                📏 Ligne
              </button>
              <button 
                onClick={() => { setDrawMode('pen'); setDrawShape('circle'); }}
                className={`flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base ${drawShape === 'circle' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              >
                ⭕ Cercle
              </button>
              <button 
                onClick={() => { setDrawMode('pen'); setDrawShape('rectangle'); }}
                className={`flex-1 min-w-[60px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition text-sm sm:text-base ${drawShape === 'rectangle' ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              >
                ▭ Rect
              </button>
            </div>

            {/* Color and thickness controls */}
            {drawMode === 'pen' && (
              <div>
                <label className="text-white/80 text-sm mb-2 block">Couleur du Pinceau</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    value={drawColor}
                    onChange={(e) => setDrawColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer border border-white/20"
                  />
                  <div className="flex gap-1">
                    {['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setDrawColor(color)}
                        className={`w-6 h-6 rounded border-2 transition ${drawColor === color ? 'border-white' : 'border-white/30 hover:border-white/60'}`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Thickness control */}
            {drawMode === 'pen' && !drawShape && (
              <div>
                <label className="text-white/80 text-sm">Épaisseur: {drawThickness}px</label>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  value={drawThickness}
                  onChange={(e) => setDrawThickness(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if these change
  return (
    prevProps.drawMode === nextProps.drawMode &&
    prevProps.drawShape === nextProps.drawShape &&
    prevProps.drawColor === nextProps.drawColor &&
    prevProps.drawThickness === nextProps.drawThickness &&
    prevProps.showLayers === nextProps.showLayers
  );
});

DrawPanel.propTypes = {
  drawMode: PropTypes.string,
  setDrawMode: PropTypes.func,
  drawShape: PropTypes.string,
  setDrawShape: PropTypes.func,
  drawColor: PropTypes.string,
  setDrawColor: PropTypes.func,
  drawThickness: PropTypes.number,
  setDrawThickness: PropTypes.func,
  onClose: PropTypes.func,
  showLayers: PropTypes.bool
};

DrawPanel.displayName = 'DrawPanel';

export default DrawPanel;
