import React, { useState, useRef, useEffect, useCallback, memo, useReducer, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { 
  ArrowLeft, Play, Pause, Type, Sticker, Music, Sparkles, Camera,
  X, Loader2, Undo2, Redo2, CloudOff, Languages, Rocket, AlertCircle,
  Volume2, Waveform, Film, Palette, Zap, Target, Crown, VolumeX
} from 'lucide-react';
import { toast } from 'sonner';
import LZString from 'lz-string';

import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';

// =============================
// IMPORTS DES COMPOSANTS (CORRIGÉS)
// =============================
import AdvancedTextEditor from '../components/AdvancedTextEditor';
import StickerPicker from '../components/StickerPickerLibrary';
import MusicLibrary from '../components/MusicLibrary';
import VideoEffects from '../components/VideoEffects';
import AdvancedPreview from '../components/AdvancedPreview';

// =============================
// STYLES CSS
// =============================

import '../components/SmartClipsStudio.css';
import PropTypes from 'prop-types';
// =============================
// TYPES STRICTS
// =============================












// =============================
// CONSTANTES
// =============================
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const API_BASE = '/smartclips/v2/studio';
const FPS = 30;
const RESOLUTION = { width: 1080, height: 1920 };
const AUTO_SAVE_KEY = 'smartclips_studio_autosave';
const AUTO_SAVE_SCHEMA_VERSION = 1;
const AUTO_SAVE_DELAY = 10000;
const MAX_HISTORY = 30;
const MAX_CACHE_SIZE = 50;
const MAX_AUDIO_CACHE = 10;

// =============================
// IMAGE CACHE
// =============================
class ImageCache {
  static cache = new Map();
  static loading = new Map();
  static maxSize = MAX_CACHE_SIZE;

  static cleanup() {
    if (this.cache.size <= this.maxSize) return;
    const sorted = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = sorted.slice(0, this.cache.size - this.maxSize);
    toDelete.forEach(([url]) => this.cache.delete(url));
  }

  static async get(url) {
    const cached = this.cache.get(url);
    if (cached) {
      cached.timestamp = Date.now();
      return cached.img;
    }
    if (this.loading.has(url)) return this.loading.get(url);

    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(url, { img, timestamp: Date.now() });
        this.loading.delete(url);
        this.cleanup();
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
    this.loading.set(url, promise);
    return promise;
  }

  static getSync(url) {
    return this.cache.get(url)?.img || null;
  }

  static clear() {
    this.cache.clear();
    this.loading.clear();
  }
}

// =============================
// AUDIO MANAGER
// =============================
class AudioManager {
  audioElements = new Map();
  activeAudios = new Set();
  currentTime = 0;
  isPlaying = false;
  audioContext = null;
  gainNodes = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window).webkitAudioContext)();
    }
  }

  addAudio(clipId, url, volume = 0.8) {
    if (this.audioElements.has(clipId)) return;
    const audio = new Audio(url);
    audio.loop = false;
    audio.volume = volume;
    audio.preload = 'auto';
    
    if (this.audioContext) {
      const track = this.audioContext.createMediaElementSource(audio);
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;
      track.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      this.gainNodes.set(clipId, gainNode);
    }
    this.audioElements.set(clipId, audio);
  }

  removeAudio(clipId) {
    const audio = this.audioElements.get(clipId);
    if (audio) {
      audio.pause();
      audio.src = '';
      this.activeAudios.delete(clipId);
      this.audioElements.delete(clipId);
    }
    this.gainNodes.delete(clipId);
  }

  setVolume(clipId, volume) {
    const gainNode = this.gainNodes.get(clipId);
    if (gainNode) gainNode.gain.value = volume;
    else {
      const audio = this.audioElements.get(clipId);
      if (audio) audio.volume = volume;
    }
  }

  sync(time, activeClips) {
    this.currentTime = time;
    const shouldBeActive = new Set();
    activeClips.forEach(clip => {
      if (clip.type === 'audio') {
        const audioData = clip.data;
        const isInRange = time >= clip.start && time <= clip.end;
        if (isInRange) {
          shouldBeActive.add(clip.id);
          const audio = this.audioElements.get(clip.id);
          if (audio && !this.activeAudios.has(clip.id)) {
            const relativeTime = Math.max(0, time - clip.start);
            audio.currentTime = Math.min(relativeTime, audio.duration);
            if (this.isPlaying) audio.play();
            this.activeAudios.add(clip.id);
          }
        }
      }
    });
    this.activeAudios.forEach(id => {
      if (!shouldBeActive.has(id)) {
        const audio = this.audioElements.get(id);
        if (audio) {
          audio.pause();
          this.activeAudios.delete(id);
        }
      }
    });
  }

  play() {
    this.isPlaying = true;
    if (this.audioContext?.state === 'suspended') this.audioContext.resume();
    this.activeAudios.forEach(id => {
      const audio = this.audioElements.get(id);
      if (audio && audio.paused) audio.play().catch(e => console.warn('Audio play failed:', e));
    });
  }

  pause() {
    this.isPlaying = false;
    this.activeAudios.forEach(id => {
      const audio = this.audioElements.get(id);
      if (audio && !audio.paused) audio.pause();
    });
  }

  seek(time, activeClips) {
    this.pause();
    this.activeAudios.clear();
    this.sync(time, activeClips);
    if (this.isPlaying) this.play();
  }

  destroy() {
    this.pause();
    this.audioElements.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.audioElements.clear();
    this.activeAudios.clear();
    this.gainNodes.clear();
    if (this.audioContext) this.audioContext.close();
  }

  cleanup() {
    if (this.audioElements.size > MAX_AUDIO_CACHE) {
      const toRemove = [...this.audioElements.keys()].slice(0, this.audioElements.size - MAX_AUDIO_CACHE);
      toRemove.forEach(id => this.removeAudio(id));
    }
  }
}

