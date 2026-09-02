import React, { useRef } from "react";
import { FileText, Image, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PropTypes from 'prop-types';

// =============================
// TYPES DE DOCUMENTS
// =============================
const documentTypes = [
  {
    id: "pdf",
    icon: FileText,
    label: "Importer PDF",
    accept: ".pdf,application/pdf",
    color: "blue",
    description: "PDF, jusqu'à 10 Mo"
  },
  {
    id: "image",
    icon: Image,
    label: "Importer Image",
    accept: "image/*",
    color: "purple",
    description: "JPG, PNG, GIF, jusqu'à 5 Mo"
  },
  {
    id: "url",
    icon: Globe,
    label: "Analyser un lien web",
    accept: null,
    color: "green",
    description: "URL publique"
  }
];

// =============================
// COMPOSANT PRINCIPAL
// =============================
const DocumentCenter = () => {
  const [uploading, setUploading] = React.useState(null);
  const [urlInput, setUrlInput] = React.useState("");
  const [showUrlInput, setShowUrlInput] = React.useState(false);
  const fileInputRefs = {
    pdf: useRef(null),
    image: useRef(null)
  };

  // =============================
  // GESTIONNAIRE D'UPLOAD
  // =============================
  const handleFileUpload = async (type, file) => {
    if (!file) return;

    // Validation taille
    const maxSize = type === "pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 10MB ou 5MB
    if (file.size > maxSize) {
      toast.error(`Fichier trop volumineux (max ${maxSize / 1024 / 1024} Mo)`);
      return;
    }

    setUploading(type);
    
    // Simuler un upload (remplacer par vrai appel API)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Fichier uploadé:", file.name);
      toast.success("Document importé avec succès !");
    } catch (error) {
      toast.error("Erreur lors de l'import");
    } finally {
      setUploading(null);
    }
  };

  // =============================
  // GESTIONNAIRE D'URL
  // =============================
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      toast.error("Veuillez entrer une URL");
      return;
    }

    try {
      new URL(urlInput); // Validation simple
    } catch {
      toast.error("URL invalide");
      return;
    }

    setUploading("url");
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("URL analysée:", urlInput);
      toast.success("Lien analysé avec succès !");
      setUrlInput("");
      setShowUrlInput(false);
    } catch (error) {
      toast.error("Erreur lors de l'analyse");
    } finally {
      setUploading(null);
    }
  };

  // =============================
  // RENDU
  // =============================
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 transition-colors duration-300">
      <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Centre de documents
      </h2>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Boutons PDF et Image avec input file caché */}
        {documentTypes.map((type) => {
          const Icon = type.icon;
          const isUploading = uploading === type.id;
          const colorMap = {
            blue: "text-blue-600 dark:text-blue-400",
            purple: "text-purple-600 dark:text-purple-400",
            green: "text-green-600 dark:text-green-400"
          };

          // Cas spécial pour l'URL
          if (type.id === "url") {
            return (
              <div key={type.id} className="space-y-2">
                {!showUrlInput ? (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    disabled={isUploading}
                    className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-green-300 dark:hover:border-green-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={type.label}
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400 animate-spin" />
                    ) : (
                      <Icon
                        className={`w-8 h-8 mx-auto mb-2 ${colorMap[type.color]}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {type.description}
                    </p>
                  </button>
                ) : (
                  <div className="border-2 border-green-300 dark:border-green-600 rounded-xl p-4 bg-green-50 dark:bg-green-900/20">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      aria-label="Saisir une URL"
                      disabled={isUploading}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleUrlSubmit}
                        disabled={isUploading}
                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isUploading ? "Analyse..." : "Valider"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(false)}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Boutons avec input file
          return (
            <div key={type.id}>
              <input
                ref={fileInputRefs[type.id]}
                type="file"
                accept={type.accept}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(type.id, file);
                }}
                className="hidden"
                aria-label={`Sélectionner un fichier ${type.label}`}
              />
              <button
                type="button"
                onClick={() => fileInputRefs[type.id].current?.click()}
                disabled={isUploading}
                className={`
                  w-full border-2 border-gray-200 dark:border-gray-700 
                  rounded-xl p-6 
                  hover:border-${type.color}-300 dark:hover:border-${type.color}-600 
                  hover:bg-gray-50 dark:hover:bg-gray-700/50 
                  transition-all disabled:opacity-50 disabled:cursor-not-allowed
                `}
                aria-label={type.label}
              >
                {isUploading ? (
                  <Loader2 className={`w-8 h-8 mx-auto mb-2 ${colorMap[type.color]} animate-spin`} />
                ) : (
                  <Icon
                    className={`w-8 h-8 mx-auto mb-2 ${colorMap[type.color]}`}
                    aria-hidden="true"
                  />
                )}
                <span className="font-medium text-gray-900 dark:text-white">
                  {type.label}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {type.description}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

DocumentCenter.propTypes = {};

export default DocumentCenter;
