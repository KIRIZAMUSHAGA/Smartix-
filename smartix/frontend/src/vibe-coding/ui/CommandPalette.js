/**
 * CommandPalette - Palette de commandes style VS Code (Ctrl+K)
 *
 * Fonctionnalités :
 * - Modal plein écran avec barre de recherche
 * - Filtre en temps réel des commandes
 * - Navigation clavier (↑↓ Enter Echap)
 * - Commandes : ouvrir fichier, exécuter, recherche, toggle thème, git commit
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const CommandPalette = ({
  isOpen,
  onClose,
  onOpenFile,
  onRunProject,
  onOpenSearch,
  onToggleTheme,
  onGitCommit,
  theme = 'dark',
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const ALL_COMMANDS = [
    {
      id: 'open-file',
      label: 'Ouvrir un fichier...',
      icon: '📂',
      description: 'Ouvrir un fichier du projet',
      action: () => { onOpenFile?.(); onClose(); },
      keywords: ['ouvrir', 'fichier', 'open', 'file'],
    },
    {
      id: 'run-project',
      label: 'Exécuter le projet',
      icon: '▶️',
      description: 'Lancer le projet (Run)',
      action: () => { onRunProject?.(); onClose(); },
      keywords: ['run', 'exécuter', 'lancer', 'démarrer', 'start'],
    },
    {
      id: 'global-search',
      label: 'Recherche globale',
      icon: '🔍',
      description: 'Rechercher dans tous les fichiers (Ctrl+Shift+F)',
      action: () => { onOpenSearch?.(); onClose(); },
      keywords: ['recherche', 'search', 'global', 'grep', 'trouver'],
    },
    {
      id: 'toggle-theme',
      label: 'Basculer le thème',
      icon: '🌓',
      description: 'Alterner entre thème clair et sombre',
      action: () => { onToggleTheme?.(); onClose(); },
      keywords: ['thème', 'theme', 'clair', 'sombre', 'dark', 'light', 'toggle'],
    },
    {
      id: 'git-commit',
      label: 'Git commit',
      icon: '📝',
      description: 'Créer un commit Git',
      action: () => { onGitCommit?.(); onClose(); },
      keywords: ['git', 'commit', 'version', 'sauvegarde', 'versionner'],
    },
  ];

  const filteredCommands = query.trim() === ''
    ? ALL_COMMANDS
    : ALL_COMMANDS.filter(cmd => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          cmd.keywords.some(k => k.includes(q))
        );
      });

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }, [filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  const isDark = theme === 'dark';
  const bg = isDark ? '#1e1e1e' : '#ffffff';
  const bg2 = isDark ? '#2d2d2d' : '#f3f3f3';
  const border = isDark ? '#3e3e3e' : '#e0e0e0';
  const textColor = isDark ? '#d4d4d4' : '#1e1e1e';
  const subColor = isDark ? '#888' : '#666';
  const hoverBg = isDark ? '#094771' : '#0066cc22';
  const selectedBg = isDark ? '#094771' : '#0066cc33';

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        style={{ ...paletteStyle, background: bg, border: `1px solid ${border}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Barre de recherche */}
        <div style={{ ...searchBarStyle, background: bg2, borderBottom: `1px solid ${border}` }}>
          <span style={{ fontSize: 16, opacity: 0.6 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher une commande..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              ...searchInputStyle,
              color: textColor,
              background: 'transparent',
            }}
            aria-label="Rechercher une commande"
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: subColor, fontSize: 14 }}
              aria-label="Effacer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Liste de commandes */}
        <div
          style={{ ...commandListStyle }}
          role="listbox"
        >
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: subColor, fontSize: 13 }}>
              Aucune commande trouvée
            </div>
          ) : (
            filteredCommands.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    ...commandItemStyle,
                    background: isSelected ? selectedBg : 'transparent',
                    color: textColor,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{cmd.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: isSelected ? 'bold' : 'normal', fontSize: 13 }}>
                      {cmd.label}
                    </div>
                    <div style={{ fontSize: 11, color: subColor, marginTop: 2 }}>
                      {cmd.description}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ ...footerStyle, borderTop: `1px solid ${border}`, color: subColor }}>
          <span>↑↓ naviguer</span>
          <span>↵ sélectionner</span>
          <span>Echap fermer</span>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '15vh',
};

const paletteStyle = {
  width: 580,
  maxWidth: '90vw',
  borderRadius: 8,
  boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '60vh',
};

const searchBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
};

const searchInputStyle = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 14,
  fontFamily: 'inherit',
};

const commandListStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
};

const commandItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  cursor: 'pointer',
  transition: 'background 0.1s',
};

const footerStyle = {
  display: 'flex',
  gap: 16,
  padding: '8px 16px',
  fontSize: 11,
  opacity: 0.7,
};

export default CommandPalette;
