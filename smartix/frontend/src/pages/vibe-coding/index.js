/**
 * Point d'entrée des pages du module Vibe-coding
 * 
 * Exporte toutes les pages pour faciliter les imports
 */

// =============================
// PAGES EXISTANTES
// =============================
export { default as VibeDashboard } from './VibeDashboard'
export { default as ProjectsList } from './ProjectsList'
export { default as CreateProject } from './CreateProject'
export { default as ProjectDetail } from './ProjectDetail'
export { default as ProjectEditor } from './ProjectEditor'
export { default as TemplatesList } from './TemplatesList'
export { default as TemplateDetail } from './TemplateDetail'

// =============================
// ✅ NOUVELLES PAGES
// =============================
export { default as CreateProjectTemplate } from './CreateProjectTemplate'
export { default as ProjectEditorAI } from './ProjectEditorAI'

// =============================
// CONSTANTES
// =============================
export const PAGES_VERSION = '2.0.0'

// Liste de toutes les pages disponibles (utile pour la documentation)
export const PAGES_LIST = [
  { name: 'VibeDashboard', path: '/vibe', description: 'Dashboard principal' },
  { name: 'ProjectsList', path: '/vibe/projects', description: 'Liste des projets' },
  { name: 'CreateProject', path: '/vibe/projects/create', description: 'Création de projet (choix du mode)' },
  { name: 'CreateProjectTemplate', path: '/vibe/projects/create/template', description: 'Création par template' },
  { name: 'ProjectEditor', path: '/vibe/projects/:id/edit', description: 'Éditeur classique' },
  { name: 'ProjectEditorAI', path: '/vibe/projects/:id/edit/ai', description: 'Éditeur IA' },
  { name: 'ProjectDetail', path: '/vibe/projects/:id', description: 'Détails d\'un projet' },
  { name: 'TemplatesList', path: '/vibe/templates', description: 'Liste des templates' },
  { name: 'TemplateDetail', path: '/vibe/templates/:id', description: 'Détails d\'un template' }
]

// Fonction utilitaire pour obtenir une page par son nom
export const getPageByName = (name) => {
  const page = PAGES_LIST.find(p => p.name === name)
  return page || null
}

// Fonction utilitaire pour vérifier si une route existe
export const isVibeRoute = (path) => {
  return PAGES_LIST.some(page => {
    // Convertir les routes paramétrées en regex simple
    const routePattern = page.path.replace(/:\w+/g, '[^/]+')
    const regex = new RegExp(`^${routePattern}$`)
    return regex.test(path)
  })
}

