import React, { memo } from 'react';
import { X } from 'lucide-react';

/**
 * TextPanel - Extracted text input panel
 * Features: Text input, color, size, font, styling (bold, italic, shadow, align)
 */
const TextPanel = memo(({
  textInput, setTextInput, textColor, setTextColor, fontSize, setFontSize,
  fontFamily, setFontFamily, textBold, setTextBold, textItalic, setTextItalic,
  textShadow, setTextShadow, textAlign, setTextAlign, onAddText, onClose, showLayers
}) => {
  return (
    <>
      {!showLayers && (
        <div className="p-4 space-y-4" data-panel onClick={(e) => e.stopPropagation()}>
          <h3 className="text-white font-bold mb-4">Ajouter Texte</h3>
          
          <div>
            <label className="text-white/80 text-sm mb-2 block">Texte</label>
            <input 
              type="text" 
              placeholder="Votre texte..." 
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="text-white/80 text-sm mb-2 block">Couleur</label>
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-10 rounded cursor-pointer border border-white/20"
                />
                <span className="text-white/60 text-sm font-mono">{textColor}</span>
              </div>
              
              <div className="grid grid-cols-6 gap-2">
                {[
                  { name: 'Blanc', hex: '#FFFFFF' },
                  { name: 'Noir', hex: '#000000' },
                  { name: 'Rouge', hex: '#EF4444' },
                  { name: 'Bleu', hex: '#3B82F6' },
                  { name: 'Vert', hex: '#22C55E' },
                  { name: 'Jaune', hex: '#FBBF24' },
                  { name: 'Rose', hex: '#EC4899' },
                  { name: 'Violet', hex: '#8B5CF6' },
                  { name: 'Cyan', hex: '#06B6D4' },
                  { name: 'Orange', hex: '#F97316' },
                  { name: 'Gris', hex: '#6B7280' },
                  { name: 'Lime', hex: '#84CC16' }
                ].map(color => (
                  <button
                    key={color.hex}
                    onClick={() => setTextColor(color.hex)}
                    className={`w-full h-8 rounded border-2 transition ${
                      textColor === color.hex ? 'border-white' : 'border-white/20 hover:border-white/50'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-white/80 text-sm mb-2 block">Taille: {fontSize}px</label>
            <input 
              type="range" 
              min="12" 
              max="120" 
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <label className="text-white/80 text-sm mb-2 block">Police: {fontFamily}</label>
            <select 
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-blue-400"
            >
              <option value="Arial">Arial (Sans-serif)</option>
              <option value="Georgia">Georgia (Serif)</option>
              <option value="Times New Roman">Times New Roman (Classique)</option>
              <option value="Comic Sans MS">Comic Sans MS (Amusant)</option>
              <option value="Courier New">Courier New (Monospace)</option>
              <option value="Verdana">Verdana (Lisible)</option>
            </select>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            <button onClick={() => setTextBold(!textBold)} className={`p-2 rounded transition ${textBold ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title="Gras">
              <strong>B</strong>
            </button>
            <button onClick={() => setTextItalic(!textItalic)} className={`p-2 rounded transition ${textItalic ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title="Italique">
              <em>I</em>
            </button>
            <button onClick={() => setTextShadow(!textShadow)} className={`p-2 rounded transition ${textShadow ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title="Ombre">
              S
            </button>
            <select value={textAlign} onChange={(e) => setTextAlign(e.target.value)} className="p-2 rounded bg-white/10 text-white text-sm">
              <option value="left">← Gauche</option>
              <option value="center">↕ Centre</option>
              <option value="right">Droite →</option>
            </select>
          </div>

          <div className="bg-white/5 border border-white/10 rounded p-3 mb-2">
            <p style={{
              fontSize: `${Math.min(fontSize, 32)}px`,
              color: textColor,
              fontFamily: fontFamily,
              fontWeight: textBold ? 'bold' : 'normal',
              fontStyle: textItalic ? 'italic' : 'normal',
              textAlign: textAlign,
              margin: 0,
              textShadow: textShadow ? '0 4px 12px rgba(0,0,0,0.8)' : '0 2px 8px rgba(0,0,0,0.5)'
            }}>
              {textInput || 'Aperçu'}
            </p>
          </div>

          <button 
            onClick={onAddText}
            disabled={!textInput.trim()}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-lg transition font-semibold"
          >
            ✓ Valider et Ajouter
          </button>
        </div>
      )}
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.textInput === nextProps.textInput &&
    prevProps.textColor === nextProps.textColor &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.fontFamily === nextProps.fontFamily &&
    prevProps.textBold === nextProps.textBold &&
    prevProps.textItalic === nextProps.textItalic &&
    prevProps.textShadow === nextProps.textShadow &&
    prevProps.textAlign === nextProps.textAlign &&
    prevProps.showLayers === nextProps.showLayers
  );
});

TextPanel.displayName = 'TextPanel';

export default TextPanel;
