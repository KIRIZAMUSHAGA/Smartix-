import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ChevronLeft, Upload, Image as ImageIcon, FileText, DollarSign, Package, Eye, Loader2, AlertCircle, X, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../contexts/ApiClientContext';
import { MAX_IMAGE_SIZE, ACCEPTED_IMAGE_TYPES } from '../config/appConfig';
import ProductCanvas from '../components/ProductCanvas/ProductCanvas';
import './AddProduct.css';
import PropTypes from 'prop-types';

// =============================
// 1️⃣ CONSTANTES
// =============================
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_PDF_TYPES = ['application/pdf'];
const ALLOWED_PAYMENT_METHODS = ['M-Pesa', 'Airtel Money', 'Orange Money']; // ✅ Whitelist backend
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY = 1000;

const CATEGORIES = [
  { id: 'informatique', label: '💻 Informatique' },
  { id: 'comptabilite', label: '📊 Comptabilité' },
  { id: 'medecine', label: '⚕️ Médecine' },
  { id: 'droit', label: '⚖️ Droit' },
  { id: 'economie', label: '💰 Économie' },
  { id: 'gestion', label: '📈 Gestion' }
];

// =============================
// 2️⃣ VALIDATION DES FICHIERS (frontend UX seulement)
// =============================
const validatePDF = (file) => {
  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };
  if (!ACCEPTED_PDF_TYPES.includes(file.type)) {
    return { valid: false, error: 'Format non supporté. Utilisez PDF uniquement' };
  }
  if (file.size > MAX_PDF_SIZE) {
    return { valid: false, error: `Fichier trop volumineux (max ${MAX_PDF_SIZE / (1024 * 1024)}MB)` };
  }
  return { valid: true, error: '' };
};

const validateImage = (file) => {
  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Format non supporté. Utilisez: ${ACCEPTED_IMAGE_TYPES.map(t => t.split('/')[1]).join(', ')}` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Fichier trop volumineux (max ${MAX_IMAGE_SIZE / (1024 * 1024)}MB)` };
  }
  return { valid: true, error: '' };
};

