/**
 * importService - Service d'import de projets
 * 
 * Gère l'import de projets depuis:
 * - GitHub
 * - ZIP
 * - Dossier local
 * 
 * @version 3.0.0
 */

import axios, { AxiosInstance, CancelTokenSource } from 'axios'

// Types et interfaces










// Configuration typée

export const CONFIG = {
  MAX_ZIP_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_PROJECT_SIZE: 200 * 1024 * 1024, // 200MB
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_FILES: 1000,
  ALLOWED_EXTENSIONS: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.rb', '.go', '.rs', '.php', '.html', '.css', '.json', '.yml', '.yaml', '.md', '.txt'],
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large files
  MAX_CONCURRENT_UPLOADS: 3,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
}

// Erreur personnalisée typée
export class ImportError extends Error {
  name = 'ImportError'
  timestamp
  
  constructor(
    message,
    code,
    details = {},
    originalError = null
  ) {
    super(message)
    this.timestamp = new Date().toISOString()
    
    // Capture stack trace properly
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ImportError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
}

// Service principal typé
export class ImportService {
  uploadProgress = 0
  abortController = null
  cancelTokenSource = null
  cache = new Map()
  pendingRequests = new Map()
  importHistory = []
  activeUploads = new Set()

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '3.0.0'
      }
    })

    // Intercepteur pour ajouter le token d'authentification
    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Intercepteur pour la gestion des erreurs réseau
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => this.handleAxiosError(error)
    )
  }

  /**
   * Valide les paramètres d'import
   */
  validateImportParams(params) {
    const errors = []
    const warnings = []

    // Validation utilisateur
    if (!params.userId) {
      errors.push('Utilisateur non authentifié')
    } else if (typeof params.userId !== 'string' || params.userId.trim().length === 0) {
      errors.push('ID utilisateur invalide')
    }

    // Validation nom du projet
    if (!params.name) {
      errors.push('Nom du projet requis')
    } else {
      const nameValidation = this.validateProjectName(params.name)
      errors.push(...nameValidation.errors)
      warnings.push(...nameValidation.warnings)
    }

    // Validation selon le type d'import
    if (params.type) {
      const typeValidation = this.validateImportType(params.type, params)
      errors.push(...typeValidation.errors)
      warnings.push(...typeValidation.warnings)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  validateProjectName(name) {
    const errors = []
    const warnings = []

    if (name.length < 3) {
      errors.push('Le nom doit contenir au moins 3 caractères')
    }
    if (name.length > 100) {
      errors.push('Le nom ne peut pas dépasser 100 caractères')
    }
    if (!/^[a-zA-Z0-9-_ ]+$/.test(name)) {
      errors.push('Le nom contient des caractères invalides')
    }
    if (name.toLowerCase() !== name && /[A-Z]/.test(name)) {
      warnings.push('Il est recommandé d\'utiliser des minuscules pour le nom du projet')
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  validateImportType(
    type,
    params
  ) {
    const errors = []
    const warnings = []

    switch (type) {
      case 'github':
        if (!params.url) {
          errors.push('URL GitHub requise')
        } else if (!this.isValidGitHubUrl(params.url)) {
          errors.push('URL GitHub invalide')
        }
        break

      case 'zip':
        if (!params.file) {
          errors.push('Fichier ZIP requis')
        } else {
          const zipValidation = this.validateZipFile(params.file)
          errors.push(...zipValidation.errors)
          warnings.push(...zipValidation.warnings)
        }
        break

      case 'local':
        if (!params.files || params.files.length === 0) {
          errors.push('Au moins un fichier requis')
        } else {
          const localValidation = this.validateLocalFiles(params.files)
          errors.push(...localValidation.errors)
          warnings.push(...localValidation.warnings)
        }
        break

      default:
        errors.push(`Type d'import inconnu: ${type}`)
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  validateZipFile(file) {
    const errors = []
    const warnings = []

    if (!this.isValidZipFile(file)) {
      errors.push('Format de fichier invalide (doit être un fichier ZIP)')
    } else if (file.size > CONFIG.MAX_ZIP_SIZE) {
      errors.push(`Fichier trop volumineux (max ${CONFIG.MAX_ZIP_SIZE / 1024 / 1024}MB)`)
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  validateLocalFiles(files) {
    const errors = []
    const warnings = []

    if (files.length > CONFIG.MAX_FILES) {
      errors.push(`Trop de fichiers (max ${CONFIG.MAX_FILES})`)
    }

    const totalSize = this.estimateProjectSize(files)
    if (totalSize > CONFIG.MAX_PROJECT_SIZE) {
      errors.push(`Projet trop volumineux (max ${CONFIG.MAX_PROJECT_SIZE / 1024 / 1024}MB)`)
    }

    // Vérification des extensions avec analyse plus poussée
    const invalidFiles = []
    const binaryFiles = []
    
    Array.from(files).forEach(file => {
      const ext = this.getFileExtension(file.name)
      if (!CONFIG.ALLOWED_EXTENSIONS.includes(ext) && !file.name.startsWith('.')) {
        invalidFiles.push(file.name)
      }
      // Détection des fichiers binaires potentiels
      if (this.isLikelyBinaryFile(file)) {
        binaryFiles.push(file.name)
      }
    })

    if (invalidFiles.length > 0) {
      warnings.push(`${invalidFiles.length} fichier(s) avec extension non reconnue`)
    }
    if (binaryFiles.length > 0) {
      warnings.push(`${binaryFiles.length} fichier(s) binaire(s) détecté(s)`)
    }

    return { isValid: errors.length === 0, errors, warnings }
  }

  getFileExtension(filename) {
    const ext = '.' + filename.split('.').pop()?.toLowerCase()
    return ext === '.' ? '' : ext
  }

  isLikelyBinaryFile(file) {
    // Vérification basique basée sur le type MIME
    const binaryTypes = [
      'image/', 'video/', 'audio/', 'application/pdf',
      'application/zip', 'application/x-rar-compressed'
    ]
    return binaryTypes.some(type => file.type.startsWith(type))
  }

  /**
   * Importe un projet depuis GitHub avec options avancées
   */
  async importFromGitHub(
    repoUrl,
    userId,
    name = null,
    options = {}
  ) {
    const cacheKey = `github:${repoUrl}:${userId}:${options.branch || 'main'}`

    // Vérifier le cache
    if (!options.forceRefresh) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        console.log('Retour depuis le cache')
        return cached
      }
    }

    // Éviter les requêtes en double
    if (this.pendingRequests.has(cacheKey)) {
      console.log('Requête déjà en cours, attente...')
      return this.pendingRequests.get(cacheKey)
    }

    const startTime = Date.now()

    const request = (async () => {
      try {
        const response = await this.axiosInstance.post(
          '/vibe/projects/import/github',
          {
            repoUrl,
            userId,
            name,
            branch: options.branch,
            includeGitHistory: options.includeGitHistory,
            maxDepth: options.maxDepth,
            excludePatterns: options.excludePatterns
          },
          {
            timeout: 60000, // 60 secondes pour GitHub
            headers: {
              'X-Request-ID': this.generateRequestId(),
              'X-Client-Time': Date.now().toString()
            }
          }
        )

        const result = response.data

        // Mettre en cache avec ETag si disponible
        const etag = response.headers.etag
        this.setInCache(cacheKey, result, etag)

        // Ajouter à l'historique
        this.addToHistory('github', repoUrl, result, Date.now() - startTime)

        return result
      } catch (error) {
        if (error instanceof ImportError) {
          throw error
        }
        throw this.handleError(error, { type: 'github', repoUrl, userId })
      } finally {
        this.pendingRequests.delete(cacheKey)
      }
    })()

    this.pendingRequests.set(cacheKey, request)
    return request
  }

  /**
   * Importe un projet depuis un fichier ZIP avec upload par chunks
   */
  async importFromZip(
    file,
    userId,
    name,
    onProgress
  ) {
    // Validation préalable
    const validation = this.validateZipFile(file)
    if (!validation.isValid) {
      throw new ImportError(
        validation.errors.join(', '),
        'VALIDATION_ERROR',
        { errors: validation.errors }
      )
    }

    this.cancelTokenSource = axios.CancelToken.source()
    this.abortController = new AbortController()

    // Pour les gros fichiers, utiliser l'upload par chunks
    if (file.size > CONFIG.CHUNK_SIZE * 10) {
      return this.uploadLargeZip(file, userId, name, onProgress)
    }

    // Upload standard pour les petits fichiers
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', userId)
    formData.append('name', name)

    const startTime = Date.now()

    try {
      const response = await this.axiosInstance.post(
        '/vibe/projects/import/zip',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          cancelToken: this.cancelTokenSource.token,
          signal: this.abortController.signal,
          timeout: 120000, // 120 secondes
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              this.uploadProgress = percentCompleted
              onProgress?.(percentCompleted)
            }
          }
        }
      )

      const result = response.data
      this.addToHistory('zip', file.name, result, Date.now() - startTime)
      
      return result
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new ImportError('Upload annulé', 'CANCELLED', { fileName: file.name })
      }
      if ((error).name === 'AbortError') {
        throw new ImportError('Upload annulé', 'ABORTED', { fileName: file.name })
      }
      throw this.handleError(error, { type: 'zip', fileName: file.name, userId })
    } finally {
      this.cancelTokenSource = null
      this.abortController = null
      this.uploadProgress = 0
    }
  }

  async uploadLargeZip(
    file,
    userId,
    name,
    onProgress
  ) {
    const chunkSize = CONFIG.CHUNK_SIZE
    const chunks = Math.ceil(file.size / chunkSize)
    const uploadId = this.generateRequestId()

    try {
      // Initialiser l'upload
      const initResponse = await this.axiosInstance.post('/vibe/projects/upload/init', {
        fileName: file.name,
        fileSize: file.size,
        chunks,
        userId,
        projectName: name
      })

      const { uploadUrl, uploadId: serverUploadId } = initResponse.data

      // Uploader chaque chunk
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        const formData = new FormData()
        formData.append('chunk', chunk)
        formData.append('uploadId', serverUploadId)
        formData.append('chunkIndex', i.toString())
        formData.append('totalChunks', chunks.toString())

        await this.axiosInstance.post(uploadUrl, formData, {
          headers,
          timeout: 30000
        })

        const progress = Math.round(((i + 1) * 100) / chunks)
        this.uploadProgress = progress
        onProgress?.(progress)
      }

      // Finaliser l'upload
      const completeResponse = await this.axiosInstance.post('/vibe/projects/upload/complete', {
        uploadId: serverUploadId,
        userId,
        projectName: name
      })

      return completeResponse.data
    } catch (error) {
      // Nettoyer l'upload côté serveur en cas d'erreur
      await this.axiosInstance.post('/vibe/projects/upload/abort', { uploadId }).catch(() => {})
      throw error
    }
  }

  /**
   * Importe un projet depuis un dossier local avec analyse préalable
   */
  async importFromLocal(
    files,
    userId,
    name,
    onProgress
  ) {
    // Analyser avant l'import
    const analysis = await this.analyzeProject(files)

    // Validation basée sur l'analyse
    const validation = this.validateLocalFiles(files)
    if (!validation.isValid) {
      throw new ImportError(
        validation.errors.join(', '),
        'VALIDATION_ERROR',
        { errors: validation.errors, analysis }
      )
    }

    this.cancelTokenSource = axios.CancelToken.source()
    this.abortController = new AbortController()

    const formData = new FormData()
    const fileMap = new Map()

    // Organiser les fichiers par chemin
    Array.from(files).forEach((file, index) => {
      const relativePath = file.webkitRelativePath || file.name
      fileMap.set(relativePath, file)
      
      // Ajouter au FormData
      formData.append(`files`, file)
      formData.append(`paths`, relativePath)
    })

    formData.append('userId', userId)
    formData.append('name', name)
    formData.append('analysis', JSON.stringify(analysis))

    const startTime = Date.now()

    try {
      const response = await this.axiosInstance.post(
        '/vibe/projects/import/local',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          cancelToken: this.cancelTokenSource.token,
          signal: this.abortController.signal,
          timeout: 300000, // 5 minutes
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              this.uploadProgress = percentCompleted
              onProgress?.(percentCompleted)
            }
          }
        }
      )

      const result = {
        ...response.data,
        analysis
      }

      this.addToHistory('local', name, result, Date.now() - startTime)

      return result
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new ImportError('Upload annulé', 'CANCELLED', { projectName: name })
      }
      if ((error).name === 'AbortError') {
        throw new ImportError('Upload annulé', 'ABORTED', { projectName: name })
      }
      throw this.handleError(error, { type: 'local', projectName: name, userId })
    } finally {
      this.cancelTokenSource = null
      this.abortController = null
      this.uploadProgress = 0
    }
  }

 /**
   * Importe un projet avec détection automatique avancée
   */
  async importProject(params) {
    const validation = this.validateImportParams(params)

    if (!validation.isValid) {
      throw new ImportError(
        validation.errors.join(', '),
        'VALIDATION_ERROR',
        { errors: validation.errors, warnings: validation.warnings }
      )
    }

    if (validation.warnings.length > 0) {
      console.warn('Avertissements d\'import:', validation.warnings)
      this.reportWarnings(validation.warnings)
    }

    const { type, userId, name, onProgress, options = {} } = params

    try {
      let result: ImportResult

      switch (type) {
        case 'github':
          if (!params.url) {
            throw new ImportError('URL GitHub requise', 'MISSING_PARAM')
          }
          result = await this.importFromGitHub(params.url, userId, name, options)
          break

        case 'zip':
          if (!params.file) {
            throw new ImportError('Fichier ZIP requis', 'MISSING_PARAM')
          }
          result = await this.importFromZip(params.file, userId, name, onProgress)
          break

        case 'local':
          if (!params.files) {
            throw new ImportError('Fichiers locaux requis', 'MISSING_PARAM')
          }
          result = await this.importFromLocal(params.files, userId, name, onProgress)
          break

        default:
          throw new ImportError(`Type d'import inconnu: ${type}`, 'INVALID_TYPE')
      }

      return result
    } catch (error) {
      if (error instanceof ImportError) {
        throw error
      }
      throw new ImportError(
        (error).message || 'Erreur lors de l\'import',
        'UNKNOWN_ERROR',
        { originalError: error }
      )
    }
  }

  /**
   * Analyse approfondie d'un projet
   */
  async analyzeProject(files) {
    const fileList = Array.from(files)
    const fileDetails = []

    // Analyse synchrone des fichiers
    for (const file of fileList) {
      const ext = this.getFileExtension(file.name)
      fileDetails.push({
        name: file.name,
        path: file.webkitRelativePath || file.name,
        size: file.size,
        extension: ext,
        type: file.type || 'application/octet-stream'
      })
    }

    // Détection du type de projet
    const projectType = await this.detectProjectType(fileDetails)

    // Analyse des dépendances
    const dependencies = await this.detectDependencies(fileDetails, projectType)

    // Détection des frameworks
    const frameworks = await this.detectFrameworks(fileDetails, projectType)

    // Analyse de la structure
    const structure = await this.analyzeStructure(fileDetails)

    // Statistiques détaillées
    const stats = this.calculateStats(fileDetails)

    // Détection des langages
    const languages = await this.detectLanguages(fileDetails)

    return {
      type: projectType,
      frameworks,
      dependencies,
      structure,
      stats: {
        ...stats,
        languages
      }
    }
  }

  async detectProjectType(files: FileInfo[]) {
    const fileNames = files.map(f => f.name)
    const fileExtensions = files.map(f => f.extension)

    // Détection basée sur les fichiers de configuration
    if (fileNames.includes('package.json')) return 'node'
    if (fileNames.includes('requirements.txt')) return 'python'
    if (fileNames.includes('pom.xml')) return 'java'
    if (fileNames.includes('Gemfile')) return 'ruby'
    if (fileNames.includes('Cargo.toml')) return 'rust'
    if (fileNames.includes('go.mod')) return 'go'
    if (fileNames.includes('composer.json')) return 'php'

    // Détection basée sur les extensions majoritaires
    const extensionCounts = {}
    fileExtensions.forEach(ext => {
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1
    })

    const sortedExtensions = Object.entries(extensionCounts)
      .sort(([, a], [, b]) => b - a)

    if (sortedExtensions.length > 0) {
      const [mainExt] = sortedExtensions[0]
      
      // Mapping extension -> type
      const extensionToType = {
        '.js': 'node',
        '.ts': 'node',
        '.py': 'python',
        '.java': 'java',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.php': 'php',
        '.html': 'static',
        '.css': 'static'
      }

      if (extensionToType[mainExt]) {
        return extensionToType[mainExt]
      }
    }

    return 'unknown'
  }

  async detectDependencies(
    files: FileInfo[],
    projectType
  ) {
    const dependencies = []

    for (const file of files) {
      try {
        if (projectType === 'node' && file.name === 'package.json') {
          // Pour les vrais fichiers, on lirait le contenu
          dependencies.push('express', 'react', 'lodash') // Exemple
        } else if (projectType === 'python' && file.name === 'requirements.txt') {
          dependencies.push('django', 'flask', 'requests') // Exemple
        }
      } catch (error) {
        console.warn(`Erreur lors de l'analyse des dépendances de ${file.name}:`, error)
      }
    }

    return [...new Set(dependencies)] // Déduplication
  }

  async detectFrameworks(
    files: FileInfo[],
    projectType
  ) {
    const frameworks = []
    const fileNames = files.map(f => f.name)

    switch (projectType) {
      case 'node':
        if (fileNames.includes('angular.json')) frameworks.push('angular')
        if (fileNames.includes('vue.config.js')) frameworks.push('vue')
        if (fileNames.includes('next.config.js')) frameworks.push('nextjs')
        if (fileNames.includes('gatsby-config.js')) frameworks.push('gatsby')
        if (fileNames.some(f => f.includes('react'))) frameworks.push('react')
        if (fileNames.includes('nest-cli.json')) frameworks.push('nestjs')
        break

      case 'python':
        if (fileNames.includes('manage.py')) frameworks.push('django')
        if (fileNames.includes('app.py') && fileNames.includes('requirements.txt')) {
          frameworks.push('flask')
        }
        if (fileNames.includes('main.py') && fileNames.includes('fastapi')) {
          frameworks.push('fastapi')
        }
        break

      case 'java':
        if (fileNames.includes('pom.xml')) frameworks.push('maven')
        if (fileNames.includes('build.gradle')) frameworks.push('gradle')
        if (fileNames.includes('application.properties')) frameworks.push('spring-boot')
        break

      case 'php':
        if (fileNames.includes('artisan')) frameworks.push('laravel')
        if (fileNames.includes('symfony.lock')) frameworks.push('symfony')
        break

      case 'ruby':
        if (fileNames.includes('config/application.rb')) frameworks.push('rails')
        if (fileNames.includes('Gemfile') && fileNames.includes('sinatra')) {
          frameworks.push('sinatra')
        }
        break
    }

    return frameworks
  }

  async analyzeStructure(files: FileInfo[]) {
    const fileNames = files.map(f => f.name)
    const filePaths = files.map(f => f.path)

    return {
      hasReadme: fileNames.some(f => f.toLowerCase() === 'readme.md'),
      hasGitignore: fileNames.includes('.gitignore'),
      hasDockerfile: fileNames.includes('Dockerfile'),
      hasTests: fileNames.some(f => f.includes('test') || f.includes('spec')),
      hasCiCd: fileNames.some(f => 
        f.includes('.github/workflows') || 
        f.includes('.gitlab-ci.yml') ||
        f.includes('.travis.yml')
      ),
      entryPoints: this.findEntryPoints(filePaths)
    }
  }

  findEntryPoints(paths) {
    const entryPoints = []
    const possibleEntries = [
      'index.js', 'index.ts', 'main.js', 'main.ts',
      'app.js', 'app.ts', 'server.js', 'server.ts',
      'index.html', 'index.php', 'main.py', 'app.py'
    ]

    for (const entry of possibleEntries) {
      const matchingPaths = paths.filter(p => p.endsWith(entry))
      if (matchingPaths.length > 0) {
        entryPoints.push(matchingPaths[0])
      }
    }

    return entryPoints
  }

  calculateStats(files: FileInfo[]) {
    const extensions = {}
    let totalSize = 0

    files.forEach(file => {
      extensions[file.extension] = (extensions[file.extension] || 0) + 1
      totalSize += file.size
    })

    const largestFiles = [...files]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)

    return {
      totalFiles: files.length,
      totalSize,
      extensions,
      largestFiles
    }
  }

  async detectLanguages(
    files: FileInfo[]
  ): Promise<object> {
    const languages = {}

    // Mapping extension -> langage
    const extensionToLanguage = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.json': 'JSON',
      '.yml': 'YAML',
      '.yaml': 'YAML',
      '.md': 'Markdown',
      '.txt': 'Text'
    }

    files.forEach(file => {
      if (extensionToLanguage[file.extension]) {
        const lang = extensionToLanguage[file.extension]
        languages[lang] = (languages[lang] || 0) + 1
      }
    })

    return languages
  }

  /**
   * Gestion du cache améliorée
   */
  getFromCache(key) {
    const cached = this.cache.get(key)
    if (!cached) return null

    const cacheAge = Date.now() - cached.timestamp
    if (cacheAge > CONFIG.CACHE_DURATION) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  setInCache(key, data, etag) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag
    })

    // Nettoyage périodique du cache
    this.cleanCache()
  }

  cleanCache() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > CONFIG.CACHE_DURATION) {
        this.cache.delete(key)
      }
    }
  }
