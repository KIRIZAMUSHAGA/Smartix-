import { useEffect } from 'react';

const ErudaDevTools = ({ enabled = false }) => {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined;

    const existing = document.getElementById('eruda-devtools-script');

    const initEruda = () => {
      if (window.eruda && !window.__vibeErudaActive) {
        window.eruda.init({
          tool: ['console', 'elements', 'network', 'resources', 'info', 'sources'],
        });
        window.__vibeErudaActive = true;
      }
      window.eruda?.show?.();
    };

    if (existing) {
      initEruda();
    } else {
      const script = document.createElement('script');
      script.id = 'eruda-devtools-script';
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = initEruda;
      document.head.appendChild(script);
    }

    return () => {
      if (window.eruda && window.__vibeErudaActive) {
        window.eruda.destroy();
        window.__vibeErudaActive = false;
      }
    };
  }, [enabled]);

  return null;
};

export default ErudaDevTools;