// =============================
// INTERVAL TREE
// =============================
class IntervalTreeNode {
  center;
  left = null;
  right = null;
  startOverlap = [];
  endOverlap = [];

  constructor(clips) {
    if (clips.length === 0) {
      this.center = 0;
      return;
    }
    const sorted = [...clips].sort((a, b) => a.start - b.start);
    this.center = sorted[Math.floor(sorted.length / 2)].start;
    const leftClips = [];
    const rightClips = [];
    for (const clip of clips) {
      if (clip.end < this.center) leftClips.push(clip);
      else if (clip.start > this.center) rightClips.push(clip);
      else {
        this.startOverlap.push(clip);
        this.endOverlap.push(clip);
      }
    }
    this.startOverlap.sort((a, b) => a.start - b.start);
    this.endOverlap.sort((a, b) => a.end - b.end);
    if (leftClips.length > 0) this.left = new IntervalTreeNode(leftClips);
    if (rightClips.length > 0) this.right = new IntervalTreeNode(rightClips);
  }

  query(time, result = []) {
    for (const clip of this.startOverlap) {
      if (clip.start <= time && clip.end >= time) result.push(clip);
    }
    if (time < this.center && this.left) this.left.query(time, result);
    else if (time > this.center && this.right) this.right.query(time, result);
    return result;
  }
}

class IntervalTree {
  root = null;
  clipsMap = new Map();

  build(clips) {
    this.clipsMap.clear();
    clips.forEach(clip => this.clipsMap.set(clip.id, clip));
    if (clips.length === 0) this.root = null;
    else this.root = new IntervalTreeNode(clips);
  }

  addClip(clip) {
    this.clipsMap.set(clip.id, clip);
    this.build(Array.from(this.clipsMap.values()));
  }

  removeClip(clipId) {
    this.clipsMap.delete(clipId);
    this.build(Array.from(this.clipsMap.values()));
  }

  updateClip(clipId, updates) {
    const existing = this.clipsMap.get(clipId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.clipsMap.set(clipId, updated);
      this.build(Array.from(this.clipsMap.values()));
    }
  }

  query(time) {
    if (!this.root) return [];
    return this.root.query(time);
  }

  getSize() {
    return this.clipsMap.size;
  }
}

// =============================
// RENDER ENGINE
// =============================

class RenderEngine {
  canvas;
  ctx;
  videoElement;
  audioManager;
  resolution;
  animationFrame = null;
  isPlaying = false;
  videoTree = new IntervalTree();
  textTree = new IntervalTree();
  stickerTree = new IntervalTree();
  effectTree = new IntervalTree();
  captionTree = new IntervalTree();
  audioTree = new IntervalTree();
  currentTime = 0;
  videoClip = null;
  destroyFlag = false;
  clipsVersion = 0;
  frameCache = null;
  lastRenderTime = 0;
  targetFPS = 30;
  adaptiveFPS = 30;
  frameTimes = [];

  constructor(
    canvas,
    videoElement,
    clips,
    resolution = RESOLUTION
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.videoElement = videoElement;
    this.audioManager = new AudioManager();
    this.resolution = resolution;
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    this.updateClips(clips, 0);
  }

  updateClips(clips, version) {
    if (version <= this.clipsVersion) return;
    this.clipsVersion = version;

    const videos = clips.filter(c => c.type === 'video');
    const texts = clips.filter(c => c.type === 'text');
    const stickers = clips.filter(c => c.type === 'sticker');
    const effects = clips.filter(c => c.type === 'effect');
    const captions = clips.filter(c => c.type === 'caption');
    const audios = clips.filter(c => c.type === 'audio');

    this.videoTree = new IntervalTree();
    this.textTree = new IntervalTree();
    this.stickerTree = new IntervalTree();
    this.effectTree = new IntervalTree();
    this.captionTree = new IntervalTree();
    this.audioTree = new IntervalTree();

    if (videos.length) this.videoTree.build(videos);
    if (texts.length) this.textTree.build(texts);
    if (stickers.length) this.stickerTree.build(stickers);
    if (effects.length) this.effectTree.build(effects);
    if (captions.length) this.captionTree.build(captions);
    if (audios.length) {
      this.audioTree.build(audios);
      audios.forEach(audio => {
        const audioData = audio.data;
        this.audioManager.addAudio(audio.id, audioData.url, audioData.volume);
      });
    }
    this.updateVideoClip(this.currentTime);
    this.audioManager.sync(this.currentTime, this.getActiveAudios(this.currentTime));
  }

  getActiveAudios(time) {
    return this.audioTree.query(time);
  }

  updateVideoClip(time) {
    if (this.destroyFlag) return;
    const clips = this.videoTree.query(time);
    this.videoClip = clips[0] || null;
  }

  start() {
    if (this.destroyFlag || this.isPlaying) return;
    this.isPlaying = true;
    this.videoElement.play();
    this.audioManager.play();
    this.renderLoop();
  }

