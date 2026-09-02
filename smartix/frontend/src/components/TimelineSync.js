/**
 * 🎬 Timeline Synchronisation
 * Permet de synchroniser les éléments avec la musique
 * Persistence: localStorage + Redux reducer
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Clock } from 'lucide-react';
import PropTypes from 'prop-types';

const TimelineSync = ({ elements, activeMusic, onUpdateElement, dispatch, editorActions }) => {
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [timestamps, setTimestamps] = useState({});

  // Persist timestamps to BOTH localStorage AND Redux
  useEffect(() => {
    localStorage.setItem(`timeline_${activeMusic?.id || 'default'}`, JSON.stringify(timestamps));
    
    // Also persist to Redux if dispatch is available
    if (dispatch && editorActions?.SET_ELEMENT_TIMESTAMP && Object.keys(timestamps).length > 0) {
      Object.entries(timestamps).forEach(([elementId, timestamp]) => {
        dispatch({
          type: editorActions.SET_ELEMENT_TIMESTAMP,
          payload: { elementId, timestamp }
        });
      });
    }
  }, [timestamps, activeMusic?.id, dispatch, editorActions]);

  // Load timestamps from localStorage on mount
  useEffect(() => {
    if (activeMusic?.id) {
      const saved = localStorage.getItem(`timeline_${activeMusic.id}`);
      if (saved) {
        try {
          setTimestamps(JSON.parse(saved));
        } catch (e) {
          console.warn('Failed to load timeline timestamps:', e);
        }
      }
    }
  }, [activeMusic?.id]);

  const handleAddTimestamp = useCallback((elementId, time) => {
    const newTimestamps = { ...timestamps, [elementId]: time };
    setTimestamps(newTimestamps);
    
    // Update element with timestamp
    const element = elements.find(el => el.id === elementId);
    if (element && onUpdateElement) {
      onUpdateElement({
        ...element,
        appearAt: time
      });
    }
  }, [elements, onUpdateElement, timestamps]);

  if (!activeMusic) {
    return (
      <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-center">
        <p className="text-white/60 text-xs">Sélectionnez une musique pour synchroniser</p>
      </div>
    );
  }

  const musicDuration = activeMusic.duration || 60;
  const timelineWidth = 300;
  const pixelsPerSecond = timelineWidth / musicDuration;

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Synchronisation</span>
        </div>
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="text-xs px-2 py-1 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 rounded transition"
        >
          {showTimeline ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {showTimeline && (
        <div className="space-y-3">
          {/* Timeline visual */}
          <div className="bg-black/50 rounded p-2 border border-white/10">
            <div className="relative" style={{ width: `${timelineWidth}px`, height: '40px' }}>
              {/* Timeline background */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded" />
              
              {/* Markers every 5 seconds */}
              {Array.from({ length: Math.ceil(musicDuration / 5) }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-white/10"
                  style={{ left: `${(i * 5 * pixelsPerSecond)}px` }}
                >
                  <span className="text-xs text-white/40 ml-1">{i * 5}s</span>
                </div>
              ))}

              {/* Element timestamps */}
              {elements.map((el) => {
                const appearAt = timestamps[el.id] || el.appearAt || 0;
                return (
                  <button
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className="absolute top-1/2 transform -translate-y-1/2 bg-purple-500/60 hover:bg-purple-500 px-2 py-1 rounded text-xs text-white transition"
                    style={{ left: `${appearAt * pixelsPerSecond}px` }}
                    title={`${el.id} @ ${appearAt}s`}
                  >
                    {appearAt.toFixed(1)}s
                  </button>
                );
              })}
            </div>
          </div>

          {/* Element time controls */}
          <div className="space-y-2">
            {elements.map(el => (
              <div key={el.id} className="flex items-center gap-2 bg-white/5 p-2 rounded">
                <input
                  type="range"
                  min="0"
                  max={musicDuration}
                  step="0.1"
                  value={timestamps[el.id] || el.appearAt || 0}
                  onChange={(e) => handleAddTimestamp(el.id, parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-white/20 rounded accent-purple-500"
                />
                <span className="text-xs text-white/60 min-w-fit">
                  {(timestamps[el.id] || el.appearAt || 0).toFixed(1)}s
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-white/40">
            💡 Tip: Glissez pour synchroniser l'apparition de chaque élément avec la musique
          </p>
        </div>
      )}
    </div>
  );
};

TimelineSync.propTypes = {
  elements: PropTypes.array.isRequired,
  activeMusic: PropTypes.any.isRequired,
  onUpdateElement: PropTypes.func.isRequired,
  dispatch: PropTypes.any.isRequired,
  editorActions: PropTypes.any.isRequired,
};

export default TimelineSync;
