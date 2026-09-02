/**
 * SideBar - Barre latérale de navigation
 * 
 * Affiche:
 * - Arborescence des fichiers avec navigation
 * - Actions sur les fichiers (créer, renommer, supprimer, dupliquer)
 * - Recherche de fichiers
 * - Informations du projet
 * - Gestion des favoris
 * - Historique des fichiers récents
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { 
  FolderTree, FileText, Plus, Upload, Download,
  Trash2, Edit, Copy, ChevronRight, ChevronDown,
  Search, X, Settings, Info, GitBranch, Star,
  History, RefreshCw, FileCode, FileJson, FileImage,
  File, Archive, Lock, Eye, EyeOff, AlertCircle,
  Grid, List, SortAsc, SortDesc, Filter
} from 'lucide-react'
import { Card } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Tooltip } from '../../components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '../../components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../../components/ui/context-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog'
import { ScrollArea } from '../../components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'

// Configuration
const CONFIG = {
  MAX_RECENT_FILES: 10,
  ANIMATION_DURATION: 200,
  SEARCH_DEBOUNCE: 300,
  FILE_ICONS: {
    js: '📄',
    jsx: '⚛️',
    ts: '📘',
    tsx: '⚛️',
    json: '📊',
    html: '🌐',
    css: '🎨',
    md: '📝',
    py: '🐍',
    java: '☕',
    rb: '💎',
    go: '🔵',
    rs: '🦀',
    php: '🐘',
    vue: '🟢',
    svelte: '🔥',
    dockerfile: '🐳',
    gitignore: '👁️',
    env: '🔐',
    default: '📄'
  }
}

// Composant d'icône de fichier
const FileIcon = ({ type, name }) => {
  const ext = name?.split('.').pop()?.toLowerCase()
  const iconMap = {
    folder: <FolderTree className="w-4 h-4 text-yellow-400" />,
    js: <FileCode className="w-4 h-4 text-yellow-400" />,
    jsx: <FileCode className="w-4 h-4 text-cyan-400" />,
    ts: <FileCode className="w-4 h-4 text-blue-400" />,
    tsx: <FileCode className="w-4 h-4 text-indigo-400" />,
    json: <FileJson className="w-4 h-4 text-orange-400" />,
    html: <FileCode className="w-4 h-4 text-red-400" />,
    css: <FileCode className="w-4 h-4 text-pink-400" />,
    md: <FileText className="w-4 h-4 text-gray-400" />,
    py: <FileCode className="w-4 h-4 text-blue-500" />,
    java: <FileCode className="w-4 h-4 text-brown-400" />,
    rb: <FileCode className="w-4 h-4 text-red-500" />,
    go: <FileCode className="w-4 h-4 text-cyan-500" />,
    rs: <FileCode className="w-4 h-4 text-orange-600" />,
    php: <FileCode className="w-4 h-4 text-purple-400" />,
    vue: <FileCode className="w-4 h-4 text-green-500" />,
    svelte: <FileCode className="w-4 h-4 text-orange-500" />,
    dockerfile: <FileCode className="w-4 h-4 text-blue-400" />,
    gitignore: <FileCode className="w-4 h-4 text-gray-400" />,
    env: <Lock className="w-4 h-4 text-yellow-500" />,
    png: <FileImage className="w-4 h-4 text-purple-400" />,
    jpg: <FileImage className="w-4 h-4 text-purple-400" />,
    jpeg: <FileImage className="w-4 h-4 text-purple-400" />,
    svg: <FileImage className="w-4 h-4 text-yellow-500" />,
    zip: <Archive className="w-4 h-4 text-gray-400" />,
    tar: <Archive className="w-4 h-4 text-gray-400" />,
    gz: <Archive className="w-4 h-4 text-gray-400" />
  }

  return type === 'folder' ? 
    <FolderTree className="w-4 h-4 text-yellow-400" /> : 
    iconMap[ext] || <FileText className="w-4 h-4 text-blue-400" />
}

// Composant d'élément d'arborescence
const FileTreeItem = ({ 
  item, 
  depth = 0, 
  onSelect, 
  onDelete,
  onRename,
  onDuplicate,
  onToggleFavorite,
  selectedFile,
  favorites = [],
  viewMode = 'tree',
  expandedFolders,
  onToggleExpand
}) => {
  const [isExpanded, setIsExpanded] = useState(expandedFolders?.includes(item.path))
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(item.name)
  const [showActions, setShowActions] = useState(false)
  
  const hasChildren = item.children && item.children.length > 0
  const isFavorite = favorites.includes(item.path)

  useEffect(() => {
    setIsExpanded(expandedFolders?.includes(item.path))
  }, [expandedFolders, item.path])

  const handleToggleExpand = (e) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
    onToggleExpand?.(item.path, !isExpanded)
  }

  const handleRename = (e) => {
    e.stopPropagation()
    setIsRenaming(true)
  }

  const handleRenameSubmit = () => {
    if (newName && newName !== item.name) {
      onRename?.(item.path, newName)
    }
    setIsRenaming(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
      setNewName(item.name)
    }
  }

  const renderTreeView = () => (
    <div className="select-none group">
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={`flex items-center gap-1 py-1 px-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
              selectedFile === item.path ? 'bg-purple-500/20 text-purple-400' : ''
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => onSelect?.(item.path)}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => setShowActions(false)}
          >
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {hasChildren ? (
                <button
                  onClick={handleToggleExpand}
                  className="hover:bg-muted rounded p-0.5 transition-transform"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}

              <FileIcon type={item.type} name={item.name} />

              {isRenaming ? (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleKeyDown}
                  className="h-6 text-sm py-0 px-1"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 text-sm truncate" title={item.name}>
                  {item.name}
                </span>
              )}
            </div>

            <div className={`flex items-center gap-1 ${showActions ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              {isFavorite && (
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              )}
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="hover:bg-muted rounded p-1"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleRename}>
                    <Edit className="w-4 h-4 mr-2" />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate?.(item.path)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Dupliquer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onToggleFavorite?.(item.path)}>
                    <Star className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-yellow-400' : ''}`} />
                    {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-500"
                    onClick={() => onDelete?.(item.path)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => onSelect?.(item.path)}>
            <Eye className="w-4 h-4 mr-2" />
            Ouvrir
          </ContextMenuItem>
          <ContextMenuItem onClick={handleRename}>
            <Edit className="w-4 h-4 mr-2" />
            Renommer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate?.(item.path)}>
            <Copy className="w-4 h-4 mr-2" />
            Dupliquer
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onToggleFavorite?.(item.path)}>
            <Star className={`w-4 h-4 mr-2 ${isFavorite ? 'fill-yellow-400' : ''}`} />
            {isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem 
            className="text-red-500"
            onClick={() => onDelete?.(item.path)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && hasChildren && (
        <div className="relative">
          {item.children.map((child, index) => (
            <FileTreeItem
              key={`${child.path}-${index}`}
              item={child}
              depth={depth + 1}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onToggleFavorite={onToggleFavorite}
              selectedFile={selectedFile}
              favorites={favorites}
              viewMode={viewMode}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )

  const renderGridView = () => (
    <div className="p-2">
      <div
        className={`flex flex-col items-center p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
          selectedFile === item.path ? 'bg-purple-500/20' : ''
        }`}
        onClick={() => onSelect?.(item.path)}
      >
        <FileIcon type={item.type} name={item.name} />
        <span className="text-xs text-center truncate w-full mt-1">
          {item.name}
        </span>
        {isFavorite && (
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 absolute top-1 right-1" />
        )}
      </div>
    </div>
  )

  return viewMode === 'tree' ? renderTreeView() : renderGridView()
}

FileTreeItem.propTypes = {
  item: PropTypes.object.isRequired,
  depth: PropTypes.number,
  onSelect: PropTypes.func,
  onDelete: PropTypes.func,
  onRename: PropTypes.func,
  onDuplicate: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  selectedFile: PropTypes.string,
  favorites: PropTypes.array,
  viewMode: PropTypes.oneOf(['tree', 'grid']),
  expandedFolders: PropTypes.array,
  onToggleExpand: PropTypes.func
}

// Composant principal
const SideBar = ({ 
  files = [],
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
  onFileDuplicate,
  onImport,
  onExport,
  onRefresh,
  projectInfo,
  isLoading = false,
  className = '',
  defaultViewMode = 'tree',
  defaultSortBy = 'name',
  defaultSortOrder = 'asc'
}) => {
  // États
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [viewMode, setViewMode] = useState(defaultViewMode)
  const [sortBy, setSortBy] = useState(defaultSortBy)
  const [sortOrder, setSortOrder] = useState(defaultSortOrder)
  const [favorites, setFavorites] = useState([])
  const [recentFiles, setRecentFiles] = useState([])
  const [expandedFolders, setExpandedFolders] = useState([])
  const [showNewFileDialog, setShowNewFileDialog] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileType, setNewFileType] = useState('file')
  const [activeTab, setActiveTab] = useState('files')
  const [filterType, setFilterType] = useState('all')

  // Construire l'arborescence
  const buildTree = useCallback((files) => {
    const tree = []
    const map = {}

    // Trier les fichiers selon les critères
    const sortedFiles = [...files].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'path':
          comparison = a.path.localeCompare(b.path)
          break
        case 'size':
          comparison = (a.size || 0) - (b.size || 0)
          break
        case 'modified':
          comparison = (a.modified || 0) - (b.modified || 0)
          break
        default:
          comparison = 0
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    sortedFiles.forEach(file => {
      const parts = file.path.split('/')
      let current = tree
      let currentPath = ''

      parts.forEach((part, index) => {
        currentPath += (currentPath ? '/' : '') + part
        const isLast = index === parts.length - 1

        let node = current.find(n => n.path === currentPath)
        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: isLast ? file.type || 'file' : 'folder',
            children: [],
            size: file.size,
            modified: file.modified,
            language: file.language
          }
          current.push(node)
          map[currentPath] = node
        }

        if (!isLast) {
          current = node.children
        }
      })
    })

    return tree
  }, [sortBy, sortOrder])

  // Filtrer les fichiers
  const filterFiles = useCallback((files) => {
    return files.filter(file => {
      // Filtre de recherche
      if (searchQuery) {
        const matchesSearch = 
          file.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.path?.toLowerCase().includes(searchQuery.toLowerCase())
        if (!matchesSearch) return false
      }

      // Filtre par type
      if (filterType !== 'all') {
        const ext = file.name?.split('.').pop()?.toLowerCase()
        if (filterType === 'code' && !['js', 'jsx', 'ts', 'tsx', 'py', 'java'].includes(ext)) return false
        if (filterType === 'markup' && !['html', 'css', 'xml'].includes(ext)) return false
        if (filterType === 'data' && !['json', 'yaml', 'yml', 'xml'].includes(ext)) return false
        if (filterType === 'images' && !['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return false
      }

      return true
    })
  }, [searchQuery, filterType])

  // Construire l'arborescence filtrée
  const fileTree = useMemo(() => {
    const filteredFiles = filterFiles(files)
    return buildTree(filteredFiles)
  }, [files, filterFiles, buildTree])

  // Gérer la sélection de fichier
  const handleFileSelect = (path) => {
    setSelectedFile(path)
    onFileSelect?.(path)
    
    // Ajouter aux fichiers récents
    const file = files.find(f => f.path === path)
    if (file) {
      setRecentFiles(prev => {
        const filtered = prev.filter(f => f.path !== path)
        return [file, ...filtered].slice(0, CONFIG.MAX_RECENT_FILES)
      })
    }
  }

  // Gérer l'expansion des dossiers
  const handleToggleExpand = (path, expanded) => {
    setExpandedFolders(prev => {
      if (expanded) {
        return [...prev, path]
      } else {
        return prev.filter(p => p !== path)
      }
    })
  }

  // Gérer la création de fichier
  const handleCreateFile = () => {
    if (newFileName) {
      onFileCreate?.({
        name: newFileName,
        type: newFileType,
        path: newFileName
      })
      setShowNewFileDialog(false)
      setNewFileName('')
    }
  }

  // Obtenir les statistiques
  const getStats = useMemo(() => {
    const stats = {
      total: files.length,
      folders: files.filter(f => f.type === 'folder').length,
      files: files.filter(f => f.type !== 'folder').length,
      favorites: favorites.length,
      size: files.reduce((acc, f) => acc + (f.size || 0), 0),
      byType: {}
    }

    files.forEach(file => {
      const ext = file.name?.split('.').pop()?.toLowerCase()
      if (ext) {
        stats.byType[ext] = (stats.byType[ext] || 0) + 1
      }
    })

    return stats
  }, [files, favorites])

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        setShowNewFileDialog(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <Card className={`h-full flex flex-col bg-card/90 backdrop-blur-sm border-r border-border ${className}`}>
        {/* En-tête */}
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              Explorateur
              {isLoading && (
                <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
              )}
            </h3>
            <div className="flex items-center gap-1">
              <Tooltip content="Rechercher (Ctrl+F)">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowSearch(!showSearch)}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </Tooltip>

              <Tooltip content="Nouveau fichier (Ctrl+N)">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowNewFileDialog(true)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Grid className="w-4 h-4 mr-2" />
                      Mode d'affichage
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={viewMode} onValueChange={setViewMode}>
                        <DropdownMenuRadioItem value="tree">
                          <FolderTree className="w-4 h-4 mr-2" />
                          Arborescence
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="grid">
                          <Grid className="w-4 h-4 mr-2" />
                          Grille
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="list">
                          <List className="w-4 h-4 mr-2" />
                          Liste
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <SortAsc className="w-4 h-4 mr-2" />
                      Trier par
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                        <DropdownMenuRadioItem value="name">Nom</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="path">Chemin</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="size">Taille</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="modified">Modifié</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                        {sortOrder === 'asc' ? (
                          <SortAsc className="w-4 h-4 mr-2" />
                        ) : (
                          <SortDesc className="w-4 h-4 mr-2" />
                        )}
                        Ordre {sortOrder === 'asc' ? 'croissant' : 'décroissant'}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Filter className="w-4 h-4 mr-2" />
                      Filtrer par type
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={filterType} onValueChange={setFilterType}>
                        <DropdownMenuRadioItem value="all">Tous</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="code">Code</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="markup">Markup</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="data">Données</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="images">Images</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem onClick={() => onRefresh?.()}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Rafraîchir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip content="Importer">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onImport}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </Tooltip>

              <Tooltip content="Exporter">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onExport}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </Tooltip>
            </div>
          </div>

          {showSearch && (
            <div className="relative animate-in slide-in-from-top-2 duration-200">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Rechercher des fichiers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-sm"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Onglets */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-3 mt-2">
            <TabsTrigger value="files" className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              Fichiers
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1">
              <Star className="w-4 h-4 mr-2" />
              Favoris
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex-1">
              <History className="w-4 h-4 mr-2" />
              Récents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {fileTree.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun fichier</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => setShowNewFileDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Créer un fichier
                    </Button>
                  </div>
                ) : (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-1' : 'space-y-0.5'}>
                    {fileTree.map((item, index) => (
                      <FileTreeItem
                        key={`${item.path}-${index}`}
                        item={item}
                        onSelect={handleFileSelect}
                        onDelete={onFileDelete}
                        onRename={onFileRename}
                        onDuplicate={onFileDuplicate}
                        onToggleFavorite={(path) => {
                          setFavorites(prev =>
                            prev.includes(path)
                              ? prev.filter(p => p !== path)
                              : [...prev, path]
                          )
                        }}
                        selectedFile={selectedFile}
                        favorites={favorites}
                        viewMode={viewMode}
                        expandedFolders={expandedFolders}
                        onToggleExpand={handleToggleExpand}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="favorites" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {favorites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun favori</p>
                  </div>
                ) : (
                  favorites.map((path, index) => {
                    const file = files.find(f => f.path === path)
                    return file ? (
                      <FileTreeItem
                        key={index}
                        item={file}
                        onSelect={handleFileSelect}
                        onDelete={onFileDelete}
                        onRename={onFileRename}
                        onDuplicate={onFileDuplicate}
                        onToggleFavorite={(path) => {
                          setFavorites(prev => prev.filter(p => p !== path))
                        }}
                        selectedFile={selectedFile}
                        favorites={favorites}
                        viewMode="tree"
                      />
                    ) : null
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recent" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2">
                {recentFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun fichier récent</p>
                  </div>
                ) : (
                  recentFiles.map((file, index) => (
                    <FileTreeItem
                      key={index}
                      item={file}
                      onSelect={handleFileSelect}
                      onDelete={onFileDelete}
                      onRename={onFileRename}
                      onDuplicate={onFileDuplicate}
                      onToggleFavorite={(path) => {
                        setFavorites(prev =>
                          prev.includes(path)
                            ? prev.filter(p => p !== path)
                            : [...prev, path]
                        )
                      }}
                      selectedFile={selectedFile}
                      favorites={favorites}
                      viewMode="tree"
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Informations du projet */}
        {projectInfo && (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium">Informations</span>
            </div>
            
            <div className="space-y-2 text-xs">
              {/* Stats rapides */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-secondary/30 p-2 rounded-lg">
                  <div className="text-muted-foreground">Total</div>
                  <div className="font-medium">{getStats.total}</div>
                </div>
                <div className="bg-secondary/30 p-2 rounded-lg">
                  <div className="text-muted-foreground">Favoris</div>
                  <div className="font-medium">{getStats.favorites}</div>
                </div>
              </div>

              {/* Détails */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium text-foreground">
                    {projectInfo.type || 'React'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium text-foreground">
                    {projectInfo.version || '1.0.0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taille</span>
                  <span className="font-medium text-foreground">
                    {formatBytes(getStats.size)}
                  </span>
                </div>
              </div>

              {/* Branche Git */}
              {projectInfo.branch && (
                <div className="flex items-center gap-1 mt-2 p-2 bg-secondary/30 rounded-lg">
                  <GitBranch className="w-3 h-3" />
                  <span className="text-xs flex-1 truncate">{projectInfo.branch}</span>
                  {projectInfo.changes > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {projectInfo.changes} modif.
                    </Badge>
                  )}
                </div>
              )}

              {/* Types de fichiers */}
              {Object.keys(getStats.byType).length > 0 && (
                <div className="mt-2">
                  <div className="text-muted-foreground text-xs mb-1">Types</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(getStats.byType)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([ext, count]) => (
                        <Badge key={ext} variant="secondary" className="text-xs">
                          .{ext} {count}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Dialogue de création de fichier */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau fichier</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom du fichier</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="ex: App.js"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={newFileType === 'file' ? 'default' : 'outline'}
                  onClick={() => setNewFileType('file')}
                  className="justify-start"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Fichier
                </Button>
                <Button
                  variant={newFileType === 'folder' ? 'default' : 'outline'}
                  onClick={() => setNewFileType('folder')}
                  className="justify-start"
                >
                  <FolderTree className="w-4 h-4 mr-2" />
                  Dossier
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>Extensions autorisées: .js, .jsx, .ts, .tsx, .json, .html, .css</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateFile} disabled={!newFileName}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Fonction utilitaire pour formater les bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

SideBar.propTypes = {
  files: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string,
    path: PropTypes.string,
    type: PropTypes.string,
    size: PropTypes.number,
    modified: PropTypes.number,
    language: PropTypes.string
  })),
  onFileSelect: PropTypes.func,
  onFileCreate: PropTypes.func,
  onFileDelete: PropTypes.func,
  onFileRename: PropTypes.func,
  onFileDuplicate: PropTypes.func,
  onImport: PropTypes.func,
  onExport: PropTypes.func,
  onRefresh: PropTypes.func,
  projectInfo: PropTypes.shape({
    type: PropTypes.string,
    version: PropTypes.string,
    branch: PropTypes.string,
    changes: PropTypes.number
  }),
  isLoading: PropTypes.bool,
  className: PropTypes.string,
  defaultViewMode: PropTypes.oneOf(['tree', 'grid', 'list']),
  defaultSortBy: PropTypes.oneOf(['name', 'path', 'size', 'modified']),
  defaultSortOrder: PropTypes.oneOf(['asc', 'desc'])
}

SideBar.defaultProps = {
  files: [],
  isLoading: false,
  defaultViewMode: 'tree',
  defaultSortBy: 'name',
  defaultSortOrder: 'asc'
}

export default SideBar
FileIcon.propTypes = {
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
};
