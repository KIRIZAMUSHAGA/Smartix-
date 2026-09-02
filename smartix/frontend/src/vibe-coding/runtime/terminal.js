/**
 * Terminal / Console pour le module Vibe-Coding
 * Utilise xterm.js pour reproduire l'interface Replit
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

// Styles xterm
import 'xterm/css/xterm.css';
import PropTypes from 'prop-types';

export const ConsoleTerminal = ({ projectId, userId, height = '100%' }) => {
  const terminalRef = useRef(null);
  const terminalContainerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!terminalContainerRef.current) return;

    // Initialiser xterm.js
    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selection: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff'
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      tabStopWidth: 4
    });

    // Addons
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // Ouvrir le terminal
    term.open(terminalContainerRef.current);
    fitAddon.fit();

    // Écrire un message de bienvenue
    term.writeln('\x1b[1;32mVibe-Coding Terminal\x1b[0m');
    term.writeln('\x1b[2;37mConnecté au runtime du projet\x1b[0m');
    term.writeln('');

    // Simuler des logs de développement
    const mockLogs = [
      { type: 'info', message: '🚀 Démarrage du serveur de développement...' },
      { type: 'success', message: '✅ Serveur démarré sur http://localhost:3000' },
      { type: 'api', message: 'GET /api/posts 200 15ms' },
      { type: 'api', message: 'GET /api/users 404 Not Found' },
      { type: 'error', message: '❌ Erreur: Module "fs" non trouvé' },
      { type: 'build', message: '📦 Build en cours...' },
      { type: 'success', message: '✅ Build terminé' }
    ];

    mockLogs.forEach(log => {
      setTimeout(() => {
        if (log.type === 'error') {
          term.writeln(`\x1b[1;31m${log.message}\x1b[0m`);
        } else if (log.type === 'success') {
          term.writeln(`\x1b[1;32m${log.message}\x1b[0m`);
        } else if (log.type === 'api') {
          term.writeln(`\x1b[2;37m${log.message}\x1b[0m`);
        } else {
          term.writeln(log.message);
        }
      }, 100 * mockLogs.indexOf(log));
    });

    // Gérer le redimensionnement
    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener('resize', handleResize);

    // Sauvegarder la référence
    terminalRef.current = term;
    setIsConnected(true);

    // Nettoyage
    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [projectId, userId]);

  // Fonction pour ajouter un log
  const addLog = (message, type = 'info') => {
    if (!terminalRef.current) return;

    if (type === 'error') {
      terminalRef.current.writeln(`\x1b[1;31m${message}\x1b[0m`);
    } else if (type === 'success') {
      terminalRef.current.writeln(`\x1b[1;32m${message}\x1b[0m`);
    } else {
      terminalRef.current.writeln(message);
    }

    setLogs(prev => [...prev, { message, type, timestamp: Date.now() }]);
  };

  // Fonction pour nettoyer
  const clearTerminal = () => {
    if (!terminalRef.current) return;
    terminalRef.current.clear();
    setLogs([]);
  };

  return (
    <div className="terminal-container" style={{ height, display: 'flex', flexDirection: 'column' }}>
      {/* Barre d'outils du terminal */}
      <div className="terminal-toolbar">
        <div className="terminal-title">Console</div>
        <div className="terminal-actions">
          <button onClick={clearTerminal} title="Effacer">🗑️</button>
          <button onClick={() => terminalRef.current?.scrollToBottom()} title="Bas">⬇️</button>
        </div>
      </div>

      {/* Terminal xterm.js */}
      <div 
        ref={terminalContainerRef} 
        className="terminal-xterm"
        style={{ flex: 1, background: '#1e1e1e' }}
      />

      {/* Statistiques */}
      <div className="terminal-status">
        {isConnected ? '✅ Connecté' : '⏳ Connexion...'} • {logs.length} logs
      </div>

      <style jsx>{`
        .terminal-container {
          background: #1e1e1e;
          border-radius: 4px;
          overflow: hidden;
        }
        .terminal-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 8px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
        }
        .terminal-title {
          color: #fff;
          font-size: 12px;
          font-weight: bold;
        }
        .terminal-actions {
          display: flex;
          gap: 4px;
        }
        .terminal-actions button {
          background: #3e3e3e;
          border: none;
          color: #fff;
          padding: 2px 6px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
        }
        .terminal-actions button:hover {
          background: #505050;
        }
        .terminal-xterm {
          height: calc(100% - 50px);
        }
        .terminal-status {
          padding: 2px 8px;
          background: #2d2d2d;
          color: #888;
          font-size: 11px;
          border-top: 1px solid #3e3e3e;
        }
      `}</style>
    </div>
  );
};

ConsoleTerminal.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  height: PropTypes.number,
};

export default ConsoleTerminal;
