/**
 * 🏥 STICKER HEALTH CHECK
 * Validates sticker system is working correctly and fast
 */
import { useEffect, useState } from 'react';

export const useStickerHealthCheck = () => {
  const [status, setStatus] = useState({ healthy: true, issues: [] });

  useEffect(() => {
    const checkHealth = async () => {
      const issues = [];
      const startTime = performance.now();

      try {
        // Test 1: Load manifest
        const manifestStart = performance.now();
        const manifest = await fetch('/stickers/manifest.json').then(r => r.json());
        const manifestTime = performance.now() - manifestStart;
        
        if (manifestTime > 500) {
          issues.push(`Manifest loading slow: ${manifestTime.toFixed(0)}ms`);
        }

        // Test 2: Check file counts
        if (!manifest.categories || manifest.categories.length !== 6) {
          issues.push(`Expected 6 categories, got ${manifest.categories.length}`);
        }
        if (manifest.total !== 110) {
          issues.push(`Expected 110 stickers, got ${manifest.total}`);
        }

        // Test 3: Sample load a few stickers
        const sampleStart = performance.now();
        const category = manifest.categories[0];
        const stickerId = category.stickers[0].id;
        
        await Promise.all([
          fetch(`/stickers/${category.id}/${stickerId}.svg`).then(r => r.ok ? r.text() : Promise.reject('SVG failed')),
          fetch(`/stickers/${category.id}/${stickerId}.json`).then(r => r.ok ? r.json() : Promise.reject('JSON failed'))
        ]);
        
        const sampleTime = performance.now() - sampleStart;
        if (sampleTime > 200) {
          issues.push(`Sample sticker loading slow: ${sampleTime.toFixed(0)}ms`);
        }

        // Test 4: Memory footprint
        if (performance.memory) {
          const usedMemory = performance.memory.usedJSHeapSize / 1024 / 1024;
          if (usedMemory > 100) {
            issues.push(`High memory usage: ${usedMemory.toFixed(0)}MB`);
          }
        }

        const totalTime = performance.now() - startTime;
        console.log(`✅ Sticker health check completed in ${totalTime.toFixed(0)}ms`);

        setStatus({
          healthy: issues.length === 0,
          issues,
          metrics: { manifestTime, sampleTime, totalTime }
        });

      } catch (error) {
        issues.push(`Health check failed: ${error.message}`);
        setStatus({ healthy: false, issues });
      }
    };

    checkHealth();
  }, []);

  return status;
};
