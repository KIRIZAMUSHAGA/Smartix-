/**
 * Lazy-loaded MusicLibrary for code splitting
 * Reduces initial bundle size by ~50KB
 */
import React from 'react';
const MusicLibraryComponent = React.lazy(() => import('./MusicLibrary'));

export default MusicLibraryComponent;
