/**
 * Sidebar - Barre latérale pour le module Vibe-Coding
 * Version corrigée avec:
 * - useMemo pour l'arbre
 * - Recherche fonctionnelle
 * - Pas de mutation d'objets
 * - Modals au lieu de prompt()
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { projectManager } from '../core/projectManager';
import { fileManager } from '../editor/fileManager';
import PropTypes from 'prop-types';

// Icônes (version texte pour éviter dépendances)
const ICONS = {
  project: '📁',
  file: '📄',
  folder: '📂',
  folderOpen: '📂',
  template: '📋',
  settings: '⚙️',
  search: '🔍',
  plus: '➕',
  trash: '🗑️',
  edit: '✏️',
  copy: '📋',
  close: '✕',
  check: '✓'
};

// =============================
// MODAL DE RENOMMAGE
// =============================
const RenameModal = ({ isOpen, onClose, onRename, currentName, title }) => {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onRename(name.trim());
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>{ICONS.close}</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="Nouveau nom"
          />
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Annuler</button>
            <button type="submit" disabled={!name.trim()}>
              {ICONS.check} Renommer
            </button>
          </div>
        </form>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
          }
          .modal-content {
            background: #2d2d2d;
            border-radius: 8px;
            width: 400px;
            padding: 20px;
            color: #fff;
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .modal-header h3 {
            margin: 0;
            font-size: 16px;
          }
          .modal-close {
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            font-size: 18px;
          }
          .modal-close:hover {
            color: #fff;
          }
          input {
            width: 100%;
            padding: 10px;
            background: #3e3e3e;
            border: 1px solid #4e4e4e;
            border-radius: 4px;
            color: #fff;
            margin-bottom: 20px;
            font-size: 14px;
          }
          input:focus {
            outline: none;
            border-color: #007bff;
          }
          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .modal-actions button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          }
          .modal-actions button:first-child {
            background: transparent;
            color: #888;
          }
          .modal-actions button:first-child:hover {
            color: #fff;
          }
          .modal-actions button:last-child {
            background: #007bff;
            color: white;
          }
          .modal-actions button:last-child:hover {
            background: #0056b3;
          }
          .modal-actions button:last-child:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </div>
  );
};

// =============================
// MODAL DE CONFIRMATION
// =============================
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>{ICONS.close}</button>
        </div>
        
        <p style={{ marginBottom: '20px', color: '#ccc' }}>{message}</p>
        
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Annuler</button>
          <button 
            type="button" 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{ background: '#dc3545' }}
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================
// MODAL DE CRÉATION
// =============================
const CreateModal = ({ isOpen, onClose, onCreate, title, placeholder }) => {
  const [name, setName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      setName('');
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>{ICONS.close}</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder={placeholder}
          />
          
          <div className="modal-actions">
            <button type="button" onClick={onClose}>Annuler</button>
            <button type="submit" disabled={!name.trim()}>
              {ICONS.check} Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================
export const Sidebar = ({
  userId,
  currentProjectId,
  onSelectProject,
  onSelectFile,
  onNewProject,
  onNewFile,
  onDeleteProject,
  onRenameProject,
  theme = 'dark'
}) => {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('files'); // 'files', 'templates', 'projects'
  const [loading, setLoading] = useState(false);

  // Modals state
  const [renameModal, setRenameModal] = useState({ open: false, type: null, item: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, item: null });
  const [createModal, setCreateModal] = useState({ open: false, type: null });

  // =============================
  // CHARGEMENT DES PROJETS
  // =============================
  useEffect(() => {
    loadProjects();
  }, [userId]);

  useEffect(() => {
    if (currentProjectId) {
      loadProjectDetails(currentProjectId);
    }
  }, [currentProjectId]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const result = await projectManager.getUserProjects(userId, { limit: 50 });
      setProjects(result.projects || []);
    } catch (error) {
      console.error('Erreur chargement projets:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetails = async (projectId) => {
    try {
      const project = await projectManager.getProjectById(projectId, userId);
      setCurrentProject(project);
      
      if (project.files) {
        const fileList = Object.keys(project.files).map(path => ({
          path,
          name: path.split('/').pop(),
          type: path.includes('.') ? 'file' : 'folder'
        }));
        setFiles(fileList);
      }
    } catch (error) {
      console.error('Erreur chargement projet:', error);
    }
  };

  // =============================
  // FILTRAGE PAR RECHERCHE
  // =============================
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return projects;
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [projects, searchQuery]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    return files.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  // =============================
  // CONSTRUCTION DE L'ARBRE (optimisé)
  // =============================
  const fileTree = useMemo(() => {
    const buildTree = (paths) => {
      const tree = {};

      paths.forEach(({ path, type }) => {
        const parts = path.split('/');
        let current = tree;

        parts.forEach((part, index) => {
          if (!current[part]) {
            current[part] = {
              __type: index === parts.length - 1 ? type : 'folder',
              __path: parts.slice(0, index + 1).join('/'),
              __children: {}
            };
          }
          if (index < parts.length - 1) {
            current = current[part].__children;
          }
        });
      });

      return tree;
    };

    return buildTree(filteredFiles);
  }, [filteredFiles]);

  // =============================
  // GESTION DES FICHIERS
  // =============================
  const handleSelectFile = (filePath) => {
    onSelectFile?.(filePath);
  };

  const handleNewFile = () => {
    setCreateModal({ open: true, type: 'file' });
  };

  const handleNewFolder = () => {
    setCreateModal({ open: true, type: 'folder' });
  };

  const handleCreateFile = async (name) => {
    if (!currentProject) return;
    
    try {
      await fileManager.createFile(currentProject.id, name, '');
      await loadProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Erreur création fichier:', error);
    }
  };

  const handleCreateFolder = async (name) => {
    if (!currentProject) return;
    
    try {
      await fileManager.createFolder(currentProject.id, name);
      await loadProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Erreur création dossier:', error);
    }
  };

  const handleDeleteFile = (filePath) => {
    setConfirmModal({
      open: true,
      type: 'file',
      item: { path: filePath, name: filePath.split('/').pop() }
    });
  };

  const handleConfirmDeleteFile = async () => {
    if (!currentProject || !confirmModal.item) return;

    try {
      await fileManager.deleteFile(currentProject.id, confirmModal.item.path);
      await loadProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Erreur suppression fichier:', error);
    }
  };

  const handleRenameFile = (filePath) => {
    setRenameModal({
      open: true,
      type: 'file',
      item: { 
        path: filePath, 
        name: filePath.split('/').pop(),
        currentName: filePath.split('/').pop()
      }
    });
  };

  const handleConfirmRenameFile = async (newName) => {
    if (!currentProject || !renameModal.item) return;

    try {
      await fileManager.renameFile(currentProject.id, renameModal.item.path, newName);
      await loadProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Erreur renommage fichier:', error);
    }
  };

  // =============================
  // GESTION DES PROJETS
  // =============================
  const handleSelectProject = (projectId) => {
    onSelectProject?.(projectId);
  };

  const handleDeleteProject = (projectId, projectName) => {
    setConfirmModal({
      open: true,
      type: 'project',
      item: { id: projectId, name: projectName }
    });
  };

  const handleConfirmDeleteProject = async () => {
    if (!confirmModal.item) return;

    try {
      await projectManager.deleteProject(confirmModal.item.id, userId);
      await loadProjects();
      if (currentProjectId === confirmModal.item.id) {
        setCurrentProject(null);
        setFiles([]);
      }
    } catch (error) {
      console.error('Erreur suppression projet:', error);
    }
  };

  const handleRenameProject = (projectId, projectName) => {
    setRenameModal({
      open: true,
      type: 'project',
      item: { id: projectId, name: projectName, currentName: projectName }
    });
  };

  const handleConfirmRenameProject = async (newName) => {
    if (!renameModal.item) return;

    try {
      await projectManager.renameProject(renameModal.item.id, newName, userId);
      await loadProjects();
    } catch (error) {
      console.error('Erreur renommage projet:', error);
    }
  };

  // =============================
  // RENDU ARBRE DE FICHIERS (version corrigée)
  // =============================
  const renderFileTree = useCallback(() => {
    const renderNode = (node, name, depth = 0) => {
      const isFolder = node.__type === 'folder';
      const isExpanded = expandedFolders.has(node.__path);

      return (
        <div key={node.__path} className="tree-node">
          <div
            className="tree-node-header"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {isFolder && (
              <button
                className="folder-toggle"
                onClick={() => {
                  const newSet = new Set(expandedFolders);
                  if (isExpanded) {
                    newSet.delete(node.__path);
                  } else {
                    newSet.add(node.__path);
                  }
                  setExpandedFolders(newSet);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            
            <span className="node-icon">
              {isFolder 
                ? (isExpanded ? ICONS.folderOpen : ICONS.folder)
                : ICONS.file
              }
            </span>
            
            <span
              className="node-name"
              onClick={() => !isFolder && handleSelectFile(node.__path)}
            >
              {name}
            </span>

            {!isFolder && (
              <div className="node-actions">
                <button onClick={() => handleRenameFile(node.__path)} title="Renommer">
                  {ICONS.edit}
                </button>
                <button onClick={() => handleDeleteFile(node.__path)} title="Supprimer">
                  {ICONS.trash}
                </button>
              </div>
            )}
          </div>

          {isFolder && isExpanded && (
            <div className="tree-node-children">
              {Object.entries(node.__children).map(([childName, childNode]) => 
                renderNode(childNode, childName, depth + 1)
              )}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="file-tree">
        {Object.entries(fileTree).map(([name, node]) => 
          renderNode(node, name, 0)
        )}
      </div>
    );
  }, [fileTree, expandedFolders, handleSelectFile, handleRenameFile, handleDeleteFile]);

  // =============================
  // RENDU DES PROJETS (avec filtre)
  // =============================
  const renderProjects = () => {
    if (loading) {
      return <div className="sidebar-loading">Chargement...</div>;
    }

    return (
      <div className="projects-list">
        {filteredProjects.map(project => (
          <div
            key={project.id}
            className={`project-item ${project.id === currentProjectId ? 'active' : ''}`}
            onClick={() => handleSelectProject(project.id)}
          >
            <span className="project-icon">{ICONS.project}</span>
            <span className="project-name">{project.name}</span>
            
            <div className="project-actions">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameProject(project.id, project.name);
                }}
                title="Renommer"
              >
                {ICONS.edit}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.id, project.name);
                }}
                title="Supprimer"
              >
                {ICONS.trash}
              </button>
            </div>
          </div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="empty-state">
            {searchQuery ? (
              <p>Aucun projet correspondant à "{searchQuery}"</p>
            ) : (
              <>
                <p>Aucun projet</p>
                <button onClick={onNewProject} className="new-project-btn">
                  {ICONS.plus} Nouveau projet
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // =============================
  // RENDU DES TEMPLATES (avec filtre)
  // =============================
  const templates = [
    { id: 'todo', name: 'Todo App', icon: '✅', category: 'productivity' },
    { id: 'recipe', name: 'Recipe App', icon: '🍳', category: 'lifestyle' },
    { id: 'expense', name: 'Expense Tracker', icon: '💰', category: 'finance' },
    { id: 'chat', name: 'Chat App', icon: '💬', category: 'social' },
    { id: 'quiz', name: 'Quiz App', icon: '❓', category: 'education' }
  ];

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    return templates.filter(t => 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [templates, searchQuery]);

  // =============================
  // RENDU
  // =============================
  return (
    <div className={`sidebar sidebar-${theme}`}>
      {/* Modals */}
      <RenameModal
        isOpen={renameModal.open}
        onClose={() => setRenameModal({ open: false, type: null, item: null })}
        onRename={renameModal.type === 'project' ? handleConfirmRenameProject : handleConfirmRenameFile}
        currentName={renameModal.item?.currentName || ''}
        title={`Renommer ${renameModal.type === 'project' ? 'le projet' : 'le fichier'}`}
      />

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, type: null, item: null })}
        onConfirm={confirmModal.type === 'project' ? handleConfirmDeleteProject : handleConfirmDeleteFile}
        title={`Supprimer ${confirmModal.type === 'project' ? 'le projet' : 'le fichier'}`}
        message={`Voulez-vous vraiment supprimer "${confirmModal.item?.name || ''}" ?`}
      />

      <CreateModal
        isOpen={createModal.open}
        onClose={() => setCreateModal({ open: false, type: null })}
        onCreate={createModal.type === 'file' ? handleCreateFile : handleCreateFolder}
        title={`Nouveau ${createModal.type === 'file' ? 'fichier' : 'dossier'}`}
        placeholder={`Nom du ${createModal.type === 'file' ? 'fichier' : 'dossier'}`}
      />

        {/* En-tête */}
      <div className="sidebar-header">
        <h2>Vibe-Coding</h2>
        
        <div className="header-actions">
          <button onClick={onNewProject} title="Nouveau projet">
            {ICONS.plus}
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div className="sidebar-search">
        <span className="search-icon">{ICONS.search}</span>
        <input
          type="text"
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Onglets */}
      <div className="sidebar-tabs">
        <button
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          {ICONS.project} Projets
        </button>
        <button
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          {ICONS.folder} Fichiers
        </button>
        <button
          className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          {ICONS.template} Templates
        </button>
      </div>

      {/* Contenu */}
      <div className="sidebar-content">
        {activeTab === 'projects' && renderProjects()}
        
        {activeTab === 'files' && (
          <>
            {currentProject ? (
              <>
                <div className="files-header">
                  <span>{currentProject.name}</span>
                  <div className="files-actions">
                    <button onClick={handleNewFile} title="Nouveau fichier">
                      {ICONS.file}
                    </button>
                    <button onClick={handleNewFolder} title="Nouveau dossier">
                      {ICONS.folder}
                    </button>
                  </div>
                </div>
                {filteredFiles.length > 0 ? (
                  renderFileTree()
                ) : (
                  <div className="empty-state">
                    {searchQuery ? (
                      <p>Aucun fichier correspondant à "{searchQuery}"</p>
                    ) : (
                      <>
                        <p>Aucun fichier</p>
                        <button onClick={handleNewFile}>Créer un fichier</button>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>Sélectionnez un projet</p>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'templates' && (
          <div className="templates-list">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="template-item"
                onClick={() => onNewProject?.(template.id)}
              >
                <span className="template-icon">{template.icon}</span>
                <div className="template-info">
                  <span className="template-name">{template.name}</span>
                  <span className="template-category">{template.category}</span>
                </div>
                <span className="template-use">Utiliser</span>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="empty-state">
                <p>Aucun template correspondant à "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .sidebar {
          width: 280px;
          height: 100%;
          background: ${theme === 'dark' ? '#2d2d2d' : '#f5f5f5'};
          border-right: 1px solid ${theme === 'dark' ? '#3e3e3e' : '#ddd'};
          display: flex;
          flex-direction: column;
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid ${theme === 'dark' ? '#3e3e3e' : '#ddd'};
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sidebar-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: bold;
        }

        .header-actions button {
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#888' : '#666'};
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .header-actions button:hover {
          background: ${theme === 'dark' ? '#3e3e3e' : '#e5e5e5'};
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }

        .sidebar-search {
          padding: 12px 16px;
          position: relative;
        }

        .sidebar-search input {
          width: 100%;
          padding: 8px 8px 8px 32px;
          background: ${theme === 'dark' ? '#3e3e3e' : '#fff'};
          border: 1px solid ${theme === 'dark' ? '#4e4e4e' : '#ddd'};
          border-radius: 4px;
          color: ${theme === 'dark' ? '#fff' : '#333'};
          font-size: 13px;
        }

        .search-icon {
          position: absolute;
          left: 24px;
          top: 20px;
          color: ${theme === 'dark' ? '#888' : '#999'};
          font-size: 14px;
        }

        .sidebar-tabs {
          display: flex;
          padding: 0 16px;
          gap: 8px;
          border-bottom: 1px solid ${theme === 'dark' ? '#3e3e3e' : '#ddd'};
        }

        .tab {
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#888' : '#666'};
          cursor: pointer;
          font-size: 13px;
          border-bottom: 2px solid transparent;
        }

        .tab:hover {
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }

        .tab.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          }
                    /* Projets */
        .projects-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .project-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          position: relative;
        }

        .project-item:hover {
          background: ${theme === 'dark' ? '#3e3e3e' : '#e5e5e5'};
        }

        .project-item.active {
          background: ${theme === 'dark' ? '#3e3e3e' : '#e5e5e5'};
          color: #007bff;
        }

        .project-name {
          flex: 1;
          font-size: 13px;
        }

        .project-actions {
          display: none;
          gap: 4px;
        }

        .project-item:hover .project-actions {
          display: flex;
        }

        .project-actions button {
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#888' : '#666'};
          cursor: pointer;
          padding: 2px 4px;
        }

        .project-actions button:hover {
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }

        /* Fichiers */
        .files-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: bold;
        }

        .files-actions {
          display: flex;
          gap: 4px;
        }

        .files-actions button {
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#888' : '#666'};
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .files-actions button:hover {
          background: ${theme === 'dark' ? '#3e3e3e' : '#e5e5e5'};
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }

        /* Arbre de fichiers */
        .file-tree {
          user-select: none;
        }

        .tree-node-header {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 0;
          cursor: pointer;
          border-radius: 4px;
          position: relative;
        }

        .tree-node-header:hover {
          background: ${theme === 'dark' ? '#3e3e3e' : '#e5e5e5'};
        }

        .folder-toggle {
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#888' : '#666'};
          cursor: pointer;
          width: 20px;
          text-align: center;
          font-size: 10px;
        }

        .node-icon {
          width: 20px;
          text-align: center;
          font-size: 14px;
        }

        .node-name {
          flex: 1;
          font-size: 13px;
        }

        .node-actions {
          display: none;
          gap: 2px;
          margin-right: 4px;
        }

        .tree-node-header:hover .node-actions {
          display: flex;
        }

        .node-actions button {
          background: transparent;
          border: none;
          color: ${theme === 'dark' ? '#888' : '#666'};
          cursor: pointer;
          padding: 2px 4px;
          font-size: 12px;
        }

        .node-actions button:hover {
          color: ${theme === 'dark' ? '#fff' : '#333'};
        }

        .tree-node-children {
          margin-left: 20px;
        }

        /* Templates */
        .templates-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .template-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: ${theme === 'dark' ? '#3e3e3e' : '#f5f5f5'};
          border-radius: 4px;
          cursor: pointer;
        }

        .template-item:hover {
          background: ${theme === 'dark' ? '#4e4e4e' : '#e5e5e5'};
        }

        .template-icon {
          font-size: 24px;
        }

        .template-info {
          flex: 1;
        }

        .template-name {
          display: block;
          font-weight: bold;
          font-size: 14px;
        }

        .template-category {
          font-size: 12px;
          color: ${theme === 'dark' ? '#888' : '#666'};
        }

        .template-use {
          font-size: 12px;
          color: #007bff;
        }

        /* États vides */
        .empty-state {
          text-align: center;
          padding: 32px 16px;
          color: ${theme === 'dark' ? '#888' : '#999'};
        }

        .empty-state button {
          margin-top: 12px;
          padding: 8px 16px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }

        .empty-state button:hover {
          background: #0056b3;
        }

        .sidebar-loading {
          text-align: center;
          padding: 32px;
          color: ${theme === 'dark' ? '#888' : '#999'};
        }
      `}</style>
    </div>
  );
};

Sidebar.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  currentProjectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSelectProject: PropTypes.func.isRequired,
  onSelectFile: PropTypes.func.isRequired,
  onNewProject: PropTypes.func.isRequired,
  onNewFile: PropTypes.func.isRequired,
  onDeleteProject: PropTypes.func.isRequired,
  onRenameProject: PropTypes.func.isRequired,
  theme: PropTypes.object,
};

export default Sidebar;
RenameModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  currentName: PropTypes.any.isRequired,
  title: PropTypes.string.isRequired,
};
ConfirmModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.object.isRequired,
};
CreateModal.propTypes = {
  isOpen: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  placeholder: PropTypes.node.isRequired,
};
