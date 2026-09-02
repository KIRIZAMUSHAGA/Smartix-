/**
 * fileUploader - Utilitaire d'upload de fichiers
 * 
 * Rôle: Uploader des fichiers vers le CDN ou le stockage
 * - Upload APK/AAB
 * - Upload screenshots
 * - Gestion des chunks pour gros fichiers
 * - Upload parallélisé
 * - Retry automatique
 * - Checksum d'intégrité
 * - Statistiques de transfert
 * - Pause/Reprise réelle
 */

import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { logger } from './logger'
import { crypto } from '../../utils/crypto'
import axios from 'axios'
import FormData from 'form-data'

// =============================
// CONFIGURATION
// =============================

const UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

const CHUNK_SIZE = 5 * 1024 * 1024 // 5 MB
const MAX_RETRIES = 3
const RETRY_DELAY = 1000 // 1 seconde
const UPLOAD_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const MAX_CONCURRENT_UPLOADS = 3
const CHUNK_PARALLEL = 3 // Upload parallèle de chunks
const MAX_LOGS = 200
const SPEED_UPDATE_INTERVAL = 1000 // 1 seconde

// =============================
// CLASSE PRINCIPALE
// =============================

export class FileUploader extends EventEmitter {
  constructor(options = {}) {
    super()
    this.uploads = new Map() // uploadId -> uploadInfo
    this.uploadQueue = []
    this.activeUploads = 0
    this.stats = {
      totalUploads: 0,
      totalBytes: 0,
      completedUploads: 0,
      failedUploads: 0,
      cancelledUploads: 0,
      totalUploadTime: 0,
      largestUpload: 0,
      fastestUpload: Infinity,
      slowestUpload: 0,
      totalSpeedSum: 0,
      speedSamples: 0
    }
    this.config = {
      endpoint: options.endpoint || process.env.UPLOAD_ENDPOINT || 'https://api.vibecoding.dev/upload',
      token: options.token || process.env.UPLOAD_TOKEN,
      maxConcurrent: options.maxConcurrent || MAX_CONCURRENT_UPLOADS,
      chunkSize: options.chunkSize || CHUNK_SIZE,
      chunkParallel: options.chunkParallel || CHUNK_PARALLEL,
      ...options
    }
    this.logger = logger.createChild('FileUploader')
  }

  /**
   * Lit un fichier et retourne son contenu et ses métadonnées
   */
  async _readFile(filePath) {
    const stats = await fs.promises.stat(filePath)
    const fileName = path.basename(filePath)
    const fileStream = fs.createReadStream(filePath)
    
    // Calculer le checksum en parallèle
    const checksumPromise = this._calculateChecksum(fileStream)

    return {
      stream: fs.createReadStream(filePath), // Nouveau stream pour l'upload
      size: stats.size,
      fileName,
      checksum: await checksumPromise
    }
  }