/**
   * Annule l'import en cours
   */
  cancelImport() {
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel('Import annulé par l\'utilisateur')
      this.cancelTokenSource = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.uploadProgress = 0
  }

  /**
   * Utilitaires de validation
   */
  isValidGitHubUrl(url) {
    const regex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(\/)?$/
    return regex.test(url)
  }

  isValidGitHubEnterpriseUrl(url) {
    const regex = /^https?:\/\/([a-zA-Z0-9.-]+\.)?github\.[a-zA-Z]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(\/)?$/
    return regex.test(url)
  }

  isValidZipFile(file) {
    return file.type === 'application/zip' || 
           file.type === 'application/x-zip-compressed' ||
           file.name.toLowerCase().endsWith('.zip')
  }

  estimateProjectSize(files) {
    return Array.from(files).reduce((total, file) => total + file.size, 0)
  }

  /**
   * Gestion améliorée des erreurs
   */
  handleAxiosError(error): never {
    if (error.response) {
      // Erreur API
      const { status, data } = error.response
      const message = data.error || data.message || error.message

      switch (status) {
        case 400:
          throw new ImportError(message, 'BAD_REQUEST', { data })
        case 401:
          throw new ImportError('Session expirée', 'AUTH_ERROR')
        case 403:
          throw new ImportError('Accès non autorisé', 'FORBIDDEN')
        case 404:
          throw new ImportError('Ressource non trouvée', 'NOT_FOUND')
        case 409:
          throw new ImportError('Conflit avec une ressource existante', 'CONFLICT')
        case 413:
          throw new ImportError('Fichier trop volumineux', 'SIZE_ERROR')
        case 422:
          throw new ImportError('Données invalides', 'VALIDATION_ERROR', data)
        case 429:
          throw new ImportError('Trop de requêtes', 'RATE_LIMIT')
        case 500:
        case 502:
        case 503:
          throw new ImportError('Erreur serveur', 'SERVER_ERROR', { status })
        default:
          throw new ImportError(message, 'API_ERROR', { status, data })
      }
    } else if (error.request) {
      // Pas de réponse
      throw new ImportError(
        'Impossible de contacter le serveur',
        'NETWORK_ERROR',
        { request: error.request }
      )
    } else {
      // Erreur de configuration
      throw new ImportError(
        error.message || 'Erreur inconnue',
        'UNKNOWN_ERROR',
        { originalError: error }
      )
    }
  }

  handleError(error, context) {
    if (error instanceof ImportError) {
      return error
    }

    // Gestion spécifique selon le type d'erreur
    if (error.name === 'TimeoutError' || (error).code === 'ECONNABORTED') {
      return new ImportError(
        'Délai d\'attente dépassé',
        'TIMEOUT',
        context,
        error
      )
    }

    if (error.name === 'NetworkError' || (error).code === 'ERR_NETWORK') {
      return new ImportError(
        'Erreur réseau',
        'NETWORK_ERROR',
        context,
        error
      )
    }

    return new ImportError(
      error.message,
      'UNKNOWN_ERROR',
      context,
      error
    )
  }

  reportWarnings(warnings) {
    // Implémenter la logique de reporting (analytics, logging, etc.)
    console.warn('Import warnings:', warnings)
  }

  /**
   * Utilitaires
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  addToHistory(
    type,
    source,
    result,
    duration
  ) {
    this.importHistory.push({
      type,
      source,
      result,
      timestamp: new Date().toISOString(),
      projectId: result.projectId,
      duration
    })

    // Garder seulement les 50 derniers imports
    if (this.importHistory.length > 50) {
      this.importHistory.shift()
    }
  }

  /**
   * API publique
   */
  getImportHistory(limit = 10): ImportHistoryEntry[] {
    return this.importHistory.slice(-limit)
  }

  clearCache() {
    this.cache.clear()
    console.log('Cache vidé')
  }

  getProgress() {
    return this.uploadProgress
  }

  isImporting() {
    return this.abortController !== null || this.cancelTokenSource !== null
  }

  getActiveUploads() {
    return Array.from(this.activeUploads)
  }

  cleanup() {
    this.cancelImport()
    this.clearCache()
    this.pendingRequests.clear()
    this.importHistory = []
    this.activeUploads.clear()
    this.uploadProgress = 0
  }
}

// Export d'une instance unique
export const importService = new ImportService()

// Export des types et classes
export default importService
