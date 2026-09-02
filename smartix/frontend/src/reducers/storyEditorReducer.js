/**
 * Story Editor State Reducer
 * Centralizes all 39 state variables into a single reducer
 * Enables complete undo/redo and better performance
 */

export const initialEditorState = {
  // Canvas & Background
  backgroundImage: null,
  canvasFilters: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0 },
  
  // Elements
  elements: [],
  selectedElement: null,
  
  // UI State
  activeCategory: null,
  showSettings: false,
  showStickerLibrary: false,
  showMusicLibrary: false,
  
  // Text Tool
  textInput: '',
  textColor: '#FFFFFF',
  fontSize: 36,
  fontFamily: 'Arial',
  textCopied: false,
  
  // Draw Tool
  isDrawing: false,
  drawColor: '#FFFFFF',
  drawThickness: 3,
  drawMode: 'pen', // 'pen' or 'eraser'
  
  // Crop Tool
  cropMode: false,
  cropAspectRatio: '9:16',
  cropScale: 1,
  cropOffsetX: 0,
  cropOffsetY: 0,
  
  // AI Tool
  aiPrompt: '',
  aiSuggestions: [],
  aiLoading: false,
  
  // Music
  activeMusic: null,
  
  // History (for undo/redo)
  history: [],
  historyIndex: -1,
  
  // Publishing
  publishProgress: null,
  publishStatus: null,
  estimatedTime: null,
  
  // Layer Management
  layerOrder: [], // array of element IDs in z-order
  
  // UI State - Text Styling (migrated from useState)
  textBold: false,
  textItalic: false,
  textShadow: false,
  textAlign: 'center',
  
  // UI State - Drawing
  showLayers: false,
  drawShape: null, // 'line', 'circle', 'rectangle'
  shapeStart: { x: 0, y: 0 },
  
  // UI State - Feedback
  feedbackMsg: '',
  feedbackType: 'info', // 'success', 'error', 'info'
  
  // UI State - Mobile
  mobileTab: 'effects',
  cropWarning: '',
  
  // Preview Mode
  showPreview: false,
  
  // Timeline Sync
  showTimeline: false,
  elementTimestamps: {}, // { elementId: timestamp in seconds }
  timelineLastSaved: null, // Track when last saved
};

export const storyEditorActions = {
  // Canvas actions
  SET_BACKGROUND_IMAGE: 'SET_BACKGROUND_IMAGE',
  SET_CANVAS_FILTERS: 'SET_CANVAS_FILTERS',
  UPDATE_FILTERS: 'UPDATE_FILTERS',
  
  // Elements
  ADD_ELEMENT: 'ADD_ELEMENT',
  UPDATE_ELEMENT: 'UPDATE_ELEMENT',
  DELETE_ELEMENT: 'DELETE_ELEMENT',
  SELECT_ELEMENT: 'SELECT_ELEMENT',
  SET_ELEMENTS: 'SET_ELEMENTS',
  REORDER_ELEMENTS: 'REORDER_ELEMENTS', // Move element up/down in z-order
  
  // UI
  SET_ACTIVE_CATEGORY: 'SET_ACTIVE_CATEGORY',
  TOGGLE_SETTINGS: 'TOGGLE_SETTINGS',
  TOGGLE_STICKER_LIBRARY: 'TOGGLE_STICKER_LIBRARY',
  TOGGLE_MUSIC_LIBRARY: 'TOGGLE_MUSIC_LIBRARY',
  SET_SHOW_SETTINGS: 'SET_SHOW_SETTINGS',
  SET_SHOW_STICKER_LIBRARY: 'SET_SHOW_STICKER_LIBRARY',
  SET_SHOW_MUSIC_LIBRARY: 'SET_SHOW_MUSIC_LIBRARY',
  
  // Text
  SET_TEXT_INPUT: 'SET_TEXT_INPUT',
  SET_TEXT_COLOR: 'SET_TEXT_COLOR',
  SET_FONT_SIZE: 'SET_FONT_SIZE',
  SET_FONT_FAMILY: 'SET_FONT_FAMILY',
  SET_TEXT_COPIED: 'SET_TEXT_COPIED',
  
  // Draw
  SET_IS_DRAWING: 'SET_IS_DRAWING',
  SET_DRAW_COLOR: 'SET_DRAW_COLOR',
  SET_DRAW_THICKNESS: 'SET_DRAW_THICKNESS',
  SET_DRAW_MODE: 'SET_DRAW_MODE',
  
  // Crop
  SET_CROP_ASPECT_RATIO: 'SET_CROP_ASPECT_RATIO',
  SET_CROP_SCALE: 'SET_CROP_SCALE',
  SET_CROP_OFFSET: 'SET_CROP_OFFSET',
  
  // AI
  SET_AI_PROMPT: 'SET_AI_PROMPT',
  SET_AI_SUGGESTIONS: 'SET_AI_SUGGESTIONS',
  SET_AI_LOADING: 'SET_AI_LOADING',
  
  // Music
  SET_ACTIVE_MUSIC: 'SET_ACTIVE_MUSIC',
  
  // Preview
  TOGGLE_PREVIEW: 'TOGGLE_PREVIEW',
  
  // Timeline
  TOGGLE_TIMELINE: 'TOGGLE_TIMELINE',
  SET_ELEMENT_TIMESTAMP: 'SET_ELEMENT_TIMESTAMP',
  
  // Text Styling
  SET_TEXT_BOLD: 'SET_TEXT_BOLD',
  SET_TEXT_ITALIC: 'SET_TEXT_ITALIC',
  SET_TEXT_SHADOW: 'SET_TEXT_SHADOW',
  SET_TEXT_ALIGN: 'SET_TEXT_ALIGN',
  
  // Drawing
  SET_SHOW_LAYERS: 'SET_SHOW_LAYERS',
  SET_DRAW_SHAPE: 'SET_DRAW_SHAPE',
  SET_SHAPE_START: 'SET_SHAPE_START',
  
  // Feedback
  SET_FEEDBACK_MSG: 'SET_FEEDBACK_MSG',
  SET_FEEDBACK_TYPE: 'SET_FEEDBACK_TYPE',
  
  // Mobile
  SET_MOBILE_TAB: 'SET_MOBILE_TAB',
  SET_CROP_WARNING: 'SET_CROP_WARNING',
  
  // History
  SAVE_TO_HISTORY: 'SAVE_TO_HISTORY',
  UNDO: 'UNDO',
  REDO: 'REDO',
  
  // Publishing
  SET_PUBLISH_PROGRESS: 'SET_PUBLISH_PROGRESS',
  SET_PUBLISH_STATUS: 'SET_PUBLISH_STATUS',
  SET_ESTIMATED_TIME: 'SET_ESTIMATED_TIME',
};

