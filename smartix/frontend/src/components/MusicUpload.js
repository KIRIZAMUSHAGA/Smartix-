import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import axios from '../config/axiosConfig';
import { audioManager } from '../utils/audioContext';
import PropTypes from 'prop-types';

const MusicUpload = ({ onMusicUploaded, onClose }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const validateAndUploadAudio = async (file) => {
    setError(null);
    setSuccess(false);

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/flac'];
    if (!validTypes.includes(file.type)) {
      setError('Format non supporté. Utilisez MP3, WAV, OGG, FLAC ou MP4.');
      return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Le fichier est trop volumineux (max 10MB).');
      return;
    }

    setUploading(true);

    try {
      // Create FormData and upload to backend
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/music/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const musicData = response.data;
      
      // Validate duration with audioManager singleton
      const audio = audioManager.getAudioElement();
      let durationValidated = false;

      const handleMetadata = () => {
        if (durationValidated) return;
        durationValidated = true;

        if (audio.duration > 60) {
          setError(`Musique trop longue (${Math.floor(audio.duration)}s). Maximum 60 secondes.`);
          setUploading(false);
          audio.removeEventListener('loadedmetadata', handleMetadata);
          audio.removeEventListener('error', handleError);
          return;
        }

        musicData.duration = Math.ceil(audio.duration);
        onMusicUploaded(musicData);
        setSuccess(true);
        audio.removeEventListener('loadedmetadata', handleMetadata);
        audio.removeEventListener('error', handleError);
        setTimeout(() => onClose(), 1500);
      };

      const handleError = () => {
        if (durationValidated) return;
        durationValidated = true;
        setError('Impossible de valider le fichier audio.');
        setUploading(false);
        audio.removeEventListener('loadedmetadata', handleMetadata);
        audio.removeEventListener('error', handleError);
      };

      audio.addEventListener('loadedmetadata', handleMetadata);
      audio.addEventListener('error', handleError);
      audioManager.loadMusic(musicData.url);
    } catch (err) {
      console.error('Music upload error:', err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Erreur de connexion au serveur. Vérifiez votre connexion internet.');
      } else {
        setError('Erreur lors du téléchargement: ' + (err.message || 'Erreur inconnue'));
      }
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndUploadAudio(file);
    }
  };

  return (
    <div className="bg-white/5 border border-white/20 rounded-lg p-6 text-center">
      <div className="mb-4">
        <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
        <h3 className="text-white font-semibold mb-1">Importer votre musique</h3>
        <p className="text-white/60 text-sm">Max 60 secondes, MP3/WAV/OGG/FLAC</p>
      </div>

      {!success && (
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-4">
          <CheckCircle className="w-4 h-4" />
          <span>Musique ajoutée avec succès!</span>
        </div>
      )}

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || success}
        className={`w-full px-4 py-2 rounded-lg font-semibold transition ${
          uploading || success
            ? 'bg-white/10 text-white/50 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg'
        }`}
      >
        {uploading ? 'Chargement...' : success ? ' ✓ Importée' : 'Choisir un fichier'}
      </button>
    </div>
  );
};

MusicUpload.propTypes = {
  onMusicUploaded: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MusicUpload;