  stop() {
    if (this.destroyFlag) return;
    this.isPlaying = false;
    this.videoElement.pause();
    this.audioManager.pause();
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  seek(time) {
    if (this.destroyFlag) return;
    this.videoElement.currentTime = time;
    this.currentTime = time;
    this.updateVideoClip(time);
    this.audioManager.seek(time, this.getActiveAudios(time));
    this.renderFrame();
  }

  updateAdaptiveFPS() {
    const now = performance.now();
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    if (this.lastRenderTime) {
      const frameTime = now - this.lastRenderTime;
      this.frameTimes.push(frameTime);
      const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      const fps = 1000 / avgFrameTime;
      if (fps < 24) this.adaptiveFPS = 24;
      else if (fps < 28) this.adaptiveFPS = 28;
      else this.adaptiveFPS = this.targetFPS;
    }
    this.lastRenderTime = now;
  }

  renderLoop() {
    if (this.destroyFlag || !this.isPlaying) return;
    this.updateAdaptiveFPS();
    this.currentTime = this.videoElement.currentTime;
    this.updateVideoClip(this.currentTime);
    const activeAudios = this.getActiveAudios(this.currentTime);
    this.audioManager.sync(this.currentTime, activeAudios);
    this.renderFrame();
    const frameInterval = 1000 / this.adaptiveFPS;
    setTimeout(() => {
      this.animationFrame = requestAnimationFrame(() => this.renderLoop());
    }, frameInterval);
  }

  renderFrame() {
    if (this.destroyFlag) return;
    const time = this.currentTime;
    const videoClip = this.videoClip;

    if (this.frameCache && Math.abs(this.frameCache.time - time) < 0.033) {
      if (this.frameCache.imageData) {
        this.ctx.putImageData(this.frameCache.imageData, 0, 0);
        return;
      }
    }

    this.ctx.clearRect(0, 0, this.resolution.width, this.resolution.height);

    if (videoClip && this.videoElement.readyState >= 2) {
      const effects = this.effectTree.query(time);
      if (effects.length > 0) {
        effects.forEach(effect => {
          const effectData = effect.data;
          if (effectData.type === 'filter' && effectData.shader) {
            this.ctx.save();
            this.ctx.filter = effectData.shader;
            this.drawVideo();
            this.ctx.restore();
          } else {
            this.drawVideo();
          }
        });
      } else {
        this.drawVideo();
      }
    } else {
      this.drawPlaceholder();
    }

    const stickers = this.stickerTree.query(time);
    stickers.forEach(sticker => this.drawStickerSync(sticker.data));
    const texts = this.textTree.query(time);
    texts.forEach(text => this.drawText(text.data));
    const captions = this.captionTree.query(time);
    captions.forEach(caption => this.drawCaption(caption.data));

    try {
      this.frameCache = {
        time,
        imageData: this.ctx.getImageData(0, 0, this.resolution.width, this.resolution.height)
      };
    } catch (e) {}
  }

  drawVideo() {
    const videoAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
    const canvasAspect = this.resolution.width / this.resolution.height;
    let drawWidth, drawHeight, offsetX, offsetY;
    if (videoAspect > canvasAspect) {
      drawWidth = this.resolution.width;
      drawHeight = this.resolution.width / videoAspect;
      offsetX = 0;
      offsetY = (this.resolution.height - drawHeight) / 2;
    } else {
      drawHeight = this.resolution.height;
      drawWidth = this.resolution.height * videoAspect;
      offsetX = (this.resolution.width - drawWidth) / 2;
      offsetY = 0;
    }
    this.ctx.drawImage(this.videoElement, offsetX, offsetY, drawWidth, drawHeight);
  }

  drawPlaceholder() {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.resolution.width, this.resolution.height);
    this.ctx.fillStyle = '#ffffff40';
    this.ctx.font = '16px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Aucune vidéo', this.resolution.width / 2, this.resolution.height / 2);
  }

  drawStickerSync(sticker) {
    const x = (sticker.position?.x || 50) / 100 * this.resolution.width;
    const y = (sticker.position?.y || 50) / 100 * this.resolution.height;
    const scale = sticker.scale || 1;
    const rotation = sticker.rotation || 0;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation * Math.PI / 180);
    this.ctx.scale(scale, scale);
    if (sticker.content) {
      this.ctx.font = `${40 * scale}px "Segoe UI Emoji"`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(sticker.content, 0, 0);
    } else if (sticker.url) {
      const img = ImageCache.getSync(sticker.url);
      if (img) this.ctx.drawImage(img, -50, -50, 100, 100);
    }
    this.ctx.restore();
  }

  drawText(textData) {
    const x = (textData.style?.position?.x || 50) / 100 * this.resolution.width;
    const y = (textData.style?.position?.y || 50) / 100 * this.resolution.height;
    const fontSize = (textData.style?.fontSize || 32) * (this.resolution.width / 1080);
    this.ctx.save();
    this.ctx.font = `${textData.style?.bold ? 'bold' : ''} ${fontSize}px ${textData.style?.fontFamily || 'Poppins'}`;
    this.ctx.fillStyle = textData.style?.color || '#FFFFFF';
    this.ctx.textAlign = textData.style?.textAlign || 'center';
    this.ctx.textBaseline = 'middle';
    if (textData.style?.strokeWidth && textData.style.strokeWidth > 0) {
      this.ctx.strokeStyle = textData.style?.strokeColor || '#000000';
      this.ctx.lineWidth = textData.style.strokeWidth;
      this.ctx.strokeText(textData.text, x, y);
    }
    if (textData.style?.shadow) {
      this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
      this.ctx.shadowBlur = textData.style?.shadowBlur || 10;
    }
    this.ctx.fillText(textData.text, x, y);
    this.ctx.restore();
  }

  drawCaption(captionData) {
    const y = this.resolution.height - 80;
    const fontSize = 28 * (this.resolution.width / 1080);
    this.ctx.save();
    this.ctx.font = `${fontSize}px Poppins`;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    const textWidth = this.ctx.measureText(captionData.text).width;
    this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    this.ctx.fillRect(this.resolution.width/2 - textWidth/2 - 20, y - fontSize - 10, textWidth + 40, fontSize + 20);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(captionData.text, this.resolution.width/2, y);
    this.ctx.restore();
  }

  setVolume(clipId, volume) {
    this.audioManager.setVolume(clipId, volume);
  }

  destroy() {
    this.destroyFlag = true;
    this.stop();
    this.audioManager.destroy();
    this.frameCache = null;
  }
}

