import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, BookOpen, AlertCircle, Plus, FileText, Image as ImageIcon, 
  Loader2, Trash2, Upload, X, Eye, Download, CheckCircle, Clock, 
  AlertTriangle, File, FileUp, ExternalLink, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '../components/BottomNav';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '../config/appConfig';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ COMPOSANT MODAL DE CONFIRMATION
// =============================
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, description, danger = false }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e293b] rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className={`w-6 h-6 ${danger ? 'text-red-500' : 'text-yellow-500'}`} />
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-white/60 mb-6">{description}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-xl font-medium ${
              danger 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-[#ff6b35] hover:bg-[#ff8c61] text-white'
            }`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================
// 2️⃣ COMPOSANT DE PREVIEW FICHIER
// =============================
const FilePreview = ({ file, onPreview }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  
  if (file.fileType === 'image') {
    return (
      <>
        <img 
          src={file.previewUrl || file.url}
          alt={file.fileName}
          className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => setPreviewOpen(true)}
        />
        {previewOpen && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
            <img src={file.previewUrl || file.url} alt={file.fileName} className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </>
    );
  }
  
  if (file.fileType === 'pdf') {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className="text-[#ff6b35] font-black hover:bg-[#ff6b35]/10"
        onClick={() => window.open(file.url, '_blank')}
      >
        <Eye className="w-4 h-4 mr-2" />
        Voir le PDF
      </Button>
    );
  }
  
  return null;
};

// =============================
// 3️⃣ COMPOSANT D'ÉTAT DE FICHIER
// =============================
const FileStatusBadge = ({ status }) => {
  const statusConfig = {
    uploaded: { icon: Clock, text: 'Uploadé', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    processing: { icon: Loader2, text: 'En traitement', color: 'text-blue-500', bg: 'bg-blue-500/10', spin: true },
    processed: { icon: CheckCircle, text: 'Traité', color: 'text-green-500', bg: 'bg-green-500/10' },
    published: { icon: CheckCircle, text: 'Publié', color: 'text-green-500', bg: 'bg-green-500/10' },
    error: { icon: AlertTriangle, text: 'Erreur', color: 'text-red-500', bg: 'bg-red-500/10' }
  };
  
  const config = statusConfig[status] || statusConfig.uploaded;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className={`w-3 h-3 ${config.spin ? 'animate-spin' : ''}`} />
      {config.text}
    </span>
  );
};

// =============================
// 4️⃣ COMPOSANT DE ZONE D'UPLOAD AVEC DRAG & DROP
// =============================
const UploadZone = ({ onUpload, isUploading, uploadProgress }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      onUpload(files);
    }
  };
  
  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
        isDragging 
          ? 'border-[#ff6b35] bg-[#ff6b35]/5' 
          : 'border-border hover:border-[#ff6b35]/50 hover:bg-accent/5'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onUpload(Array.from(e.target.files))}
        accept={ACCEPTED_FILE_TYPES.join(',')}
        disabled={isUploading}
      />
      
      {isUploading ? (
        <div className="space-y-3">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-[#ff6b35]" />
          <p className="text-white/60">Téléchargement en cours... {uploadProgress}%</p>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#ff6b35] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : (
        <>
          <Upload className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-white font-medium mb-1">Glisse tes fichiers ici ou clique pour choisir</p>
          <p className="text-xs text-muted-foreground">
            Formats acceptés: PDF, DOCX, JPG, PNG, WebP (max {MAX_FILE_SIZE / (1024 * 1024)}MB)
          </p>
        </>
      )}
    </div>
  );
};

// =============================
// 5️⃣ COMPOSANT PRINCIPAL
// =============================
const CourseEdit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { client } = useApiClient();

  const [course, setCourse] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importingFileId, setImportingFileId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // =============================
  // 6️⃣ CHARGEMENT DES DONNÉES
  // =============================
  const fetchCourseData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [courseRes, filesRes] = await Promise.all([
        client.get(`/courses/${courseId}`),
        client.get(`/courses/${courseId}/files`)
      ]);
      setCourse(courseRes.data);
      setFiles(filesRes.data.map(f => ({ ...f, status: 'uploaded' })));
    } catch (error) {
      console.error('Failed to fetch course data:', error);
      setError('Impossible de charger les données du cours');
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [courseId, client, user]);

  useEffect(() => {
    fetchCourseData();
  }, [fetchCourseData]);

  // =============================
  // 7️⃣ UPLOAD DE FICHIER (MULTIPLE)
  // =============================
  const handleFileUpload = useCallback(async (filesToUpload) => {
    if (!filesToUpload.length) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    const newFiles = [];
    
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      
      // Validation
      if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Format non supporté`);
        continue;
      }
      
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: Fichier trop volumineux (max ${MAX_FILE_SIZE / (1024 * 1024)}MB)`);
        continue;
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await client.post(`/courses/${courseId}/upload-file`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        });
        
        const newFile = {
          ...res.data,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
          status: 'uploaded'
        };
        
        newFiles.push(newFile);
        toast.success(`${file.name} ajouté`);
        
      } catch (error) {
        console.error('Upload error:', error);
        
        let errorMsg = 'Erreur lors de l\'upload';
        if (error.response?.status === 413) {
          errorMsg = 'Fichier trop lourd';
        } else if (error.response?.status === 415) {
          errorMsg = 'Format non supporté';
        }
        toast.error(`${file.name}: ${errorMsg}`);
      }
    }
    
    if (newFiles.length) {
      setFiles(prev => [...prev, ...newFiles]);
    }
    
    setUploading(false);
    setUploadProgress(0);
  }, [courseId, client]);

  // =============================
  // 8️⃣ IMPORT DANS L'ÉDITEUR
  // =============================
  const handleImportToEditor = useCallback(async (fileId) => {
    setImportingFileId(fileId);
    
    // Mettre à jour le statut localement
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'processing' } : f
    ));
    
    try {
      await client.post(`/courses/${courseId}/import-file/${fileId}`);
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'processed' } : f
      ));
      
      toast.success('Contenu prêt à être édité !');
      navigate(`/courses/${courseId}/editor`);
      
    } catch (error) {
      console.error('Import error:', error);
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'error' } : f
      ));
      toast.error('Erreur lors de l\'importation');
    } finally {
      setImportingFileId(null);
    }
  }, [courseId, client, navigate]);

  // =============================
  // 9️⃣ SUPPRESSION DE FICHIER
  // =============================
  const handleDeleteClick = useCallback((fileId) => {
    setFileToDelete(fileId);
    setDeleteModalOpen(true);
  }, []);
  
  const handleDeleteConfirm = useCallback(async () => {
    if (!fileToDelete) return;
    
    try {
      await client.delete(`/courses/${courseId}/files/${fileToDelete}`);
      setFiles(prev => prev.filter(f => f.id !== fileToDelete));
      toast.success('Fichier supprimé');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteModalOpen(false);
      setFileToDelete(null);
    }
  }, [courseId, client, fileToDelete]);

  // =============================
  // 🔟 UTILITAIRES
  // =============================
  const getFileIcon = useCallback((type) => {
    switch (type) {
      case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
      case 'image': return <ImageIcon className="w-5 h-5 text-blue-500" />;
      default: return <File className="w-5 h-5 text-gray-500" />;
    }
  }, []);

  const getFullImageUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    let cleanPath = path;
    if (path.startsWith('api/')) cleanPath = '/' + path.substring(4);
    if (path.startsWith('/api/')) cleanPath = path.substring(4);
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    return cleanPath;
  }, []);

  // =============================
  // 1️⃣1️⃣ ÉTATS DE CHARGEMENT
  // =============================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35]"></div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-black mb-4">{error || 'Cours non trouvé'}</h2>
        <Link to="/courses">
          <Button className="bg-[#ff6b35] hover:bg-[#ff8c61] text-white font-black">
            Retour aux cours
          </Button>
        </Link>
      </div>
    );
  }

  // =============================
  // 1️⃣2️⃣ RENDU PRINCIPAL
  // =============================
  return (
    <div className="min-h-screen bg-background text-foreground pb-24 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-background border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/courses">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
          </Link>
          <h1 className="text-xl font-black tracking-tight truncate max-w-xs">{course.title}</h1>
          <div className="w-20"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="overflow-hidden border-border bg-card rounded-[32px] mb-8 shadow-xl">
          {/* Image de couverture */}
          <div className="aspect-video relative bg-muted overflow-hidden">
            {course.coverImage ? (
              <img 
                src={getFullImageUrl(course.coverImage)}
                alt={course.title}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                onError={(e) => {
                  console.error("Erreur chargement image:", e.target.src);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-gradient-to-br from-[#ff6b35]/10 to-[#ff8c61]/10">
                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                <span className="font-black uppercase tracking-widest opacity-20">Aucune couverture</span>
              </div>
            )}
          </div>
          
          <div className="p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-3xl font-black tracking-tight">{course.title}</h2>
            </div>
            
            <p className="text-muted-foreground font-medium text-lg leading-relaxed mb-8">
              {course.description || "Aucune description fournie."}
            </p>

            {/* Zone d'upload */}
            <div className="mb-8">
              <UploadZone 
                onUpload={handleFileUpload}
                isUploading={uploading}
                uploadProgress={uploadProgress}
              />
            </div>

            {/* Liste des fichiers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#ff6b35]" />
                  Contenu du cours
                </h3>
                {files.length > 0 && (
                  <span className="text-xs text-muted-foreground">{files.length} fichier(s)</span>
                )}
              </div>
              
              {files.length > 0 ? (
                <div className="grid gap-3">
                  {files.map((file) => (
                    <div 
                      key={file.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background rounded-2xl border border-border group hover:border-[#ff6b35]/50 transition-all gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                          {file.fileType === 'image' ? (
                            <FilePreview file={file} />
                          ) : (
                            getFileIcon(file.fileType)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm truncate max-w-[200px] md:max-w-md">{file.fileName || 'Fichier sans nom'}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <p className="text-xs text-muted-foreground uppercase font-black tracking-tighter">{file.fileType}</p>
                            <FileStatusBadge status={file.status} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.fileType === 'pdf' && (
                          <FilePreview file={file} />
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-[#ff6b35] font-black hover:bg-[#ff6b35]/10"
                          onClick={() => handleImportToEditor(file.id)}
                          disabled={importingFileId !== null || file.status === 'processing'}
                        >
                          {importingFileId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <FileUp className="w-4 h-4 mr-1" />
                              Convertir en chapitre
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                          onClick={() => handleDeleteClick(file.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-8 text-center">
                  <FileUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-white font-medium mb-2">Aucun fichier ajouté</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ajoute ton premier fichier pour créer ton cours.
                    Tu peux importer :
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-white/5 rounded">📄 PDF</span>
                    <span className="px-2 py-1 bg-white/5 rounded">📝 Documents</span>
                    <span className="px-2 py-1 bg-white/5 rounded">🖼️ Images</span>
                  </div>
                </div>
              )}
            </div>

            {/* Stepper de progression */}
            {files.some(f => f.status === 'processed') && (
              <div className="mt-8 p-4 bg-white/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">✓</div>
                    <span className="text-sm text-white">Fichier uploadé</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#ff6b35]/20 text-[#ff6b35] flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                    <span className="text-sm text-white/60">Conversion en chapitre</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 text-white/40 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-sm text-white/40">Modifier dans l'éditeur</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      
      <BottomNav />
      
      {/* Modal de confirmation suppression */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Supprimer le fichier"
        description="Cette action est irréversible. Le fichier sera définitivement supprimé."
        danger={true}
      />
    </div>
  );
};

CourseEdit.propTypes = {};

export default CourseEdit;
ConfirmModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  danger: PropTypes.any,
};
FilePreview.propTypes = {
  file: PropTypes.object.isRequired,
  onPreview: PropTypes.func.isRequired,
};
FileStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};
UploadZone.propTypes = {
  onUpload: PropTypes.func.isRequired,
  isUploading: PropTypes.bool.isRequired,
  uploadProgress: PropTypes.any.isRequired,
};
