/**
 * Constructeur d'arbre de fichiers pour le module Vibe-Coding
 * 
 * Rôle: Construire et gérer la structure arborescente des fichiers
 * - Construire l'arbre à partir d'une liste de fichiers
 * - Gérer l'ouverture/fermeture des dossiers
 * - Filtrer et rechercher des fichiers
 * - Drag & drop pour réorganiser
 * - Support de l'accessibilité et virtualisation
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';

// =============================
// HELPER — LECTURE DE FICHIERS OS
// =============================

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = reject;
  reader.readAsText(file);
});

// =============================
// CONSTANTES ET CONFIGURATION
// =============================

// Support multilingue
const I18N = {
  fr: {
    searchPlaceholder: 'Rechercher des fichiers...',
    newFile: 'Nouveau fichier',
    newFolder: 'Nouveau dossier',
    collapseAll: 'Tout réduire',
    emptyFolder: 'Dossier vide',
    noFiles: 'Aucun fichier',
    createFile: 'Créer un fichier',
    rename: 'Renommer',
    delete: 'Supprimer',
    cancel: 'Annuler',
    fileExists: 'Un fichier avec ce nom existe déjà',
    errorMove: 'Erreur lors du déplacement',
    bytes: 'o'
  },
  en: {
    searchPlaceholder: 'Search files...',
    newFile: 'New file',
    newFolder: 'New folder',
    collapseAll: 'Collapse all',
    emptyFolder: 'Empty folder',
    noFiles: 'No files',
    createFile: 'Create file',
    rename: 'Rename',
    delete: 'Delete',
    cancel: 'Cancel',
    fileExists: 'A file with this name already exists',
    errorMove: 'Error moving file',
    bytes: 'B'
  }
};

// Icônes par type de fichier
const FILE_ICONS = {
  // Code
  '.js': '📄',
  '.jsx': '⚛️',
  '.ts': '📘',
  '.tsx': '⚛️',
  '.json': '📋',
  '.html': '🌐',
  '.css': '🎨',
  '.scss': '🎨',
  '.less': '🎨',
  '.py': '🐍',
  '.java': '☕',
  '.cpp': '⚙️',
  '.c': '⚙️',
  '.go': '🔵',
  '.rs': '⚙️',
  
  // Images
  '.png': '🖼️',
  '.jpg': '🖼️',
  '.jpeg': '🖼️',
  '.gif': '🖼️',
  '.svg': '🖼️',
  '.ico': '🖼️',
  '.webp': '🖼️',
  
  // Documents
  '.md': '📝',
  '.txt': '📄',
  '.pdf': '📕',
  '.doc': '📘',
  '.docx': '📘',
  
  // Config
  '.env': '⚙️',
  '.gitignore': '📌',
  'package.json': '📦',
  'README.md': '📖',
  '.eslintrc': '🔧',
  '.prettierrc': '🎨',
  
  // Dossiers
  'folder': '📁',
  'folder-open': '📂',
  
  // Fichiers spéciaux
  'App.js': '🚀',
  'index.js': '🏠',
  'main.js': '🔧',
  'server.js': '🌐'
};

// Extensions à ignorer
const IGNORED_EXTENSIONS = new Set(['.DS_Store', '.log', '.tmp', '.cache', '.pid']);

// Dossiers à ignorer
const IGNORED_FOLDERS = new Set(['node_modules', '.git', 'dist', 'build', '.cache', 'coverage']);

// Seuil pour la virtualisation
const VIRTUALIZATION_THRESHOLD = 100;

// =============================
// CLASSE FILE NODE
// =============================

class FileNode {
  constructor(name, path, type, parent = null) {
    this.name = name;
    this.path = path;
    this.type = type; // 'file' ou 'folder'
    this.parent = parent;
    this.children = type === 'folder' ? [] : null;
    this.isOpen = false;
    this.isSelected = false;
    this.isEditing = false;
    this.metadata = {};
    this.id = `${path}-${Date.now()}-${Math.random()}`;
  }

  addChild(node) {
    if (this.type === 'folder' && !this.findChild(node.name)) {
      this.children.push(node);
      node.parent = this;
      return true;
    }
    return false;
  }

  removeChild(node) {
    if (this.type === 'folder') {
      const index = this.children.findIndex(child => child.path === node.path);
      if (index !== -1) {
        this.children.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  findChild(name) {
    if (this.type === 'folder') {
      return this.children.find(child => child.name === name);
    }
    return null;
  }

  findChildByPath(path) {
    if (this.path === path) return this;
    if (this.type === 'folder') {
      for (const child of this.children) {
        const found = child.findChildByPath(path);
        if (found) return found;
      }
    }
    return null;
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  select() {
    this.isSelected = true;
  }

  deselect() {
    this.isSelected = false;
  }

  getPath() {
    if (!this.parent || this.parent.type === 'root') return this.name;
    return `${this.parent.getPath()}/${this.name}`;
  }

  getDepth() {
    if (!this.parent || this.parent.type === 'root') return 0;
    return this.parent.getDepth() + 1;
  }

  getAllDescendants() {
    if (this.type !== 'folder') return [this];
    
    let descendants = [this];
    this.children.forEach(child => {
      descendants = descendants.concat(child.getAllDescendants());
    });
    return descendants;
  }

  toJSON() {
    return {
      name: this.name,
      path: this.path,
      type: this.type,
      isOpen: this.isOpen,
      isSelected: this.isSelected,
      metadata: this.metadata,
      children: this.children?.map(child => child.toJSON())
    };
  }
}

// =============================
// COMPOSANT FILE TREE
// =============================

export const FileTreeBuilder = ({
  files = {},
  onFileSelect,
  onFileDelete,
  onFileRename,
  onCreateFile,
  onCreateFolder,
  onFileMove,
  selectedFile = null,
  filter = '',
  showHidden = false,
  language = 'fr',
  virtualize = true
}) => {
  const [root, setRoot] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [contextMenu, setContextMenu] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredNodes, setFilteredNodes] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [osDropping, setOsDropping] = useState(false);
  
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const i18n = I18N[language] || I18N.fr;

  // =============================
  // CONSTRUCTION DE L'ARBRE
  // =============================
  useEffect(() => {
    const buildTree = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const rootNode = new FileNode('root', '', 'root', null);
        const filePaths = Object.keys(files);

        filePaths.sort().forEach(filePath => {
          // Ignorer les fichiers système
          const extension = filePath.substring(filePath.lastIndexOf('.'));
          if (IGNORED_EXTENSIONS.has(extension)) return;
          
          const parts = filePath.split('/');
          let currentNode = rootNode;

          parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;
            const currentPath = parts.slice(0, index + 1).join('/');

            // Ignorer les dossiers système
            if (!isLast && IGNORED_FOLDERS.has(part)) return;

            // Chercher si le nœud existe déjà
            let childNode = currentNode.findChild(part);

            if (!childNode) {
              if (isLast) {
                // C'est un fichier
                childNode = new FileNode(part, currentPath, 'file', currentNode);
              } else {
                // C'est un dossier
                childNode = new FileNode(part, currentPath, 'folder', currentNode);
              }
              currentNode.addChild(childNode);
            }

            currentNode = childNode;
          });
        });

        setRoot(rootNode);
      } catch (err) {
        setError(`Erreur lors de la construction de l'arbre: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    buildTree();
  }, [files]);

  // =============================
  // FILTRAGE AVANCÉ
  // =============================
  useEffect(() => {
    if (!root || !searchQuery) {
      setFilteredNodes([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = new Set();

    const search = (node) => {
      // Recherche dans le nom
      if (node.name.toLowerCase().includes(query)) {
        results.add(node);
        // Ajouter tous les parents pour le contexte
        let parent = node.parent;
        while (parent && parent.type !== 'root') {
          results.add(parent);
          parent = parent.parent;
        }
      }
      
      // Recherche dans le chemin
      if (node.path.toLowerCase().includes(query)) {
        results.add(node);
      }
      
      // Recherche dans le contenu (si disponible)
      if (node.type === 'file' && files[node.path]?.toLowerCase().includes(query)) {
        results.add(node);
      }

      if (node.type === 'folder' && node.children) {
        node.children.forEach(search);
      }
    };

    search(root);
    setFilteredNodes(Array.from(results));
  }, [root, searchQuery, files]);

  // =============================
  // FLATTEN POUR VIRTUALISATION
  // =============================
  const flattenedNodes = useMemo(() => {
    if (!root) return [];
    
    const flatten = (node, result = []) => {
      // Ne pas inclure la racine
      if (node.type !== 'root') {
        result.push(node);
      }
      
      if (node.type === 'folder' && node.isOpen && node.children) {
        node.children.forEach(child => flatten(child, result));
      }
      return result;
    };

    const nodes = root.children.flatMap(child => flatten(child));
    
    // Trier: dossiers d'abord, puis fichiers
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [root]);

  const shouldVirtualize = virtualize && flattenedNodes.length > VIRTUALIZATION_THRESHOLD;

  // =============================
  // GESTION DES ÉVÉNEMENTS
  // =============================
  const handleNodeClick = useCallback((node, event) => {
    event?.stopPropagation();

    if (node.type === 'folder') {
      node.toggle();
      setExpandedFolders(prev => {
        const next = new Set(prev);
        if (node.isOpen) {
          next.add(node.path);
        } else {
          next.delete(node.path);
        }
        return next;
      });
    } else {
      onFileSelect?.(node.path);
    }
  }, [onFileSelect]);

  const handleKeyDown = useCallback((event, node) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        handleNodeClick(node, event);
        break;
      case 'ArrowRight':
        if (node.type === 'folder' && !node.isOpen) {
          handleNodeClick(node, event);
        }
        break;
      case 'ArrowLeft':
        if (node.type === 'folder' && node.isOpen) {
          handleNodeClick(node, event);
        }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        // Navigation au clavier à implémenter
        break;
      case 'Delete':
        if (onFileDelete) {
          onFileDelete(node.path);
        }
        break;
      case 'F2':
        if (onFileRename) {
          onFileRename(node.path);
        }
        break;
    }
  }, [handleNodeClick, onFileDelete, onFileRename]);

  const handleContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      node
    });
  }, []);

  const handleDragStart = useCallback((event, node) => {
    event.dataTransfer.setData('text/plain', node.path);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setDragImage(event.target, 0, 0);
    setDraggedNode(node);
  }, []);

  const handleDragOver = useCallback((event, node) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (node.type === 'folder') {
      setDropTarget(node);
    }
  }, []);

  const handleDrop = useCallback(async (event, targetNode) => {
    event.preventDefault();
    
    try {
      const sourcePath = event.dataTransfer.getData('text/plain');
      const sourceNode = draggedNode || root?.findChildByPath(sourcePath);

      if (!sourceNode || !targetNode || sourceNode === targetNode) {
        return;
      }

      if (targetNode.type !== 'folder') {
        setError('Impossible de déposer sur un fichier');
        return;
      }

      // Vérifier les conflits
      if (targetNode.findChild(sourceNode.name)) {
        setError(i18n.fileExists);
        return;
      }

      const newPath = `${targetNode.path}/${sourceNode.name}`;
      
      // Appeler le callback de déplacement
      if (onFileMove) {
        await onFileMove(sourceNode.path, newPath);
      }

      setError(null);
    } catch (err) {
      setError(`${i18n.errorMove}: ${err.message}`);
    } finally {
      setDraggedNode(null);
      setDropTarget(null);
    }
  }, [draggedNode, root, onFileMove, i18n]);

  const handleDragEnd = useCallback(() => {
    setDraggedNode(null);
    setDropTarget(null);
  }, []);

  const handleContextMenuAction = useCallback(async (action) => {
    if (!contextMenu) return;

    const { node } = contextMenu;

    try {
      switch (action) {
        case 'rename':
          await onFileRename?.(node.path);
          break;
        case 'delete':
          await onFileDelete?.(node.path);
          break;
        case 'newFile':
          await onCreateFile?.(node.path);
          break;
        case 'newFolder':
          await onCreateFolder?.(node.path);
          break;
      }
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, onFileRename, onFileDelete, onCreateFile, onCreateFolder]);

  // =============================
  // RENDU D'UN NŒUD
  // =============================
  const renderNode = (node, level = 0, style = {}) => {
    if (!node) return null;

    const isSelected = node.path === selectedFile;
    const isExpanded = expandedFolders.has(node.path);
    const isFilterMatch = filteredNodes.includes(node);
    const isDragged = draggedNode === node;
    const isDropTarget = dropTarget === node;
    const isEmptyFolder = node.type === 'folder' && node.children.length === 0;

    // Ne pas afficher les éléments filtrés si recherche active
    if (searchQuery && !isFilterMatch) {
      return null;
    }

    // Obtenir l'icône
    let icon = node.type === 'folder' 
      ? (isExpanded ? FILE_ICONS['folder-open'] : FILE_ICONS['folder'])
      : FILE_ICONS[node.name] || FILE_ICONS[node.path.substring(node.path.lastIndexOf('.'))] || '📄';

    // Formater la taille
    const fileSize = files[node.path]?.length;
    const formattedSize = fileSize !== undefined 
      ? fileSize < 1024 
        ? `${fileSize} ${i18n.bytes}`
        : fileSize < 1048576
          ? `${(fileSize / 1024).toFixed(1)} Ko`
          : `${(fileSize / 1048576).toFixed(1)} Mo`
      : null;

    return (
      <div
        key={node.id}
        className={`file-tree-node 
          ${isSelected ? 'selected' : ''} 
          ${isDragged ? 'dragging' : ''} 
          ${isDropTarget ? 'drop-target' : ''}
          ${node.type === 'folder' ? 'folder' : 'file'}`}
        style={{ 
          paddingLeft: `${level * 20 + 8}px`,
          ...style 
        }}
        role="treeitem"
        aria-expanded={node.type === 'folder' ? isExpanded : undefined}
        aria-selected={isSelected}
        aria-level={level + 1}
        aria-label={`${node.name} (${node.type})`}
        tabIndex={0}
        onClick={(e) => handleNodeClick(node, e)}
        onKeyDown={(e) => handleKeyDown(e, node)}
        onContextMenu={(e) => handleContextMenu(e, node)}
        draggable={node.type === 'file'}
        onDragStart={(e) => handleDragStart(e, node)}
        onDragOver={(e) => handleDragOver(e, node)}
        onDrop={(e) => handleDrop(e, node)}
        onDragEnd={handleDragEnd}
      >
        <span className="file-icon" aria-hidden="true">{icon}</span>
        <span className="file-name" title={`${node.path}\n${formattedSize || ''}`}>
          {node.name}
        </span>
        
        {node.type === 'file' && formattedSize && (
          <span className="file-size" aria-label={`Taille: ${formattedSize}`}>
            {formattedSize}
          </span>
        )}

        {isEmptyFolder && !searchQuery && (
          <span className="folder-empty-message" aria-label="Dossier vide">
            {i18n.emptyFolder}
          </span>
        )}
      </div>
    );
  };

  const renderVirtualNode = ({ index, style }) => {
    const node = flattenedNodes[index];
    return renderNode(node, node.getDepth(), style);
  };

  // =============================
  // RENDU PRINCIPAL
  // =============================
  // =============================
  // OS DRAG & DROP (depuis le système de fichiers)
  // =============================

  const handleContainerDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setOsDropping(true);
    }
  }, []);

  const handleContainerDragLeave = useCallback((e) => {
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setOsDropping(false);
    }
  }, []);

  const handleContainerDrop = useCallback(async (e) => {
    setOsDropping(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const droppedFiles = Array.from(e.dataTransfer.files);
    
    for (const file of droppedFiles) {
      try {
        const content = await readFileAsText(file);
        const targetPath = dropTarget 
          ? `${dropTarget.path}/${file.name}`
          : file.name;

        if (onCreateFile) {
          await onCreateFile(targetPath, content);
        }
      } catch (err) {
        setError(`Erreur import: ${file.name} — ${err.message}`);
      }
    }
  }, [dropTarget, onCreateFile]);

  return (
    <div 
      className={`file-tree-container${osDropping ? ' os-drop-active' : ''}`}
      ref={containerRef}
      role="tree"
      aria-label="Explorateur de fichiers"
      aria-busy={isLoading}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {/* Barre de recherche */}
      <div className="file-tree-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={i18n.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Rechercher des fichiers"
        />
        {searchQuery && (
          <button
            className="clear-search"
            onClick={() => {
              setSearchQuery('');
              searchInputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
          >
            ✕
          </button>
        )}
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="file-tree-error" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
          <button 
            className="error-close"
            onClick={() => setError(null)}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="file-tree-actions" role="toolbar">
        <button 
          onClick={() => onCreateFile?.()} 
          title={i18n.newFile}
          aria-label={i18n.newFile}
        >
          📄+
        </button>
        <button 
          onClick={() => onCreateFolder?.()} 
          title={i18n.newFolder}
          aria-label={i18n.newFolder}
        >
          📁+
        </button>
        <button 
          onClick={() => setExpandedFolders(new Set())} 
          title={i18n.collapseAll}
          aria-label={i18n.collapseAll}
        >
          📂-
        </button>
      </div>

      {/* Arbre des fichiers */}
      <div className="file-tree-content">
        {isLoading ? (
          <div className="file-tree-loading" role="status">
            <div className="loading-spinner">⌛</div>
            <div>Chargement...</div>
          </div>
        ) : error ? (
          <div className="file-tree-error-state">
            <div className="error-icon-large">❌</div>
            <div>{error}</div>
            <button onClick={() => window.location.reload()}>
              Réessayer
            </button>
          </div>
        ) : root && root.children.length > 0 ? (
          shouldVirtualize ? (
            <List
              height={containerRef.current?.clientHeight - 100 || 400}
              itemCount={flattenedNodes.length}
              itemSize={28}
              width="100%"
              className="virtualized-list"
            >
             {renderVirtualNode}
            </List>
          ) : (
            root.children
              .sort((a, b) => {
                if (a.type !== b.type) return -1;
                return a.name.localeCompare(b.name);
              })
              .map(node => renderNode(node, 0))
          )
        ) : (
          <div className="file-tree-empty">
            <div className="empty-icon" aria-hidden="true">📂</div>
            <div className="empty-text">{i18n.noFiles}</div>
            <button 
              onClick={() => onCreateFile?.()} 
              className="empty-button"
              aria-label={i18n.createFile}
            >
              {i18n.createFile}
            </button>
          </div>
        )}
      </div>

      {/* Menu contextuel */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          aria-label="Menu contextuel"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            onClick={() => handleContextMenuAction('rename')}
            role="menuitem"
          >
            {i18n.rename}
          </button>
          <button 
            onClick={() => handleContextMenuAction('delete')}
            role="menuitem"
          >
            {i18n.delete}
          </button>
          {contextMenu.node.type === 'folder' && (
            <>
              <button 
                onClick={() => handleContextMenuAction('newFile')}
                role="menuitem"
              >
                {i18n.newFile}
              </button>
              <button 
                onClick={() => handleContextMenuAction('newFolder')}
                role="menuitem"
              >
                {i18n.newFolder}
              </button>
            </>
          )}
          <button 
            onClick={() => setContextMenu(null)}
            role="menuitem"
          >
            {i18n.cancel}
          </button>
        </div>
      )}

      <style jsx>{`
        .file-tree-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #252525;
          color: #d4d4d4;
          font-size: 13px;
          user-select: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          position: relative;
          transition: outline 0.15s;
        }
        .file-tree-container.os-drop-active {
          outline: 2px dashed #007bff;
          outline-offset: -2px;
          background: #1a2a3a;
        }
        .file-tree-container.os-drop-active::after {
          content: 'Déposer des fichiers ici';
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #007bff;
          font-size: 13px;
          font-weight: bold;
          pointer-events: none;
          background: rgba(0,123,255,0.08);
        }
        .file-tree-search {
          position: relative;
          padding: 8px;
          border-bottom: 1px solid #3e3e3e;
        }
        .search-input {
          width: 100%;
          padding: 6px 8px;
          padding-right: 30px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          outline: none;
          font-size: 13px;
        }
        .search-input:focus {
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
        }
        .clear-search {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          border-radius: 4px;
        }
        .clear-search:hover {
          color: #fff;
          background: #3e3e3e;
        }
        .clear-search:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }
        .file-tree-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #5a2e2e;
          border-bottom: 1px solid #8b3e3e;
          color: #ffbaba;
          font-size: 12px;
        }
        .error-icon {
          font-size: 14px;
        }
        .error-message {
          flex: 1;
        }
        .error-close {
          background: transparent;
          border: none;
          color: #ffbaba;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }
        .error-close:hover {
          background: #6b3b3b;
        }
        .file-tree-actions {
          display: flex;
          gap: 4px;
          padding: 4px 8px;
          border-bottom: 1px solid #3e3e3e;
        }
        .file-tree-actions button {
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          color: #d4d4d4;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .file-tree-actions button:hover {
          background: #3e3e3e;
          border-color: #4e4e4e;
        }
        .file-tree-actions button:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }
        .file-tree-content {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .file-tree-node {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          cursor: pointer;
          border-radius: 3px;
          transition: background 0.2s;
          position: relative;
          min-height: 28px;
          outline: none;
        }
        .file-tree-node:hover {
          background: #2d2d2d;
        }
        .file-tree-node:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: -2px;
        }
        .file-tree-node.selected {
          background: #094771;
        }
        .file-tree-node.dragging {
          opacity: 0.5;
        }
        .file-tree-node.drop-target {
          background: #1e3a5f;
          border: 1px dashed #007bff;
        }
        .file-icon {
          font-size: 14px;
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }
        .file-name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 13px;
        }
        .file-size {
          color: #888;
          font-size: 11px;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .folder-empty-message {
          color: #888;
          font-size: 11px;
          font-style: italic;
          margin-left: 8px;
        }
        .file-tree-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #888;
          gap: 16px;
        }
        .loading-spinner {
          font-size: 32px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .file-tree-error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #ffbaba;
          gap: 16px;
          text-align: center;
        }
        .error-icon-large {
          font-size: 48px;
        }
        .file-tree-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #888;
          gap: 16px;
        }
        .empty-icon {
          font-size: 48px;
        }
        .empty-text {
          font-size: 14px;
        }
        .empty-button {
          padding: 8px 16px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .empty-button:hover {
          background: #3e3e3e;
          border-color: #4e4e4e;
        }
        .empty-button:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }
        .context-menu {
          position: fixed;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          padding: 4px 0;
          min-width: 150px;
          z-index: 1000;
          box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        .context-menu button {
          display: block;
          width: 100%;
          padding: 8px 16px;
          background: transparent;
          border: none;
          color: #d4d4d4;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }
        .context-menu button:hover {
          background: #094771;
        }
        .context-menu button:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: -2px;
        }
        .virtualized-list {
          scrollbar-width: thin;
          scrollbar-color: #4e4e4e #2d2d2d;
        }
        .virtualized-list::-webkit-scrollbar {
          width: 8px;
        }
        .virtualized-list::-webkit-scrollbar-track {
          background: #2d2d2d;
        }
        .virtualized-list::-webkit-scrollbar-thumb {
          background: #4e4e4e;
          border-radius: 4px;
        }
        .virtualized-list::-webkit-scrollbar-thumb:hover {
          background: #5e5e5e;
        }
      `}</style>
    </div>
  );
};