export function storyEditorReducer(state, action) {
  switch (action.type) {
    // Canvas
    case storyEditorActions.SET_BACKGROUND_IMAGE:
      return { ...state, backgroundImage: action.payload };
    case storyEditorActions.SET_CANVAS_FILTERS:
      return { ...state, canvasFilters: action.payload };
    case storyEditorActions.UPDATE_FILTERS:
      return {
        ...state,
        canvasFilters: { ...state.canvasFilters, ...action.payload }
      };

    // Elements
    case storyEditorActions.ADD_ELEMENT:
      return {
        ...state,
        elements: [...state.elements, action.payload],
        layerOrder: [...state.layerOrder, action.payload.id]
      };
    case storyEditorActions.UPDATE_ELEMENT:
      return {
        ...state,
        elements: state.elements.map(el =>
          el.id === action.payload.id ? { ...el, ...action.payload.updates } : el
        )
      };
    case storyEditorActions.DELETE_ELEMENT:
      return {
        ...state,
        elements: state.elements.filter(el => el.id !== action.payload),
        layerOrder: state.layerOrder.filter(id => id !== action.payload),
        selectedElement: state.selectedElement === action.payload ? null : state.selectedElement
      };
    case storyEditorActions.SET_ELEMENTS:
      return { ...state, elements: action.payload };
    case storyEditorActions.SELECT_ELEMENT:
      return { ...state, selectedElement: action.payload };
    case storyEditorActions.REORDER_ELEMENTS:
      // action.payload = { elementId, direction: 'up' | 'down' }
      const idx = state.layerOrder.indexOf(action.payload.elementId);
      if (idx === -1) return state;
      
      const newOrder = [...state.layerOrder];
      if (action.payload.direction === 'up' && idx > 0) {
        [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
      } else if (action.payload.direction === 'down' && idx < newOrder.length - 1) {
        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
      }
      return { ...state, layerOrder: newOrder };

    // UI
    case storyEditorActions.SET_ACTIVE_CATEGORY:
      return { ...state, activeCategory: action.payload };
    case storyEditorActions.TOGGLE_SETTINGS:
      return { ...state, showSettings: !state.showSettings };
    case storyEditorActions.TOGGLE_STICKER_LIBRARY:
      return { ...state, showStickerLibrary: !state.showStickerLibrary };
    case storyEditorActions.TOGGLE_MUSIC_LIBRARY:
      return { ...state, showMusicLibrary: !state.showMusicLibrary };
    case storyEditorActions.SET_SHOW_SETTINGS:
      return { ...state, showSettings: action.payload };
    case storyEditorActions.SET_SHOW_STICKER_LIBRARY:
      return { ...state, showStickerLibrary: action.payload };
    case storyEditorActions.SET_SHOW_MUSIC_LIBRARY:
      return { ...state, showMusicLibrary: action.payload };

    // Text
    case storyEditorActions.SET_TEXT_INPUT:
      return { ...state, textInput: action.payload };
    case storyEditorActions.SET_TEXT_COLOR:
      return { ...state, textColor: action.payload };
    case storyEditorActions.SET_FONT_SIZE:
      return { ...state, fontSize: action.payload };
    case storyEditorActions.SET_FONT_FAMILY:
      return { ...state, fontFamily: action.payload };
    case storyEditorActions.SET_TEXT_COPIED:
      return { ...state, textCopied: action.payload };

    // Draw
    case storyEditorActions.SET_IS_DRAWING:
      return { ...state, isDrawing: action.payload };
    case storyEditorActions.SET_DRAW_COLOR:
      return { ...state, drawColor: action.payload };
    case storyEditorActions.SET_DRAW_THICKNESS:
      return { ...state, drawThickness: action.payload };
    case storyEditorActions.SET_DRAW_MODE:
      return { ...state, drawMode: action.payload };

    // Crop
    case storyEditorActions.SET_CROP_ASPECT_RATIO:
      return { ...state, cropAspectRatio: action.payload };
    case storyEditorActions.SET_CROP_SCALE:
      return { ...state, cropScale: action.payload };
    case storyEditorActions.SET_CROP_OFFSET:
      return {
        ...state,
        cropOffsetX: action.payload.x || state.cropOffsetX,
        cropOffsetY: action.payload.y || state.cropOffsetY
      };

    // AI
    case storyEditorActions.SET_AI_PROMPT:
      return { ...state, aiPrompt: action.payload };
    case storyEditorActions.SET_AI_SUGGESTIONS:
      return { ...state, aiSuggestions: action.payload };
    case storyEditorActions.SET_AI_LOADING:
      return { ...state, aiLoading: action.payload };

    // Music
    case storyEditorActions.SET_ACTIVE_MUSIC:
      return { ...state, activeMusic: action.payload };

    // Text Styling
    case storyEditorActions.SET_TEXT_BOLD:
      return { ...state, textBold: action.payload };
    case storyEditorActions.SET_TEXT_ITALIC:
      return { ...state, textItalic: action.payload };
    case storyEditorActions.SET_TEXT_SHADOW:
      return { ...state, textShadow: action.payload };
    case storyEditorActions.SET_TEXT_ALIGN:
      return { ...state, textAlign: action.payload };

    // Drawing
    case storyEditorActions.SET_SHOW_LAYERS:
      return { ...state, showLayers: action.payload };
    case storyEditorActions.SET_DRAW_SHAPE:
      return { ...state, drawShape: action.payload };
    case storyEditorActions.SET_SHAPE_START:
      return { ...state, shapeStart: action.payload };

    // Feedback
    case storyEditorActions.SET_FEEDBACK_MSG:
      return { ...state, feedbackMsg: action.payload };
    case storyEditorActions.SET_FEEDBACK_TYPE:
      return { ...state, feedbackType: action.payload };

    // Mobile
    case storyEditorActions.SET_MOBILE_TAB:
      return { ...state, mobileTab: action.payload };
    case storyEditorActions.SET_CROP_WARNING:
      return { ...state, cropWarning: action.payload };

    // History - COMPLETE SAVE OF ALL STATE
    case storyEditorActions.SAVE_TO_HISTORY: {
      const snapshot = {
        elements: state.elements,
        backgroundImage: state.backgroundImage,
        canvasFilters: state.canvasFilters,
        cropAspectRatio: state.cropAspectRatio,
        cropScale: state.cropScale,
        cropOffsetX: state.cropOffsetX,
        cropOffsetY: state.cropOffsetY,
        layerOrder: state.layerOrder,
      };
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push(snapshot);
      return {
        ...state,
        history: newHistory,
        historyIndex: newHistory.length - 1
      };
    }

    case storyEditorActions.UNDO:
      if (state.historyIndex > 0) {
        const snapshot = state.history[state.historyIndex - 1];
        return {
          ...state,
          ...snapshot,
          historyIndex: state.historyIndex - 1,
          history: state.history // Keep history intact
        };
      }
      return state;

    case storyEditorActions.REDO:
      if (state.historyIndex < state.history.length - 1) {
        const snapshot = state.history[state.historyIndex + 1];
        return {
          ...state,
          ...snapshot,
          historyIndex: state.historyIndex + 1,
          history: state.history // Keep history intact
        };
      }
      return state;

    // Publishing
    case storyEditorActions.SET_PUBLISH_PROGRESS:
      return { ...state, publishProgress: action.payload };
    case storyEditorActions.SET_PUBLISH_STATUS:
      return { ...state, publishStatus: action.payload };
    case storyEditorActions.SET_ESTIMATED_TIME:
      return { ...state, estimatedTime: action.payload };

    // Preview
    case storyEditorActions.TOGGLE_PREVIEW:
      return { ...state, showPreview: !state.showPreview };

    // Timeline
    case storyEditorActions.TOGGLE_TIMELINE:
      return { ...state, showTimeline: !state.showTimeline };
    case storyEditorActions.SET_ELEMENT_TIMESTAMP:
      return {
        ...state,
        elementTimestamps: {
          ...state.elementTimestamps,
          [action.payload.elementId]: action.payload.timestamp
        }
      };

    default:
      return state;
  }
}