// =============================
// COLLISION DETECTION
// =============================
const checkCollision = (clips, newClip) => {
  return clips.some(clip => 
    clip.id !== newClip.id &&
    clip.trackIndex === newClip.trackIndex &&
    newClip.start < clip.end &&
    newClip.end > clip.start
  );
};

// =============================
// TIMELINE REDUCER
// =============================
const timelineReducer = (state, action) => {
  const shouldSaveHistory = !['UNDO', 'REDO', 'IMPORT'].includes(action.type);
  let newState;

  switch (action.type) {
    case 'ADD_CLIP': {
      const { type, start, end, data, trackId, trackIndex = 0 } = action.payload;
      const newClip = {
        id: nanoid(),
        type,
        start,
        end,
        duration: end - start,
        data,
        trackId: trackId || `${type}_${Date.now()}`,
        trackIndex
      };
      const trackKey = `${type}s`;
      const existingClips = state.tracks[trackKey];
      if (checkCollision(existingClips, newClip)) {
        toast.error('Collision avec un autre clip');
        return state;
      }
      newState = {
        ...state,
        tracks: { ...state.tracks, [trackKey]: [...existingClips, newClip].sort((a, b) => a.start - b.start) },
        version: state.version + 1
      };
      break;
    }
    case 'MOVE_CLIP': {
      const { type, clipId, newStart } = action.payload;
      const trackKey = `${type}s`;
      const clip = state.tracks[trackKey].find((c) => c.id === clipId);
      if (!clip) return state;
      const movedClip = { ...clip, start: newStart, end: newStart + clip.duration };
      const otherClips = state.tracks[trackKey].filter((c) => c.id !== clipId);
      if (checkCollision(otherClips, movedClip)) {
        toast.error('Collision détectée');
        return state;
      }
      newState = {
        ...state,
        tracks: { ...state.tracks, [trackKey]: [...otherClips, movedClip].sort((a, b) => a.start - b.start) },
        version: state.version + 1
      };
      break;
    }
    case 'RESIZE_CLIP': {
      const { type, clipId, newEnd } = action.payload;
      const trackKey = `${type}s`;
      const clip = state.tracks[trackKey].find((c) => c.id === clipId);
      if (!clip) return state;
      const resizedClip = { ...clip, end: newEnd, duration: newEnd - clip.start };
      const otherClips = state.tracks[trackKey].filter((c) => c.id !== clipId);
      if (checkCollision(otherClips, resizedClip)) {
        toast.error('Collision détectée');
        return state;
      }
      newState = {
        ...state,
        tracks: { ...state.tracks, [trackKey]: [...otherClips, resizedClip].sort((a, b) => a.start - b.start) },
        version: state.version + 1
      };
      break;
    }
    case 'REMOVE_CLIP': {
      const { type, clipId } = action.payload;
      const trackKey = `${type}s`;
      newState = {
        ...state,
        tracks: { ...state.tracks, [trackKey]: state.tracks[trackKey].filter((c) => c.id !== clipId) },
        version: state.version + 1
      };
      break;
    }
    case 'SET_DURATION': {
      newState = { ...state, duration: action.payload };
      break;
    }
    case 'IMPORT': {
      newState = { ...action.payload, version: state.version + 1 };
      break;
    }
    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const previousState = state.history[state.historyIndex - 1];
      return { ...previousState, history: state.history, historyIndex: state.historyIndex - 1 };
    }
    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const nextState = state.history[state.historyIndex + 1];
      return { ...nextState, history: state.history, historyIndex: state.historyIndex + 1 };
    }
    default:
      return state;
  }

  if (shouldSaveHistory) {
    const { history, historyIndex, ...stateWithoutHistory } = state;
    const newHistory = [...state.history, stateWithoutHistory];
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    return { ...newState, history: newHistory, historyIndex: newHistory.length - 1 };
  }
  return { ...newState, history: state.history, historyIndex: state.historyIndex };
};

const initialState = {
  tracks: { videos: [], audios: [], texts: [], effects: [], captions: [], stickers: [] },
  duration: 0,
  fps: FPS,
  resolution: RESOLUTION,
  version: 0,
  history: [],
  historyIndex: -1
};

