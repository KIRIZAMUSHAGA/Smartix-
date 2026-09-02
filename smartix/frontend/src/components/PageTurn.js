
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import AudioReader from './AudioReader';
import { playPageTurn } from '../utils/soundPlayer';
import '../styles/animations.css';
import PropTypes from 'prop-types';

/**
 * PageTurn - Affiche une page unique avec navigation
 * Props:
 * - content: string - Contenu de la page
 * - pageNumber: number - Numéro de la page actuelle
 * - totalPages: number - Nombre total de pages
 * - onNext: function - Callback pour page suivante
 * - onPrevious: function - Callback pour page précédente
 * - isQuizMode: boolean - Si true, désactive la navigation arrière
 */
const PageTurn = ({ 
  content, 
  pageNumber, 
  totalPages, 
  onNext, 
  onPrevious,
  isQuizMode = false
}) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState('forward');

  const handleNext = () => {
    if (isFlipping || pageNumber >= totalPages - 1) return;
    
    playPageTurn();
    setFlipDirection('forward');
    setIsFlipping(true);

    setTimeout(() => {
      setIsFlipping(false);
      if (onNext) onNext();
    }, 600);
  };

  const handlePrevious = () => {
    if (isFlipping || pageNumber <= 0 || isQuizMode) return;
    
    playPageTurn();
    setFlipDirection('reverse');
    setIsFlipping(true);

    setTimeout(() => {
      setIsFlipping(false);
      if (onPrevious) onPrevious();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Barre de lecture audio */}
      <div className="p-4 border-b bg-white dark:bg-gray-800">
        <AudioReader text={content} />
      </div>

      {/* Page principale */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="relative w-full max-w-4xl">
          <div
            className={`
              bg-white dark:bg-gray-800 
              rounded-lg shadow-2xl 
              p-8 md:p-12 
              min-h-[500px] 
              relative
              ${isFlipping ? (flipDirection === 'forward' ? 'page-flip-enter' : 'page-flip-reverse') : ''}
            `}
            style={{
              userSelect: isQuizMode ? 'none' : 'auto'
            }}
          >
            {/* Numéro de page */}
            <div className="absolute top-4 right-4 text-sm text-gray-500 dark:text-gray-400">
              Page {pageNumber + 1} / {totalPages}
            </div>

            {/* Contenu de la page */}
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">
                {content}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons de navigation */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t flex justify-between items-center">
        <Button
          onClick={handlePrevious}
          disabled={pageNumber <= 0 || isFlipping || isQuizMode}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </Button>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {pageNumber + 1} / {totalPages}
        </div>

        <Button
          onClick={handleNext}
          disabled={pageNumber >= totalPages - 1 || isFlipping}
          className="flex items-center gap-2 bg-gradient-to-r from-[#00B894] to-[#0984E3]"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

PageTurn.propTypes = {
  content: PropTypes.node.isRequired,
  pageNumber: PropTypes.any.isRequired,
  totalPages: PropTypes.any.isRequired,
  onNext: PropTypes.func.isRequired,
  onPrevious: PropTypes.func.isRequired,
  isQuizMode: PropTypes.bool,
};

export default PageTurn;
