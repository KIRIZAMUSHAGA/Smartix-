/**
 * useKeyboardShortcuts - Hook pour les raccourcis clavier globaux de l'IDE
 *
 * Raccourcis gérés :
 * - F5              → recharger la preview
 * - Ctrl+Enter      → exécuter le projet (Run)
 * - Ctrl+`          → ouvrir/fermer le terminal
 * - Ctrl+B          → afficher/cacher la sidebar
 * - Ctrl+K / Cmd+K  → ouvrir la palette de commandes
 */

import { useEffect, useCallback } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

const useKeyboardShortcuts = ({
  onReloadPreview,
  onRunProject,
  onToggleTerminal,
  onToggleSidebar,
  onOpenCommandPalette,
  enabled = true,
}) => {

  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    const ctrl = e.ctrlKey || (isMac && e.metaKey);
    const key = e.key;

    // F5 → recharger la preview
    if (key === 'F5') {
      e.preventDefault();
      onReloadPreview?.();
      return;
    }

    // Ctrl+Enter → exécuter le projet
    if (ctrl && key === 'Enter') {
      e.preventDefault();
      onRunProject?.();
      return;
    }

    // Ctrl+` → toggle terminal
    if (ctrl && key === '`') {
      e.preventDefault();
      onToggleTerminal?.();
      return;
    }

    // Ctrl+B → toggle sidebar
    if (ctrl && key === 'b') {
      e.preventDefault();
      onToggleSidebar?.();
      return;
    }

    // Ctrl+K → ouvrir palette de commandes
    if (ctrl && key === 'k') {
      e.preventDefault();
      onOpenCommandPalette?.();
      return;
    }
  }, [enabled, onReloadPreview, onRunProject, onToggleTerminal, onToggleSidebar, onOpenCommandPalette]);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
};

export default useKeyboardShortcuts;