// =============================
// AUTO-SAVE
// =============================
const useAutoSave = (timeline, videoId) => {
  const [lastSaved, setLastSaved] = useState(null);
  const timeoutRef = useRef(null);

  const compress = (data) => {
    const json = JSON.stringify(data);
    return LZString.compressToUTF16(json);
  };

  const checkQuota = () => {
    try {
      const testKey = '__quota_test__';
      const testData = 'x'.repeat(5 * 1024 * 1024);
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        toast.error('Stockage local plein. Veuillez libérer de l\'espace.');
        return false;
      }
      return true;
    }
  };

  const saveToLocalStorage = useCallback(() => {
    if (!timeline.version) return;
    if (!checkQuota()) return;
    const autosaveData = {
      schema: AUTO_SAVE_SCHEMA_VERSION,
      timeline: {
        fps: FPS,
        resolution: RESOLUTION,
        tracks: timeline.tracks,
        duration: timeline.duration,
        version: timeline.version
      },
      videoId,
      timestamp: Date.now()
    };
    try {
      const compressed = compress(autosaveData);
      localStorage.setItem(AUTO_SAVE_KEY, compressed);
      setLastSaved(new Date());
    } catch (e) {
      console.error('Autosave failed:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        toast.error('Autosave impossible: stockage plein');
      }
    }
  }, [timeline, videoId]);

  useEffect(() => {
    if (!timeline.version || !videoId) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(saveToLocalStorage, AUTO_SAVE_DELAY);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [timeline, videoId, saveToLocalStorage]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (timeline.version > 0) saveToLocalStorage();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [timeline, saveToLocalStorage]);

  const loadFromLocalStorage = useCallback(() => {
    const saved = localStorage.getItem(AUTO_SAVE_KEY);
    if (saved) {
      try {
        const json = LZString.decompressFromUTF16(saved);
        const data = json ? JSON.parse(json) : null;
        if (data?.schema === AUTO_SAVE_SCHEMA_VERSION) return data;
        else if (data && !data.schema) {
          console.warn('Migrating from legacy autosave format');
          return {
            schema: AUTO_SAVE_SCHEMA_VERSION,
            timeline: { fps: FPS, resolution: RESOLUTION, ...data.timeline },
            videoId,
            timestamp: data.timestamp
          };
        }
        return null;
      } catch (e) {
        console.error('Failed to parse autosave', e);
      }
    }
    return null;
  }, []);

  return { lastSaved, saveToLocalStorage, loadFromLocalStorage };
};

// =============================
// VIDEO IMPORT
// =============================
const useVideoImport = () => {
  const [videoSrc, setVideoSrc] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState(null);

  const importVideo = useCallback((file) => {
    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    const url = URL.createObjectURL(file);
    setVideoBlobUrl(url);
    setVideoSrc(url);
    setVideoFile(file);
  }, [videoBlobUrl]);

  const cleanup = useCallback(() => {
    if (videoBlobUrl) {
      URL.revokeObjectURL(videoBlobUrl);
      setVideoBlobUrl(null);
    }
    setVideoSrc(null);
    setVideoFile(null);
  }, [videoBlobUrl]);

  return { videoSrc, videoFile, importVideo, cleanup };
};

// =============================
// EXPORT
// =============================
const useExport = (client, videoId, videoFile, timeline) => {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const pollJobStatus = async (jobId, retries = 0) => {
    const maxRetries = 5;
    const backoff = Math.min(1000 * Math.pow(2, retries), 30000);
    try {
      const response = await client.get(`${API_BASE}/job/${jobId}/status`);
      const { status, progress: jobProgress } = response.data;
      setProgress(jobProgress);
      if (status === 'completed') {
        toast.success('Vidéo exportée avec succès !');
        return;
      } else if (status === 'error') {
        throw new Error('Export job failed');
      } else {
        await new Promise(resolve => setTimeout(resolve, backoff));
        await pollJobStatus(jobId, retries + 1);
      }
    } catch (error) {
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        await pollJobStatus(jobId, retries + 1);
      } else {
        throw error;
      }
    }
  };

  const exportVideo = useCallback(async () => {
    if (!videoId) {
      toast.error('Importez d\'abord une vidéo');
      return false;
    }
    setExporting(true);
    setProgress(0);
    setError(null);
    const formData = new FormData();
    formData.append('videoId', videoId);
    formData.append('timeline', JSON.stringify({
      version: '1.0',
      fps: FPS,
      resolution: RESOLUTION,
      duration: timeline.duration,
      tracks: timeline.tracks
    }));
    if (videoFile) formData.append('video', videoFile);
    try {
      const response = await client.post(`${API_BASE}/${videoId}/export`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      });
      if (response.data.success && response.data.job_id) {
        await pollJobStatus(response.data.job_id);
        return true;
      }
      return false;
    } catch (err) {
      setError(err.message);
      toast.error('Erreur lors de l\'export');
      return false;
    } finally {
      setExporting(false);
    }
  }, [client, videoId, videoFile, timeline]);

  return { exporting, progress, error, exportVideo };
};

