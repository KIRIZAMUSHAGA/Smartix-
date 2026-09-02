/**
 * fileCleanup - Nettoyage des fichiers temporaires
 * 
 * Rôle: Supprimer les fichiers après traitement
 * - Gestion asynchrone
 * - Retry sur échec
 * - Logging
 */

import fs from 'fs'
import path from 'path'
import { logger } from './logger'

const MAX_RETRIES = 3
const RETRY_DELAY = 500 // ms

export const cleanupTempFiles = async (filePaths) => {
  const results = []

  for (const filePath of filePaths) {
    if (!filePath || !fs.existsSync(filePath)) {
      continue
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await fs.promises.unlink(filePath)
        logger.debug(`Fichier nettoyé: ${path.basename(filePath)}`)
        results.push({ success: true, filePath })
        break
      } catch (error) {
        logger.warn(`Nettoyage échoué (tentative ${attempt}/${MAX_RETRIES}): ${filePath}`)
        
        if (attempt === MAX_RETRIES) {
          logger.error(`Impossible de nettoyer: ${filePath}`, error)
          results.push({ success: false, filePath, error: error.message })
        } else {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
        }
      }
    }
  }

  return {
    success: results.every(r => r.success),
    results
  }
}

export const cleanupTempDirectory = async (directory, pattern = null) => {
  try {
    const files = await fs.promises.readdir(directory)
    
    const toDelete = pattern
      ? files.filter(f => f.match(pattern))
      : files

    const results = await cleanupTempFiles(
      toDelete.map(f => path.join(directory, f))
    )

    return results
  } catch (error) {
    logger.error('Erreur nettoyage dossier:', error)
    return { success: false, error: error.message }
  }
            }