// =============================
// 3️⃣ COMPOSANT PRINCIPAL
// =============================
const AddProduct = () => {
  const { user } = useAuth();
  const { client } = useApiClient();
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  const previewUrlRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [showCanvas, setShowCanvas] = useState(false);
  const [createdProductId, setCreatedProductId] = useState(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: 'informatique',
    price: '',
    currency: 'USD',
    quantity_available: '',
    free_preview_pages: '5',
    payment_methods: ['M-Pesa', 'Airtel Money', 'Orange Money']
  });
  const [files, setFiles] = useState({
    pdf: null,
    cover: null
  });
  const [preview, setPreview] = useState({
    pdfName: '',
    coverUrl: ''
  });

  // ✅ Nettoyage des ressources
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  // ✅ Redirection si non connecté
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // ✅ Validation en temps réel (optimisée)
  useEffect(() => {
    const newErrors = {};
    
    if (formData.title && formData.title.length < 3) {
      newErrors.title = 'Titre trop court (min 3 caractères)';
    }
    if (formData.title && formData.title.length > 100) {
      newErrors.title = 'Titre trop long (max 100 caractères)';
    }
    if (formData.description && formData.description.length < 10) {
      newErrors.description = 'Description trop courte (min 10 caractères)';
    }
    if (formData.price) {
      const price = Number(formData.price);
      if (!Number.isFinite(price) || price <= 0) {
        newErrors.price = 'Le prix doit être un nombre positif';
      }
    }
    if (formData.quantity_available) {
      const quantity = Number(formData.quantity_available);
      if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
        newErrors.quantity_available = 'La quantité doit être un nombre entier positif';
      }
    }
    if (formData.free_preview_pages) {
      const pages = Number(formData.free_preview_pages);
      if (!Number.isFinite(pages) || pages < 1 || pages > 50) {
        newErrors.free_preview_pages = 'Les pages de prévisualisation doivent être entre 1 et 50';
      }
    }
    
    setErrors(newErrors);
  }, [formData]);

  // ✅ Validation robuste des nombres
  const getValidNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
  };

  // ✅ Filtrage des méthodes de paiement (whitelist)
  const getFilteredPaymentMethods = useCallback(() => {
    return formData.payment_methods.filter(method => 
      ALLOWED_PAYMENT_METHODS.includes(method)
    );
  }, [formData.payment_methods]);

  // ✅ Validation du formulaire
  const isValid = useCallback(() => {
    const price = getValidNumber(formData.price);
    const quantity = getValidNumber(formData.quantity_available);
    const previewPages = getValidNumber(formData.free_preview_pages);
    
    return (
      files.pdf &&
      files.cover &&
      formData.title &&
      formData.title.length >= 3 &&
      formData.description &&
      formData.description.length >= 10 &&
      price > 0 &&
      quantity >= 0 &&
      previewPages >= 1 &&
      previewPages <= 50 &&
      Object.keys(errors).length === 0
    );
  }, [files, formData, errors]);

  // ✅ Upload avec retry et AbortController
  const uploadWithRetry = useCallback(async (url, formData, onProgress) => {
    let attempt = 0;
    
    while (attempt <= MAX_RETRY_ATTEMPTS) {
      try {
        // Créer un nouveau controller pour chaque tentative
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        
        const response = await client.post(url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: abortControllerRef.current.signal,
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(percent);
            }
          }
        });
        
        return response;
        
      } catch (error) {
        if (error.name === 'AbortError') {
          throw error;
        }
        
        attempt++;
        if (attempt > MAX_RETRY_ATTEMPTS) {
          throw error;
        }
        
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        console.log(`🔄 Retry ${attempt}/${MAX_RETRY_ATTEMPTS}`);
      }
    }
  }, [client]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (loading) return;
    
    if (!isValid()) {
      toast.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }
    
    setLoading(true);
    setUploadProgress(0);
    setRetryCount(0);
    
    try {
      // ✅ Étape 1: Création du produit (metadata uniquement)
      const productData = {
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id,
        price: getValidNumber(formData.price),
        currency: formData.currency,
        quantity_available: getValidNumber(formData.quantity_available),
        free_preview_pages: getValidNumber(formData.free_preview_pages),
        payment_methods: getFilteredPaymentMethods() // ✅ Whitelist appliquée
      };
      
      const productResponse = await client.post('/marketplace/products', productData);
      const productId = productResponse.data.id;
      
      // ✅ Étape 2: Upload du PDF
      const pdfFormData = new FormData();
      pdfFormData.append('pdf', files.pdf);
      
      await uploadWithRetry(
        `/marketplace/products/${productId}/upload/pdf`,
        pdfFormData,
        (percent) => setUploadProgress(percent * 0.7) // 70% du progrès pour le PDF
      );
      
      // ✅ Étape 3: Upload de l'image de couverture
      const coverFormData = new FormData();
      coverFormData.append('cover', files.cover);
      
      await uploadWithRetry(
        `/marketplace/products/${productId}/upload/cover`,
        coverFormData,
        (percent) => setUploadProgress(70 + (percent * 0.3)) // 30% restants pour la couverture
      );
      
      toast.success('Produit créé avec succès !');
      navigate(`/marketplace/product/${productId}/canvas`, { 
        state: { pdfUrl: productResponse.data.pdf_file } 
      });
      
    } catch (error) {
      console.error('Error uploading product:', error);
      
      if (error.name === 'AbortError') {
        toast.info('Upload annulé');
      } else if (error.response?.status === 401) {
        toast.error('Session expirée, reconnectez-vous');
        navigate('/auth');
      } else if (error.response?.status === 403) {
        toast.error('Vous n\'êtes pas autorisé à publier');
      } else if (error.response?.status === 413) {
        toast.error('Fichier trop volumineux');
      } else if (error.response?.status === 429) {
        toast.error('Trop de requêtes, patientez');
      } else if (error.code === 'ECONNABORTED') {
        toast.error('Connexion trop lente, réessayez', {
          action: {
            label: 'Réessayer',
            onClick: () => handleSubmit(e)
          }
        });
      } else {
        toast.error(error.response?.data?.detail || 'Erreur lors de l\'upload');
      }
    } finally {
      setLoading(false);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  }, [isValid, loading, formData, files, client, navigate, getFilteredPaymentMethods, uploadWithRetry]);

  const handleCancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast.info('Upload annulé');
    }
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback(async (e, fileType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validation UX
    const validation = fileType === 'pdf' ? validatePDF(file) : validateImage(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    
    setFiles(prev => ({ ...prev, [fileType]: file }));
    
    if (fileType === 'pdf') {
      setPreview(prev => ({ ...prev, pdfName: file.name }));
    } else if (fileType === 'cover') {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreview(prev => ({ ...prev, coverUrl: url }));
    }
  }, []);

  const handleRemoveFile = useCallback((fileType) => {
    setFiles(prev => ({ ...prev, [fileType]: null }));
    if (fileType === 'pdf') {
      setPreview(prev => ({ ...prev, pdfName: '' }));
    } else if (fileType === 'cover') {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreview(prev => ({ ...prev, coverUrl: '' }));
    }
  }, []);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    handleSubmit(new Event('submit'));
  }, [handleSubmit]);

  if (!user) return null;

  if (showCanvas) {
    return (
      <div className="add-product-page">
        <div className="product-form-container">
          <ProductCanvas 
            productId={createdProductId} 
            pdfUrl={pdfPreviewUrl} 
            onComplete={() => navigate('/seller/dashboard')} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="add-product-page min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <button 
          className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          onClick={() => navigate('/seller/dashboard')}
        >
          <ChevronLeft size={20} /> Retour
        </button>

        <div className="product-form-container bg-card/50 backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-8">
          {/* Header */}
          <div className="form-header text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">📝 Ajouter un Nouveau Produit</h1>
            <p className="text-white/60">Créez et publiez votre produit éducatif sur Smartix Store</p>
          </div>

          {/* Progress Bar */}
          {loading && uploadProgress > 0 && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-white/60 mb-2">
                <span>Publication en cours...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={handleCancelUpload}
                className="mt-2 text-xs text-red-500 hover:text-red-400 transition-colors"
              >
                Annuler l'upload
              </button>
            </div>
          )}

          {/* Retry Button */}
          {retryCount > 0 && !loading && (
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-yellow-500">Échec de l'upload. Voulez-vous réessayer ?</p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* FILES SECTION - Inchangé mais avec loading disabled */}
            <Card className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">📁 Fichiers</h3>

              <div className="grid md:grid-cols-2 gap-6">
                {/* PDF Upload */}
                <div className="file-input-group">
                  <label className="block text-sm font-medium text-white/80 mb-2">📄 Fichier PDF *</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'pdf')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      id="pdf-input"
                      disabled={loading}
                    />
                    <div className={`border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-[#ff6b35] transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <Upload className="w-8 h-8 mx-auto text-white/40 mb-2" />
                      <p className="text-sm text-white/60">
                        {files.pdf ? files.pdf.name : 'Cliquez ou glissez votre PDF'}
                      </p>
                      <p className="text-xs text-white/40 mt-1">Max 50MB</p>
                    </div>
                  </div>
                  {files.pdf && (
                    <div className="mt-2 flex items-center justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-xs text-white/60 truncate flex-1">{files.pdf.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile('pdf')}
                        disabled={loading}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Cover Image Upload */}
                <div className="file-input-group">
                  <label className="block text-sm font-medium text-white/80 mb-2">🖼️ Image de Couverture *</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'cover')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      id="cover-input"
                      disabled={loading}
                    />
                    <div className={`border-2 border-dashed border-white/20 rounded-lg p-4 text-center hover:border-[#ff6b35] transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <ImageIcon className="w-8 h-8 mx-auto text-white/40 mb-2" />
                      <p className="text-sm text-white/60">
                        {files.cover ? files.cover.name : 'Cliquez ou glissez votre image'}
                      </p>
                      <p className="text-xs text-white/40 mt-1">JPG, PNG, WebP (max 5MB)</p>
                    </div>
                  </div>
                  {preview.coverUrl && (
                    <div className="mt-4">
                      <img src={preview.coverUrl} alt="Couverture" className="w-32 h-32 object-cover rounded-lg" />
                    </div>
                  )}
                </div>
              </div>
            </Card>

                {/* PRODUCT INFO SECTION */}
            <Card className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">📝 Informations du Produit</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Titre du Produit *</label>
                  <input
                    type="text"
                    name="title"
                    placeholder="Ex: Python pour les Débutants"
                    value={formData.title}
                    onChange={handleInputChange}
                    maxLength="100"
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                      errors.title ? 'border-red-500' : 'border-white/10'
                    } text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50`}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.title}
                    </p>
                  )}
                  <p className="text-xs text-white/40 mt-1">{formData.title.length}/100</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Description Détaillée *</label>
                  <textarea
                    name="description"
                    placeholder="Décrivez votre produit en détail..."
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="4"
                    maxLength="1000"
                    disabled={loading}
                    className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                      errors.description ? 'border-red-500' : 'border-white/10'
                    } text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50`}
                  />
                  {errors.description && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.description}
                    </p>
                  )}
                  <p className="text-xs text-white/40 mt-1">{formData.description.length}/1000</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Catégorie *</label>
                    <select 
                      name="category_id" 
                      value={formData.category_id} 
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">Quantité Disponible *</label>
                    <input
                      type="number"
                      name="quantity_available"
                      placeholder="0"
                      value={formData.quantity_available}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      disabled={loading}
                      className={`w-full px-4 py-3 rounded-xl bg-white/5 border ${
                        errors.quantity_available ? 'border-red-500' : 'border-white/10'
                      } text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50`}
                    />
                    {errors.quantity_available && (
                      <p className="text-xs text-red-500 mt-1">{errors.quantity_available}</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* PRICING SECTION */}
            <Card className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">💰 Tarification</h3>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Prix *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                    <input
                      type="number"
                      name="price"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      disabled={loading}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border ${
                        errors.price ? 'border-red-500' : 'border-white/10'
                      } text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50`}
                    />
                  </div>
                  {errors.price && (
                    <p className="text-xs text-red-500 mt-1">{errors.price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Devise</label>
                  <select 
                    name="currency" 
                    value={formData.currency} 
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="FC">Francs Congolais (FC)</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* PREVIEW SECTION */}
            <Card className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">👀 Prévisualisation</h3>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Nombre de Pages Gratuites Visibles *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    name="free_preview_pages"
                    value={formData.free_preview_pages}
                    onChange={handleInputChange}
                    min="1"
                    max="50"
                    step="1"
                    disabled={loading}
                    className={`w-24 px-4 py-3 rounded-xl bg-white/5 border ${
                      errors.free_preview_pages ? 'border-red-500' : 'border-white/10'
                    } text-white text-center focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transition-all disabled:opacity-50`}
                  />
                  <span className="text-white/60">pages</span>
                </div>
                {errors.free_preview_pages && (
                  <p className="text-xs text-red-500 mt-1">{errors.free_preview_pages}</p>
                )}
                <p className="text-xs text-white/40 mt-2">Les acheteurs verront ces pages avant d'acheter</p>
              </div>
            </Card>
                          {/* PAYMENT METHODS avec whitelist */}
            <Card className="p-6 bg-white/5 border border-white/10 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-4">💳 Méthodes de Paiement Acceptées</h3>
              <div className="flex flex-wrap gap-4">
                {ALLOWED_PAYMENT_METHODS.map(method => (
                  <label key={method} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.payment_methods.includes(method)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            payment_methods: [...prev.payment_methods, method]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            payment_methods: prev.payment_methods.filter(m => m !== method)
                          }));
                        }
                      }}
                      disabled={loading}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#ff6b35] focus:ring-[#ff6b35] disabled:opacity-50"
                    />
                    <span className="text-sm text-white/80">{method}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-4">
                Les méthodes de paiement non autorisées seront automatiquement ignorées
              </p>
            </Card>

            {/* SUBMIT SECTION */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading || !isValid()}
                className="flex-1 bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] hover:from-[#ff5a24] hover:to-[#ff7a4a] text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Publication en cours...
                  </>
                ) : (
                  '✅ Publier le Produit'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.info('Aperçu du produit avant publication')}
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-xl disabled:opacity-50"
              >
                <Eye className="w-4 h-4 mr-2" />
                Aperçu
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

AddProduct.propTypes = {};

export default AddProduct;
