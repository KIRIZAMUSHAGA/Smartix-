import React, { createContext, useContext, useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';

const ImmersiveStoryViewer = lazy(() => import('../components/ImmersiveStoryViewer'));

const StoryViewerContext = createContext();

export const useStoryViewer = () => {
  const context = useContext(StoryViewerContext);
  if (!context) {
    throw new Error('useStoryViewer must be used within a StoryViewerProvider');
  }
  return context;
};

export const StoryViewerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stories, setStories] = useState([]);
  const [initialIndex, setInitialIndex] = useState(0);
  const scrollPositionRef = useRef(0);

  const openViewer = useCallback((storiesData, startIndex = 0) => {
    if (!storiesData || storiesData.length === 0) return;
    
    // ✅ Sauvegarder la position de scroll avant ouverture
    scrollPositionRef.current = window.scrollY;
    
    setStories(storiesData);
    setInitialIndex(startIndex);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
    
    // ✅ Restaurer la position de scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollPositionRef.current);
    
    setTimeout(() => {
      setStories([]);
      setInitialIndex(0);
      scrollPositionRef.current = 0;
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, []);

  return (
    <StoryViewerContext.Provider value={{ 
      isOpen, 
      stories, 
      initialIndex, 
      openViewer, 
      closeViewer 
    }}>
      {children}
      {isOpen && stories.length > 0 && (
        <Suspense fallback={null}>
          <ImmersiveStoryViewer
            stories={stories}
            initialIndex={initialIndex}
            onClose={closeViewer}
          />
        </Suspense>
      )}
    </StoryViewerContext.Provider>
  );
};

export default StoryViewerContext;
StoryViewerProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