  /**
   * Calcule le checksum d'un fichier
   */
  async _calculateChecksum(stream) {
    return new Promise((resolve, reject) => {
      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const hash = crypto.createHash(buffer.toString())
        resolve(hash)
      })
      stream.on('error', reject)
    })
  }

  /**
   * Upload un fichier
   */
  async upload(filePath, options = {}) {
    const {
      bucket = 'default',
      contentType,
      metadata = {},
      chunked = true,
      public: isPublic = false,
      expiresIn = null,
      category = 'builds' // builds, screenshots, apks, logs
    } = options

    const uploadId = `upload_${Date.now()}_${crypto.randomToken(8)}`
    const startTime = Date.now()

    // Lire le fichier
    let fileData
    let fileSize = 0
    let fileName = ''
    let fileStream = null
    let checksum = null

    if (typeof filePath === 'string') {
      const fileInfo = await this._readFile(filePath)
      fileSize = fileInfo.size
      fileName = fileInfo.fileName
      fileStream = fileInfo.stream
      checksum = fileInfo.checksum
    } else if (filePath instanceof Blob || filePath instanceof File) {
      fileData = filePath
      fileSize = filePath.size
      fileName = filePath.name || 'file.bin'
    } else if (Buffer.isBuffer(filePath)) {
      fileData = filePath
      fileSize = filePath.length
      fileName = 'file.bin'
    } else {
      throw new Error('Type de fichier non supporté')
    }

    const uploadInfo = {
      id: uploadId,
      filePath,
      fileName,
      fileSize,
      bucket,
      contentType,
      category,
      metadata,
      status: UPLOAD_STATUS.PENDING,
      progress: 0,
      uploadedBytes: 0,
      startTime,
      endTime: null,
      duration: null,
      speed: 0,
      avgSpeed: 0,
      lastUpdate: startTime,
      chunks: [],
      retryCount: 0,
      cancelled: false,
      paused: false,
      result: null,
      errors: [],
      logs: [],
      checksum,
      fileStream
    }

    this.uploads.set(uploadId, uploadInfo)
    this.stats.totalUploads++
    this.stats.totalBytes += fileSize
    this.stats.largestUpload = Math.max(this.stats.largestUpload, fileSize)

    // Ajouter à la queue
    this.uploadQueue.push(uploadId)
    this._addLog(uploadInfo, `📦 Fichier ajouté à la queue: ${fileName} (${this._formatSize(fileSize)})`)
    this._processQueue()

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const upload = this.uploads.get(uploadId)
        if (!upload) {
          clearInterval(checkInterval)
          reject(new Error('Upload introuvable'))
          return
        }

        if (upload.status === UPLOAD_STATUS.COMPLETED) {
          clearInterval(checkInterval)
          this.stats.completedUploads++
          this.stats.totalUploadTime += upload.duration
          this.stats.fastestUpload = Math.min(this.stats.fastestUpload, upload.duration)
          this.stats.slowestUpload = Math.max(this.stats.slowestUpload, upload.duration)

          resolve({
            success: true,
            uploadId,
            fileId: upload.result?.fileId,
            url: upload.result?.url,
            size: upload.fileSize,
            duration: upload.duration,
            speed: upload.avgSpeed,
            checksum: upload.checksum
          })
        }

        if (upload.status === UPLOAD_STATUS.FAILED) {
          clearInterval(checkInterval)
          this.stats.failedUploads++
          reject(new Error(upload.errors.join('\n')))
        }

        if (upload.status === UPLOAD_STATUS.CANCELLED) {
          clearInterval(checkInterval)
          this.stats.cancelledUploads++
          reject(new Error('Upload annulé'))
        }
      }, 500)

      // Timeout global
      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Upload timeout'))
      }, UPLOAD_TIMEOUT)
    })
  }

  /**
   * Met à jour la vitesse d'upload
   */
  _updateSpeed(uploadInfo) {
    const now = Date.now()
    const elapsed = now - uploadInfo.lastUpdate

    if (elapsed >= SPEED_UPDATE_INTERVAL) {
      const speed = uploadInfo.uploadedBytes / ((now - uploadInfo.startTime) / 1000)
      uploadInfo.speed = speed
      uploadInfo.avgSpeed = (uploadInfo.avgSpeed * uploadInfo.lastUpdate + speed) / (now - uploadInfo.startTime)
      uploadInfo.lastUpdate = now

      this.stats.totalSpeedSum += speed
      this.stats.speedSamples++

      this.emit('upload:speed', {
        uploadId: uploadInfo.id,
        speed,
        avgSpeed: uploadInfo.avgSpeed
      })
    }
  }

  /**
   * Vérifie si l'upload est en pause
   */
  async _checkPaused(uploadInfo) {
    while (uploadInfo.status === UPLOAD_STATUS.PAUSED) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    if (uploadInfo.cancelled) throw new Error('Upload annulé')
  }

  /**
   * Upload un fichier volumineux en chunks parallèles
   */
  async _uploadChunked(uploadInfo, fileStream) {
    const chunks = Math.ceil(uploadInfo.fileSize / this.config.chunkSize)
    uploadInfo.totalChunks = chunks

    this._addLog(uploadInfo, `📦 Découpage en ${chunks} chunks (parallélisme: ${this.config.chunkParallel})`)

    // Initialiser l'upload sur le serveur
    const initResponse = await this._initiateUpload(uploadInfo)
    uploadInfo.uploadId = initResponse.uploadId

    // Préparer les chunks
    const chunkPromises = []
    const chunkList = []

    for (let i = 0; i < chunks; i++) {
      const start = i * this.config.chunkSize
      const end = Math.min(start + this.config.chunkSize, uploadInfo.fileSize)

      const chunkInfo = {
        index: i,
        start,
        end,
        size: end - start,
        attempts: 0,
        status: 'pending'
      }

      uploadInfo.chunks.push(chunkInfo)
      chunkList.push(chunkInfo)

      // Lire le chunk depuis le stream
      const chunkData = await this._readChunk(fileStream, start, end)
      
      // Créer la promesse d'upload
      chunkPromises.push(this._uploadChunkWithRetry(uploadInfo, chunkInfo, chunkData))
    }

    // Upload par lots parallèles
    for (let i = 0; i < chunks; i += this.config.chunkParallel) {
      await this._checkPaused(uploadInfo)
      if (uploadInfo.cancelled) throw new Error('Upload annulé')

      const batch = chunkPromises.slice(i, i + this.config.chunkParallel)
      await Promise.all(batch)

      uploadInfo.progress = Math.min(
        100,
        Math.round(((i + this.config.chunkParallel) / chunks) * 100)
      )

      this.emit('upload:progress', {
        uploadId: uploadInfo.id,
        progress: uploadInfo.progress,
        uploadedBytes: uploadInfo.uploadedBytes,
        totalBytes: uploadInfo.fileSize,
        currentChunk: Math.min(i + this.config.chunkParallel, chunks),
        totalChunks: chunks
      })
    }

    // Vérifier que tous les chunks sont uploadés
    const missingChunks = uploadInfo.chunks.filter(c => c.status !== 'completed')
    if (missingChunks.length > 0) {
      throw new Error(`${missingChunks.length} chunks manquants`)
    }

    // Finaliser l'upload
    const result = await this._finalizeUpload(uploadInfo)
    uploadInfo.result = result

    this._addLog(uploadInfo, `✅ Upload terminé: ${uploadInfo.fileName} (${this._formatSize(uploadInfo.fileSize)})`)

    return result
  }

  /**
   * Lit un chunk depuis un stream
   */
  async _readChunk(stream, start, end) {
    return new Promise((resolve, reject) => {
      const chunks = []
      let bytesRead = 0

      const readStream = stream.slice(start, end)
      
      readStream.on('data', chunk => {
        chunks.push(chunk)
        bytesRead += chunk.length
      })

      readStream.on('end', () => {
        resolve(Buffer.concat(chunks))
      })

      readStream.on('error', reject)
    })
  }

  /**
   * Upload simple (non chunké)
   */
  async _uploadSimple(uploadInfo, fileData) {
    const formData = new FormData()
    formData.append('file', fileData, uploadInfo.fileName)
    formData.append('bucket', uploadInfo.bucket)
    formData.append('category', uploadInfo.category)
    formData.append('metadata', JSON.stringify(uploadInfo.metadata))
    formData.append('checksum', uploadInfo.checksum)

    try {
      const response = await this._uploadWithRetry(uploadInfo, formData)

      uploadInfo.progress = 100
      uploadInfo.uploadedBytes = uploadInfo.fileSize
      uploadInfo.result = {
        fileId: response.data.fileId,
        url: response.data.url,
        ...response.data
      }

      this._updateSpeed(uploadInfo)
      this._addLog(uploadInfo, `✅ Upload terminé: ${uploadInfo.fileName} (${this._formatSize(uploadInfo.fileSize)})`)

      return uploadInfo.result

    } catch (error) {
      throw new Error(`Upload échoué: ${error.message}`)
    }
  }

  /**
   * Initie un upload chunké
   */
  async _initiateUpload(uploadInfo) {
    try {
      const response = await axios.post(`${this.config.endpoint}/initiate`, {
        fileName: uploadInfo.fileName,
        fileSize: uploadInfo.fileSize,
        bucket: uploadInfo.bucket,
        category: uploadInfo.category,
        metadata: uploadInfo.metadata,
        chunks: uploadInfo.totalChunks,
        contentType: uploadInfo.contentType,
        checksum: uploadInfo.checksum
      }, {
        headers: this._getHeaders()
      })

      return response.data
    } catch (error) {
      throw new Error(`Initiation upload échouée: ${error.message}`)
    }
  }

  /**
   * Upload un chunk avec retry
   */
  async _uploadChunkWithRetry(uploadInfo, chunkInfo, chunkData) {
    let lastError

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await this._checkPaused(uploadInfo)

      try {
        chunkInfo.attempts = attempt

        const formData = new FormData()
        formData.append('chunk', chunkData, `chunk-${chunkInfo.index}.bin`)
        formData.append('uploadId', uploadInfo.uploadId)
        formData.append('chunkIndex', chunkInfo.index)
        formData.append('totalChunks', uploadInfo.totalChunks)
        formData.append('checksum', uploadInfo.checksum)

        await axios.post(`${this.config.endpoint}/chunk`, formData, {
          headers: {
            ...formData.getHeaders(),
            ...this._getHeaders()
          },
          timeout: 30000,
          onUploadProgress: (progressEvent) => {
            uploadInfo.uploadedBytes += progressEvent.loaded || 0
            this._updateSpeed(uploadInfo)
          }
        })

        chunkInfo.status = 'completed'
        return

      } catch (error) {
        lastError = error
        chunkInfo.status = 'failed'
        chunkInfo.error = error.message

        this._addLog(uploadInfo, `⚠️ Chunk ${chunkInfo.index + 1} échoué (tentative ${attempt}/${MAX_RETRIES})`)

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
        }
      }
    }

    throw lastError || new Error(`Échec upload chunk ${chunkInfo.index + 1}`)
  }

  /**
   * Upload simple avec retry
   */
  async _uploadWithRetry(uploadInfo, formData) {
    let lastError

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        uploadInfo.retryCount = attempt

        const response = await axios.post(this.config.endpoint, formData, {
          headers: {
            ...formData.getHeaders(),
            ...this._getHeaders()
          },
          timeout: UPLOAD_TIMEOUT,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              uploadInfo.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100)
              uploadInfo.uploadedBytes = progressEvent.loaded
              this._updateSpeed(uploadInfo)

              this.emit('upload:progress', {
                uploadId: uploadInfo.id,
                progress: uploadInfo.progress,
                uploadedBytes: uploadInfo.uploadedBytes,
                totalBytes: progressEvent.total,
                speed: uploadInfo.speed
              })
            }
          }
        })

        return response

      } catch (error) {
        lastError = error
        this._addLog(uploadInfo, `⚠️ Tentative ${attempt}/${MAX_RETRIES} échouée: ${error.message}`)

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
        }
      }
    }

    throw lastError
  }

  /**
   * Récupère les headers d'authentification
   */
  _getHeaders() {
    const headers = {}
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`
    }
    return headers
  }

  /**
   * Finalise un upload chunké
   */
  async _finalizeUpload(uploadInfo) {
    try {
      const response = await axios.post(`${this.config.endpoint}/finalize`, {
        uploadId: uploadInfo.uploadId,
        totalChunks: uploadInfo.totalChunks,
        fileName: uploadInfo.fileName,
        bucket: uploadInfo.bucket,
        category: uploadInfo.category,
        metadata: uploadInfo.metadata,
        checksum: uploadInfo.checksum
      }, {
        headers: this._getHeaders()
      })

      return response.data
    } catch (error) {
      throw new Error(`Finalisation upload échouée: ${error.message}`)
    }
  }

  /**
   * Traite la file d'attente
   */
  async _processQueue() {
    if (this.activeUploads >= this.config.maxConcurrent || this.uploadQueue.length === 0) return

    while (this.activeUploads < this.config.maxConcurrent && this.uploadQueue.length > 0) {
      const uploadId = this.uploadQueue.shift()
      const upload = this.uploads.get(uploadId)

      if (!upload) continue

      this.activeUploads++
      this._processUpload(upload).finally(() => {
        this.activeUploads--
        this._processQueue()
      })
    }
  }

  /**
   * Traite un upload
   */
  async _processUpload(upload) {
    try {
      this.emit('upload:started', { uploadId: upload.id })

      upload.status = UPLOAD_STATUS.UPLOADING
      this._addLog(upload, `📤 Upload: ${upload.fileName} (${this._formatSize(upload.fileSize)})`)

      // Choisir la méthode selon la taille et l'option chunked
      let result
      if (upload.fileStream && upload.fileSize > this.config.chunkSize) {
        result = await this._uploadChunked(upload, upload.fileStream)
      } else {
        result = await this._uploadSimple(upload, upload.fileData)
      }

      upload.status = UPLOAD_STATUS.COMPLETED
      upload.endTime = Date.now()
      upload.duration = upload.endTime - upload.startTime
      upload.result = result

      this.emit('upload:completed', {
        uploadId: upload.id,
        fileId: result.fileId,
        url: result.url,
        size: upload.fileSize,
        duration: upload.duration,
        speed: upload.avgSpeed
      })

    } catch (error) {
      upload.status = UPLOAD_STATUS.FAILED
      upload.errors.push(error.message)
      upload.endTime = Date.now()
      upload.duration = upload.endTime - upload.startTime

      this.emit('upload:failed', {
        uploadId: upload.id,
        error: error.message
      })
    }
  }

  /**
   * Ajoute un log avec stockage
   */
  _addLog(upload, message) {
    const logEntry = {
      timestamp: Date.now(),
      message
    }

    if (!upload.logs) upload.logs = []
    upload.logs.push(logEntry)

    if (upload.logs.length > MAX_LOGS) {
      upload.logs.shift()
    }

    this.logger.info(message, { uploadId: upload.id })
  }

  /**
   * Récupère un upload
   */
  getUpload(uploadId) {
    return this.uploads.get(uploadId) || null
  }

  /**
   * Récupère les logs d'un upload
   */
  getUploadLogs(uploadId, limit = 50) {
    const upload = this.uploads.get(uploadId)
    return upload ? upload.logs.slice(-limit) : []
  }

  /**
   * Annule un upload
   */
  cancelUpload(uploadId) {
    const upload = this.uploads.get(uploadId)
    if (!upload) return false

    if ([UPLOAD_STATUS.COMPLETED, UPLOAD_STATUS.FAILED, UPLOAD_STATUS.CANCELLED].includes(upload.status)) {
      return false
    }

    upload.cancelled = true
    upload.status = UPLOAD_STATUS.CANCELLED
    upload.endTime = Date.now()
    upload.duration = upload.endTime - upload.startTime

    this._addLog(upload, '⛔ Upload annulé')
    this.emit('upload:cancelled', { uploadId })

    return true
  }

  /**
   * Met en pause un upload
   */
  pauseUpload(uploadId) {
    const upload = this.uploads.get(uploadId)
    if (!upload) return false

    if (upload.status !== UPLOAD_STATUS.UPLOADING) return false

    upload.status = UPLOAD_STATUS.PAUSED
    upload.paused = true
    this._addLog(upload, '⏸️ Upload mis en pause')
    this.emit('upload:paused', { uploadId })

    return true
  }

  /**
   * Reprend un upload en pause
   */
  resumeUpload(uploadId) {
    const upload = this.uploads.get(uploadId)
    if (!upload) return false

    if (upload.status !== UPLOAD_STATUS.PAUSED) return false

    upload.status = UPLOAD_STATUS.UPLOADING
    upload.paused = false
    this._addLog(upload, '▶️ Upload repris')
    this.emit('upload:resumed', { uploadId })

    return true
  }

/**
   * Récupère la progression d'un upload
   */
  getProgress(uploadId) {
    const upload = this.uploads.get(uploadId)
    if (!upload) return null

    return {
      progress: upload.progress,
      uploadedBytes: upload.uploadedBytes,
      totalBytes: upload.fileSize,
      status: upload.status,
      speed: upload.speed,
      avgSpeed: upload.avgSpeed,
      eta: upload.speed > 0 
        ? (upload.fileSize - upload.uploadedBytes) / upload.speed * 1000
        : null
    }
  }

  /**
   * Récupère les statistiques
   */
  getStats() {
    const avgUploadTime = this.stats.completedUploads > 0
      ? Math.round(this.stats.totalUploadTime / this.stats.completedUploads)
      : 0

    const avgSpeed = this.stats.speedSamples > 0
      ? Math.round(this.stats.totalSpeedSum / this.stats.speedSamples)
      : 0

    return {
      ...this.stats,
      averageUploadTime: avgUploadTime,
      averageUploadTimeFormatted: this._formatDuration(avgUploadTime),
      averageSpeed: avgSpeed,
      averageSpeedFormatted: this._formatSpeed(avgSpeed),
      fastestUploadFormatted: this._formatDuration(this.stats.fastestUpload),
      slowestUploadFormatted: this._formatDuration(this.stats.slowestUpload),
      largestUploadFormatted: this._formatSize(this.stats.largestUpload),
      queueLength: this.uploadQueue.length,
      activeUploads: this.activeUploads,
      totalUploads: this.stats.totalUploads,
      totalBytesFormatted: this._formatSize(this.stats.totalBytes),
      successRate: this.stats.totalUploads > 0
        ? Math.round((this.stats.completedUploads / this.stats.totalUploads) * 100)
        : 0
    }
  }

  /**
   * Formate la taille
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  /**
   * Formate une vitesse
   */
  _formatSpeed(bytesPerSecond) {
    return `${this._formatSize(bytesPerSecond)}/s`
  }

  /**
   * Formate une durée
   */
  _formatDuration(ms) {
    if (ms === Infinity) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h`
  }

  /**
   * Nettoie les uploads anciens
   */
  cleanupOldUploads(maxAge = 24 * 60 * 60 * 1000) {
    const now = Date.now()
    let cleaned = 0

    for (const [id, upload] of this.uploads.entries()) {
      if (upload.endTime && now - upload.endTime > maxAge) {
        this.uploads.delete(id)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} uploads anciens nettoyés`)
    }

    return cleaned
  }

  /**
   * Nettoie les ressources
   */
  destroy() {
    this.uploads.clear()
    this.uploadQueue = []
    this.removeAllListeners()
  }
}

export const fileUploader = new FileUploader()
export default fileUploader
