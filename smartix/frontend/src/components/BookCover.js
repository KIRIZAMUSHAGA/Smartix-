
import React from 'react';
import PropTypes from 'prop-types';
import { BookOpen } from 'lucide-react';
import { Button } from './ui/button';
import { playPageTurn } from '../utils/soundPlayer';
import '../styles/animations.css';

/**
 * BookCover - Page de couverture du chapitre
 * Props:
 * - chapter: object - Données du chapitre (id, title, cover)
 * - onOpen: function - Callback au clic pour ouvrir le livre
 */
const BookCover = ({ chapter, onOpen }) => {
  const handleOpen = () => {
    playPageTurn();
    if (onOpen) {
      setTimeout(() => onOpen(), 300);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4">
      <div 
        className="book-cover-container relative"
        style={{
          width: '100%',
          maxWidth: '600px',
          aspectRatio: '3/4'
        }}
      >
        <div
          className="book-cover bg-gradient-to-br shadow-2xl rounded-lg p-12 flex flex-col items-center justify-center text-white relative overflow-hidden cursor-pointer transition-transform hover:scale-105"
          style={{
            backgroundColor: chapter.cover?.color || '#00B894',
            height: '100%'
          }}
          onClick={handleOpen}
        >
          {/* Effet de texture */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent"></div>
          </div>

          {/* Contenu */}
          <div className="relative z-10 text-center">
            <BookOpen className="w-20 h-20 mx-auto mb-6 opacity-90" />
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {chapter.cover?.title || `Chapitre ${chapter.id}`}
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">
              {chapter.cover?.subtitle || chapter.title}
            </p>
            <Button
              size="lg"
              className="bg-white text-gray-900 hover:bg-gray-100 shadow-lg"
            >
              Ouvrir le livre
            </Button>
          </div>

          {/* Effet de reliure */}
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-black opacity-20"></div>
        </div>
      </div>
    </div>
  );
};

BookCover.propTypes = {
  chapter: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    cover: PropTypes.string,
    description: PropTypes.string
  }).isRequired,
  onOpen: PropTypes.func.isRequired
};

export default BookCover;