// =============================
// DRAGGABLE TIMELINE
// =============================
const DraggableTimeline = memo(({ timeline, currentTime, onSeek }) => {
  const [zoom, setZoom] = useState(1);
  const timelineRef = useRef(null);
  const pixelsPerSecond = 80 * zoom;
  const totalWidth = timeline.duration * pixelsPerSecond;
  
  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = x / pixelsPerSecond;
    onSeek(Math.min(timeline.duration, Math.max(0, time)));
  }, [pixelsPerSecond, timeline.duration, onSeek]);
  
  const Track = ({ color, clips, label }) => (
    <div className="relative h-10 bg-white/5 rounded-lg overflow-hidden mb-1 group">
      <div className="absolute left-0 top-0 bottom-0 w-7 bg-white/10 flex items-center justify-center text-xs text-white/40">{label}</div>
      <div className="relative ml-7 h-full">
        {clips.map(clip => (
          <div key={clip.id} className="absolute top-0.5 bottom-0.5 rounded cursor-pointer transition-all hover:opacity-100 opacity-70" style={{ left: clip.start * pixelsPerSecond, width: Math.max(2, clip.duration * pixelsPerSecond), backgroundColor: color }} title={clip.type === 'text' ? (clip.data).text : clip.type === 'audio' ? (clip.data).title : clip.type} />
        ))}
        <div className="absolute top-0 bottom-0 w-0.5 bg-[#ff6b35] z-10 pointer-events-none" style={{ left: currentTime * pixelsPerSecond }}><div className="absolute -top-1 -left-1 w-2 h-2 bg-[#ff6b35] rounded-full" /></div>
      </div>
    </div>
  );
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-white/40 text-xs">Timeline</span>
        <div className="flex gap-2">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} className="px-2 py-0.5 bg-white/10 rounded text-xs hover:bg-white/20">-</button>
          <span className="text-white/60 text-xs">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(3, zoom + 0.2))} className="px-2 py-0.5 bg-white/10 rounded text-xs hover:bg-white/20">+</button>
        </div>
      </div>
      <div ref={timelineRef} className="relative overflow-x-auto" style={{ maxHeight: '200px' }} onClick={handleTimelineClick}>
        <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
          <Track color="#ff6b35" clips={timeline.tracks.videos} label="🎬" />
          <Track color="#00B894" clips={timeline.tracks.audios} label="🎵" />
          <Track color="#0984E3" clips={timeline.tracks.texts} label="📝" />
          <Track color="#E84342" clips={timeline.tracks.effects} label="✨" />
          <Track color="#6C5CE7" clips={timeline.tracks.captions} label="💬" />
          <Track color="#FDCB6E" clips={timeline.tracks.stickers} label="🎨" />
        </div>
      </div>
      <div className="flex justify-between text-white/40 text-xs">
        <span>0:00</span>
        <span>{Math.floor(timeline.duration / 60)}:{(timeline.duration % 60).toFixed(0).padStart(2, '0')}</span>
      </div>
    </div>
  );
});

