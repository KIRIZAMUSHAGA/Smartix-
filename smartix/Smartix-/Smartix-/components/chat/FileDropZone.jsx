import React, { useState, useRef, useCallback } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// =============================
// CONSTANTES
// =============================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// =============================
// PROPS
// =============================
interface FileDropZoneProps {
  onFileUpload: (file: File) => Promise<void>;
  maxSize?: number;
  allowedTypes?: string[];
}

// =============================
// COMPOSANT PRINCIPAL
// =============================
const FileDropZone = ({
  onFileUpload,
  maxSize = MAX_FILE_SIZE,
  allowedTypes = ALLOWED_TYPES
}: FileDropZoneProps) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // =============================
  // VALIDATION DU FICHIER
  // =============================
  const validateFile = (file: File): boolean => {
    // Vérifier la taille
    if (file.size > maxSize) {
      setError(`Fichier trop volumineux (max ${maxSize / 1024 / 1024} Mo)`);
      return false;
    }

    // Vérifier le type
    if (!allowedTypes.includes(file.type)) {
      setError(`Type de fichier non supporté: ${file.type || 'inconnu'}`);
      return false;
    }

    return true;
  };

  // =============================
  // TRAITEMENT DU FICHIER
  // =============================
  const processFile = async (file: File) => {
    setError(null);
    setUploadedFile(file);

    if (!validateFile(file)) {
      setUploadedFile(null);
      return;
    }

    setUploading(true);

    try {
      await onFileUpload(file);
      toast.success('Fichier uploadé avec succès !');
    } catch (err) {
      setError('Erreur lors de l\'upload');
      setUploadedFile(null);
      toast.error('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  // =============================
  // GESTIONNAIRES DRAG & DROP
  // =============================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  // =============================
  // GESTIONNAIRE CLIC / INPUT
  // =============================
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  // =============================
  // ANNULATION
  // =============================
  const handleClear = useCallback(() => {
    setUploadedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="w-full">
      {/* Zone de dépôt */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative
          border-2 border-dashed rounded-xl
          p-8
          cursor-pointer
          transition-all duration-200
          focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-700
          ${dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          }
        `}
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichiers. Cliquez ou glissez-déposez un fichier."
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Contenu selon l'état */}
        {uploading ? (
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload en cours...
            </p>
          </div>
        ) : uploadedFile ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">
                  {uploadedFile.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(uploadedFile.size / 1024).toFixed(1)} Ko
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Supprimer le fichier"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Upload
              className={`
                w-12 h-12 mx-auto mb-3
                ${dragging
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-400 dark:text-gray-500'
                }
              `}
            />
            <p className="text-gray-900 dark:text-white font-medium mb-1">
              Glissez-déposez un fichier ici
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ou cliquez pour sélectionner
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              PDF, images, documents texte (max {maxSize / 1024 / 1024} Mo)
            </p>
          </div>
        )}

        {/* Message d'erreur */}
        {error && !uploading && (
          <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Input file caché */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept={allowedTypes.join(',')}
          aria-label="Sélectionner un fichier"
        />
      </div>
    </div>
  );
};

export default FileDropZone;
