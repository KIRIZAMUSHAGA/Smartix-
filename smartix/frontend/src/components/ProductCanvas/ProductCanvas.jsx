import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configuration du worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { toast } from 'sonner';
import axios from '../../config/axiosConfig';
import PropTypes from 'prop-types';

// Set up worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ProductCanvas = ({ productId, pdfUrl, onComplete }) => {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const loadedPdf = await loadingTask.promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setLoading(false);
      } catch (error) {
        console.error('Error loading PDF:', error);
        toast.error('Erreur lors du chargement du PDF');
        setLoading(false);
      }
    };

    if (pdfUrl) loadPdf();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdf && currentPage) {
      renderPage(currentPage, scale);
    }
  }, [pdf, currentPage, scale]);

  const renderPage = async (pageNo, pageScale) => {
    try {
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: pageScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  const togglePageSelection = (pageNo) => {
    setSelectedPages(prev => 
      prev.includes(pageNo) 
        ? prev.filter(p => p !== pageNo)
        : [...prev, pageNo].sort((a, b) => a - b)
    );
  };

  const handleSaveInternal = async () => {
    if (selectedPages.length === 0) {
      toast.error('Veuillez sélectionner au moins une page gratuite');
      return;
    }

    try {
      setProcessing(true);
      await axios.post(`/marketplace/products/${productId}/generate-preview`, {
        selected_pages: selectedPages
      });
      toast.success('Génération lancée en arrière-plan !');
      onComplete();
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Erreur lors de la génération de la preview');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="animate-spin" size={48} />
        <p>Chargement de l'outil de sélection...</p>
      </div>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">📖 Sélection des Pages Gratuites</h2>
          <p className="text-sm text-gray-500">Cochez les pages que vous souhaitez rendre accessibles gratuitement avant l'achat.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOut size={16} /></Button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <Button variant="outline" onClick={() => setScale(s => Math.min(2.0, s + 0.1))}><ZoomIn size={16} /></Button>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4">
        <div className="relative border rounded-lg overflow-hidden bg-gray-100 shadow-inner">
          <canvas ref={canvasRef} />
          <div className="absolute top-4 right-4">
            <label className="flex items-center p-3 bg-white/90 backdrop-blur rounded-full shadow-lg cursor-pointer border-2 hover:border-blue-500 transition-colors">
              <input 
                type="checkbox" 
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={selectedPages.includes(currentPage)}
                onChange={() => togglePageSelection(currentPage)}
              />
              <span className="ml-2 font-medium">Rendre gratuite</span>
            </label>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={20} />
          </Button>
          <span className="font-medium text-lg">Page {currentPage} sur {numPages}</span>
          <Button 
            variant="outline" 
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage === numPages}
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      </div>

      <div className="pt-6 border-t flex items-center justify-between">
        <div className="text-sm">
          <span className="font-bold text-blue-600">{selectedPages.length}</span> page(s) sélectionnée(s) : {selectedPages.join(', ')}
        </div>
        <Button 
          className="bg-green-600 hover:bg-green-700 text-white px-8"
          onClick={handleSaveInternal}
          disabled={processing || selectedPages.length === 0}
        >
          {processing ? (
            <><Loader2 className="animate-spin mr-2" size={18} /> Génération...</>
          ) : (
            <><Check className="mr-2" size={18} /> Valider la Sélection</>
          )}
        </Button>
      </div>
    </Card>
  );
};

ProductCanvas.propTypes = {
  productId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  pdfUrl: PropTypes.any.isRequired,
  onComplete: PropTypes.func.isRequired,
};

export default ProductCanvas;