// =============================
// MODAL
// =============================
const Modal = ({ children, onClose, title }) => (
  <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
    <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" />
    <div className="relative w-full lg:w-[600px] bg-[#0A0A0A] rounded-t-[22px] lg:rounded-[22px] max-h-[80vh] overflow-y-auto border border-white/10 animate-slideUp">
      <div className="sticky top-0 bg-[#0A0A0A] p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5 text-white" /></button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

// =============================
// COMPOSANT PRINCIPAL
// =============================
const SmartClipsStudio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();
  
  const [timeline, dispatch] = useReducer(timelineReducer, initialState);
  const [videoId, setVideoId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showStickerLibrary, setShowStickerLibrary] = useState(false);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentTool, setCurrentTool] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const renderEngineRef = useRef(null);
  const timelineVersionRef = useRef(0);
  
  const { videoSrc, videoFile, importVideo, cleanup } = useVideoImport();
  const { lastSaved, loadFromLocalStorage } = useAutoSave(timeline, videoId);
  const { exporting, progress, exportVideo } = useExport(client, videoId, videoFile, timeline);
  
  // Récupération autosave
  useEffect(() => {
    const saved = loadFromLocalStorage();
    if (saved && saved.timeline && saved.timeline.version > 0) {
      setRecoveryData(saved);
      setShowRecoveryDialog(true);
    }
  }, [loadFromLocalStorage]);
  
  // Seek handler centralisé
  const handleSeek = useCallback((time) => {
    setCurrentTime(time);
    renderEngineRef.current?.seek(time);
  }, []);
  
  // Initialisation du moteur de rendu
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !videoSrc) return;
    if (renderEngineRef.current) {
      renderEngineRef.current.destroy();
      renderEngineRef.current = null;
    }
    const allClips = [
      ...timeline.tracks.videos, ...timeline.tracks.audios, ...timeline.tracks.texts,
      ...timeline.tracks.stickers, ...timeline.tracks.effects, ...timeline.tracks.captions
    ];
    renderEngineRef.current = new RenderEngine(canvasRef.current, videoRef.current, allClips, RESOLUTION);
    renderEngineRef.current.seek(currentTime);
    if (playing) renderEngineRef.current.start();
    return () => { renderEngineRef.current?.destroy(); renderEngineRef.current = null; };
  }, [videoSrc]);
  
  // Mise à jour des clips
  useEffect(() => {
    if (!renderEngineRef.current) return;
    timelineVersionRef.current++;
    const allClips = [
      ...timeline.tracks.videos, ...timeline.tracks.audios, ...timeline.tracks.texts,
      ...timeline.tracks.stickers, ...timeline.tracks.effects, ...timeline.tracks.captions
    ];
    renderEngineRef.current.updateClips(allClips, timelineVersionRef.current);
  }, [timeline.tracks]);
  
  // Gestion de la lecture
  useEffect(() => {
    if (renderEngineRef.current) {
      if (playing) renderEngineRef.current.start();
      else renderEngineRef.current.stop();
    }
  }, [playing]);
  
  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        toast.info('Annulé');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        toast.info('Rétabli');
      }
      if (e.code === 'Space' && !(e.target)?.matches('input, textarea')) {
        e.preventDefault();
        setPlaying(!playing);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playing]);
  
  // Import vidéo
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Format vidéo non supporté (MP4, MOV, WebM)');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Vidéo trop lourde (max 100MB)');
      return;
    }
    const videoUrl = URL.createObjectURL(file);
    importVideo(file);
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          const duration = videoRef.current.duration;
          dispatch({ type: 'ADD_CLIP', payload: { type: 'video', start: 0, end: duration, data: { src: videoUrl }, trackIndex: 0 } });
          dispatch({ type: 'SET_DURATION', payload: duration });
          toast.success('Vidéo importée avec succès !');
        }
      };
      videoRef.current.src = videoUrl;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await client.post(`${API_BASE}/upload`, formData);
      if (response.data.success) setVideoId(response.data.video_id);
    } catch (error) { console.error('Upload error:', error); }
  };
  
  // Ajout à la timeline
  const handleAddToTimeline = useCallback((type, data, duration = 3) => {
    dispatch({ type: 'ADD_CLIP', payload: { type, start: currentTime, end: currentTime + duration, data, trackIndex: 0 } });
  }, [currentTime]);
  
  // Récupération de projet
  const handleRecovery = useCallback((restore) => {
    if (restore && recoveryData) {
      dispatch({ type: 'IMPORT', payload: recoveryData.timeline });
      if (recoveryData.videoId) setVideoId(recoveryData.videoId);
      toast.success('Projet récupéré avec succès');
    }
    localStorage.removeItem(AUTO_SAVE_KEY);
    setShowRecoveryDialog(false);
    setRecoveryData(null);
  }, [recoveryData]);
  
  // Cleanup final
  useEffect(() => {
    return () => {
      cleanup();
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; }
      renderEngineRef.current?.destroy();
      ImageCache.clear();
    };
  }, [cleanup]);
  
  // Seek centralisé pour videoController
  const seek = useCallback((t) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  // VideoController pour AdvancedPreview
  const videoController = useMemo(() => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seek,
    setVolume: (vol) => { if (videoRef.current) videoRef.current.volume = vol; },
    setPlaybackRate: (rate) => { if (videoRef.current) videoRef.current.playbackRate = rate; },
    setLoop: (loop) => { if (videoRef.current) videoRef.current.loop = loop; },
    toggleMute: () => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; },
    isPlaying,
    currentTime,
    duration: timeline.duration,
    volume: videoRef.current?.volume || 1,
    isMuted: videoRef.current?.muted || false,
    playbackRate: videoRef.current?.playbackRate || 1,
    loop: videoRef.current?.loop || false
  }), [playing, currentTime, timeline.duration]);
  
  if (!user) return null;
  
  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col overflow-hidden">
      {/* Dialog recovery */}
      {showRecoveryDialog && recoveryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-[#0A0A0A] rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <CloudOff className="w-8 h-8 text-[#ff6b35]" />
              <h3 className="text-white font-bold text-lg">Projet non sauvegardé trouvé</h3>
            </div>
            <p className="text-white/80 mb-6">Un projet datant du {new Date(recoveryData.timestamp).toLocaleString()} a été trouvé.</p>
            <div className="flex gap-3">
              <button onClick={() => handleRecovery(true)} className="flex-1 py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] text-white rounded-lg font-semibold">Récupérer</button>
              <button onClick={() => handleRecovery(false)} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold">Ignorer</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white hover:text-[#44B0FF] transition-colors">
          <ArrowLeft className="w-5 h-5" /><span className="font-semibold">Retour</span>
        </button>
        <h1 className="text-xl font-bold text-white">SmartClips Studio Pro</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => dispatch({ type: 'UNDO' })} disabled={timeline.historyIndex <= 0} className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-30" title="Annuler (Ctrl+Z)"><Undo2 className="w-5 h-5 text-white" /></button>
          <button onClick={() => dispatch({ type: 'REDO' })} disabled={timeline.historyIndex >= timeline.history.length - 1} className="p-2 hover:bg-white/10 rounded-full transition-all disabled:opacity-30" title="Rétablir (Ctrl+Y)"><Redo2 className="w-5 h-5 text-white" /></button>
          {lastSaved && <div className="text-white/40 text-xs hidden lg:block">Sauvegardé à {lastSaved.toLocaleTimeString()}</div>}
          <div className="h-6 w-px bg-white/20 mx-1 hidden lg:block" />
          <button onClick={() => setShowTextEditor(true)} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Ajouter du texte"><Type className="w-5 h-5 text-white" /></button>
          <button onClick={() => setShowStickerLibrary(true)} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Ajouter un sticker"><Sticker className="w-5 h-5 text-white" /></button>
          <button onClick={() => setShowMusicLibrary(true)} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Ajouter de la musique"><Music className="w-5 h-5 text-white" /></button>
          <button onClick={() => setShowEffects(true)} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Effets vidéo"><Sparkles className="w-5 h-5 text-white" /></button>
          <button onClick={() => setShowPreview(true)} className="p-2 hover:bg-white/10 rounded-full transition-all" title="Aperçu avancé"><Film className="w-5 h-5 text-white" /></button>
          <div className="h-6 w-px bg-white/20 mx-1 hidden lg:block" />
          <button onClick={exportVideo} disabled={!videoSrc || exporting} className="px-6 py-2 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-lg hover:shadow-[#005CFF]/50 text-white rounded-full font-semibold transition-all disabled:opacity-50">
            {exporting ? (<div className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />{progress}%</div>) : 'Exporter'}
          </button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-black p-4 relative">
          {!videoSrc ? (
            <div className="text-center">
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-gradient-to-r from-[#005CFF] to-[#44B0FF] hover:shadow-lg hover:shadow-[#005CFF]/50 text-white rounded-[22px] font-semibold text-lg transition-all">
                <Camera className="w-6 h-6 inline-block mr-2" />Importer une vidéo
              </button>
              <p className="text-white/60 mt-4 text-sm">Format 9:16 recommandé (1080x1920)</p>
              <p className="text-white/40 mt-2 text-xs">MP4, MOV, WebM | Max 100MB</p>
            </div>
          ) : (
            <div className="relative w-full max-w-md aspect-[9/16] bg-black rounded-[22px] overflow-hidden shadow-2xl">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
              <video ref={videoRef} className="hidden" playsInline />
              <button onClick={() => setPlaying(!playing)} className="absolute inset-0 flex items-center justify-center group z-10">
                <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  {playing ? <Pause className="w-8 h-8 text-white" /> : <Play className="w-8 h-8 text-white ml-1" />}
                </div>
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full bg-[#ff6b35] transition-all" style={{ width: `${(currentTime / timeline.duration) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        {videoSrc && (
          <div className="w-full lg:w-96 bg-[#0A0A0A] border-t lg:border-t-0 lg:border-l border-white/10 overflow-y-auto p-4">
            <DraggableTimeline timeline={timeline} currentTime={currentTime} onSeek={handleSeek} />
          </div>
        )}
      </div>
      
      {/* Tool panels */}
      {currentTool && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
          <div onClick={() => setCurrentTool(null)} className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" />
          <div className="relative w-full lg:w-[600px] bg-[#0A0A0A] rounded-t-[22px] lg:rounded-[22px] max-h-[80vh] overflow-y-auto border border-white/10 animate-slideUp">
            <div className="sticky top-0 bg-[#0A0A0A] p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-xl">{currentTool === 'captions' && 'Sous-titres AI (Whisper)'}{currentTool === 'templates' && 'Templates intelligents'}</h2>
              <button onClick={() => setCurrentTool(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X className="w-5 h-5 text-white" /></button>
            </div>
            <div className="p-6">
              {currentTool === 'captions' && (
                <div className="text-center text-white/60 py-8">
                  <Languages className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Génération automatique de sous-titres</p>
                  <p className="text-sm">Fonctionnalité à venir avec Whisper AI</p>
                  <p className="text-xs mt-4 text-white/40">Transcription automatique + synchronisation</p>
                </div>
              )}
              {currentTool === 'templates' && (
                <div className="text-center text-white/60 py-8">
                  <Rocket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Templates intelligents</p>
                  <p className="text-sm">Hook Viral, Avant/Après, Top 5, Storytelling</p>
                  <p className="text-xs mt-4 text-white/40">Bientôt disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
 {/* Modals avec composants corrigés */}
      {showTextEditor && (
        <Modal onClose={() => setShowTextEditor(false)} title="Éditeur de texte avancé">
          <AdvancedTextEditor onAddText={(data) => { handleAddToTimeline('text', data, data.duration || 3); setShowTextEditor(false); }} />
        </Modal>
      )}
      
      {showStickerLibrary && (
        <Modal onClose={() => setShowStickerLibrary(false)} title="Bibliothèque de stickers">
          <StickerPicker onAddSticker={(data) => { handleAddToTimeline('sticker', data, data.duration || 3); setShowStickerLibrary(false); }} />
        </Modal>
      )}
      
      {showMusicLibrary && (
        <Modal onClose={() => setShowMusicLibrary(false)} title="Bibliothèque musicale">
          <MusicLibrary onAddMusic={(data) => { handleAddToTimeline('audio', data, data.duration); setShowMusicLibrary(false); }} />
        </Modal>
      )}
      
      {showEffects && (
        <Modal onClose={() => setShowEffects(false)} title="Effets vidéo">
          <VideoEffects videoRef={videoRef} onApplyEffect={(payload) => {
            if (payload.type === 'filter') handleAddToTimeline('effect', payload.data, payload.data.duration || 2);
            else if (payload.type === 'transition') handleAddToTimeline('effect', { type: 'transition', ...payload.data }, payload.data.duration);
            else if (payload.type === 'speed') handleAddToTimeline('effect', { type: 'speed', ...payload.data }, payload.data.duration);
            else if (payload.type === 'effect') handleAddToTimeline('effect', payload.data, payload.data.duration);
            setShowEffects(false);
          }} />
        </Modal>
      )}
      
      {showPreview && (
        <Modal onClose={() => setShowPreview(false)} title="Aperçu avancé">
          <AdvancedPreview videoController={videoController} onExport={exportVideo} isExporting={exporting} audioData={null} markers={[]} showWaveform={true} showMarkers={true} />
        </Modal>
      )}
    </div>
  );
};

SmartClipsStudio.propTypes = {};

export default SmartClipsStudio;
Modal.propTypes = {
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
};