// =============================
// HOOK PERSONNALISÉ
// =============================
export const useFileTree = (initialFiles = {}, options = {}) => {
  const [files, setFiles] = useState(initialFiles);
  const [selectedFile, setSelectedFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Sauvegarder l'état pour l'undo/redo
  const saveToHistory = useCallback((newFiles) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newFiles);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const addFile = useCallback(async (path, content = '') => {
    setFiles(prev => {
      const newFiles = { ...prev, [path]: content };
      saveToHistory(newFiles);
      return newFiles;
    });
  }, [saveToHistory]);

  const deleteFile = useCallback(async (path) => {
    setFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[path];
      saveToHistory(newFiles);
      return newFiles;
    });
    if (selectedFile === path) {
      setSelectedFile(null);
    }
  }, [selectedFile, saveToHistory]);

  const renameFile = useCallback(async (oldPath, newPath) => {
    setFiles(prev => {
      const newFiles = { ...prev };
      newFiles[newPath] = newFiles[oldPath];
      delete newFiles[oldPath];
      saveToHistory(newFiles);
      return newFiles;
    });
    if (selectedFile === oldPath) {
      setSelectedFile(newPath);
    }
  }, [selectedFile, saveToHistory]);

  const moveFile = useCallback(async (oldPath, newPath) => {
    return renameFile(oldPath, newPath);
  }, [renameFile]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setFiles(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setFiles(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // Initialiser l'historique
  useEffect(() => {
    if (history.length === 0 && Object.keys(initialFiles).length > 0) {
      setHistory([initialFiles]);
      setHistoryIndex(0);
    }
  }, [initialFiles, history.length]);

  return {
    files,
    setFiles,
    selectedFile,
    setSelectedFile,
    addFile,
    deleteFile,
    renameFile,
    moveFile,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
};

// =============================
// EXPORT
// =============================
export default FileTreeBuilder;
