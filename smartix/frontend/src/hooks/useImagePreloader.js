import { useRef, useCallback, useState, useEffect } from 'react';

const MAX_CONCURRENT = 3;
const TIMEOUT = 8000;

export const useImagePreloader = () => {
  const [isPreloading, setIsPreloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const batchRef = useRef(0);
  const imagesRef = useRef(new Set());
  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const loadedRef = useRef(0);
  const totalRef = useRef(0);
  const isMountedRef = useRef(true);
  const queueRunningRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancelAll();
    };
  }, []);

  // =============================
  // ANNULATION RÉELLE
  // =============================
  const cancelAll = useCallback(() => {
    batchRef.current++;

    imagesRef.current.forEach(img => {
      img.src = '';
      img.onload = null;
      img.onerror = null;
    });

    imagesRef.current.clear();
    queueRef.current = [];
    activeRef.current = 0;
    loadedRef.current = 0;
    totalRef.current = 0;
    queueRunningRef.current = false;

    setIsPreloading(false);
    setProgress(0);
  }, []);

  // =============================
  // CHARGEMENT D’UNE IMAGE
  // =============================
  const loadImage = useCallback((url, batchId) => {
    return new Promise((resolve) => {
      if (batchRef.current !== batchId) return resolve();

      const img = new Image();
      imagesRef.current.add(img);

      let done = false;

      const finish = () => {
        if (done) return;
        done = true;

        imagesRef.current.delete(img);
        img.onload = null;
        img.onerror = null;

        // ✅ Vérification du batch avant mise à jour
        if (batchRef.current === batchId && isMountedRef.current) {
          loadedRef.current++;
          const newProgress = Math.min(100, (loadedRef.current / totalRef.current) * 100);
          setProgress(newProgress);
        }

        resolve();
      };

      const timer = setTimeout(finish, TIMEOUT);

      img.onload = () => {
        clearTimeout(timer);
        finish();
      };

      img.onerror = () => {
        clearTimeout(timer);
        finish();
      };

      img.src = url;
    });
  }, []);

  // =============================
  // WORKER (AUTO-ALIMENTÉ)
  // =============================
  const runQueue = useCallback(async (batchId) => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;

    while (queueRef.current.length > 0 && batchRef.current === batchId) {
      if (activeRef.current >= MAX_CONCURRENT) {
        await new Promise(r => setTimeout(r, 50));
        continue;
      }

      const url = queueRef.current.shift();
      activeRef.current++;

      loadImage(url, batchId).finally(() => {
        activeRef.current--;
        // ✅ Relancer la queue si nécessaire
        if (queueRef.current.length > 0 && batchRef.current === batchId) {
          runQueue(batchId);
        }
      });
    }

    queueRunningRef.current = false;
  }, [loadImage]);

  // =============================
  // PRELOAD PRINCIPAL
  // =============================
  const preload = useCallback(async (urls) => {
    if (!urls?.length) return;

    cancelAll();

    const unique = [...new Set(urls)];
    const batchId = Date.now();
    batchRef.current = batchId;

    totalRef.current = unique.length;
    loadedRef.current = 0;

    setIsPreloading(true);
    setProgress(0);

    // Priorité simple : les 3 premières
    const priority = unique.slice(0, 3);
    const rest = unique.slice(3);

    queueRef.current = [...priority, ...rest];

    await runQueue(batchId);

    // Attendre la fin réelle
    while (activeRef.current > 0 && batchRef.current === batchId) {
      await new Promise(r => setTimeout(r, 50));
    }

    if (batchRef.current === batchId && isMountedRef.current) {
      setIsPreloading(false);
      setProgress(100);
    }

  }, [cancelAll, runQueue]);

  // =============================
  // 🆕 PRELOAD VISIBLE (basé sur les éléments DOM)
  // =============================
  const preloadVisible = useCallback(async (elements, getImageUrl) => {
    if (!elements || elements.length === 0) return;

    const visibleUrls = elements
      .filter(el => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight + 200 && rect.bottom > -200;
        return isVisible;
      })
      .map(el => getImageUrl(el))
      .filter(Boolean);

    if (visibleUrls.length > 0) {
      await preload(visibleUrls);
      return;
    }

    // Fallback: précharger les 3 premières si rien n'est visible
    const firstUrls = elements
      .slice(0, 3)
      .map(el => getImageUrl(el))
      .filter(Boolean);

    if (firstUrls.length > 0) {
      await preload(firstUrls);
    }
  }, [preload]);

  return {
    preload,
    preloadVisible,
    cancelAll,
    isPreloading,
    progress
  };
};
