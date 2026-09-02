/**
 * InstallQR - Composant QR code pour installation Android
 * 
 * Rôle: Afficher un QR code pour l'installation d'APK
 * - QR code cliquable (accessible)
 * - Boutons téléchargement/copie/partage
 * - Instructions adaptatives selon plateforme
 * - Détection mobile automatique
 * - Statistiques téléchargements
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAndroidInstall } from '../hooks/useAndroidInstall'

// =============================
// CONSTANTES
// =============================

const QR_SIZE = 250
const EXPIRY_WARNING = 5 * 60 * 1000 // 5 minutes
const COPY_TIMEOUT = 2000 // 2 secondes

// =============================
// COMPOSANT PRINCIPAL
// =============================

export const InstallQR = ({
  projectId,
  version = '1.0.0',
  size = QR_SIZE,
  showDownload = true,
  showInstructions = true,
  showStats = true,
  onDownload,
  onInstall,
  onError,
  className = ''
}) => {
  const {
    state,
    steps,
    currentStep,
    isReady,
    isDownloading,
    isInstalling,
    isCompleted,
    isFailed,
    error,
    downloadUrl,
    qrCode,
    expiresAt,
    trackDownload,
    trackInstall,
    updateStep,
    checkCapability,
    openAndroidSettings
  } = useAndroidInstall(projectId, {
    version,
    onError
  })

  const [timeLeft, setTimeLeft] = useState(null)
  const [capability, setCapability] = useState(null)
  const [copied, setCopied] = useState(false)
  const [downloads, setDownloads] = useState(0)

  const mountedRef = useRef(true)
  const timerRef = useRef(null)

  // =============================
  // DÉTECTION PLATEFORME
  // =============================

  const isMobile = useMemo(() => {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }, [])

  // =============================
  // NETTOYAGE
  // =============================

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  // =============================
  // COMPTE À REBOURS
  // =============================

  useEffect(() => {
    if (!expiresAt) return

    const updateTimer = () => {
      const remaining = expiresAt - Date.now()

      if (!mountedRef.current) return

      if (remaining <= 0) {
        setTimeLeft(0)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        return
      }

      setTimeLeft(remaining)
    }

    updateTimer()
    timerRef.current = setInterval(updateTimer, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [expiresAt])

  // =============================
  // VÉRIFICATION CAPACITÉ
  // =============================

  useEffect(() => {
    let mounted = true

    const check = async () => {
      const cap = await checkCapability()
      if (mounted) setCapability(cap)
    }

    check()

    return () => {
      mounted = false
    }
  }, []) // Dépendance vide = exécuté une seule fois

  // =============================
  // MISE À JOUR STATS TÉLÉCHARGEMENTS
  // =============================

  useEffect(() => {
    if (state?.stats?.downloads) {
      setDownloads(state.stats.downloads)
    }
  }, [state])

  // =============================
  // FORMATAGE DU TEMPS RESTANT
  // =============================

  const formatTimeLeft = useCallback((ms) => {
    if (!ms || ms <= 0) return 'Expiré'
    
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleDownload = useCallback(async () => {
    if (!downloadUrl) return

    try {
      await trackDownload({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timestamp: Date.now()
      })
      
      // Ouvrir le lien de téléchargement
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
      
      setDownloads(prev => prev + 1)
      await updateStep('download_apk', true)
      onDownload?.()
    } catch (err) {
      console.error('Erreur téléchargement:', err)
    }
  }, [downloadUrl, trackDownload, updateStep, onDownload])

  const handleCopyLink = useCallback(async () => {
    if (!downloadUrl) return

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(downloadUrl)
      } else {
        // Fallback pour les navigateurs sans clipboard API
        const textarea = document.createElement('textarea')
        textarea.value = downloadUrl
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), COPY_TIMEOUT)

    } catch (err) {
      console.error('Erreur copie:', err)
    }
  }, [downloadUrl])

  const handleShare = useCallback(async () => {
    if (!downloadUrl) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Installer l’application',
          text: 'Installer la build de test depuis Vibe-Coding',
          url: downloadUrl
        })
      } catch (err) {
        console.error('Erreur partage:', err)
      }
    } else {
      // Fallback : copier le lien
      handleCopyLink()
    }
  }, [downloadUrl, handleCopyLink])

  const handleOpenSettings = useCallback(async () => {
    await openAndroidSettings()
    await updateStep(
      capability?.androidVersion >= 8 ? 'allow_browser_install' : 'enable_unknown_sources',
      true
    )
  }, [openAndroidSettings, updateStep, capability])

  const handleInstallComplete = useCallback(async () => {
    await trackInstall({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timestamp: Date.now()
    })
    onInstall?.()
  }, [trackInstall, onInstall])

  const handleQRClick = useCallback(() => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    }
  }, [downloadUrl])

  // =============================
  // MESSAGES D'INSTRUCTION
  // =============================

  const instructionMessages = useMemo(() => {
    if (!capability) return []

    if (!capability.canInstall) {
      return [{
        type: 'error',
        message: `Installation impossible sur ${capability.platform}`,
        details: capability.limitations
      }]
    }

    return [
      {
        id: 'step1',
        title: capability.androidVersion >= 8
          ? '1️⃣ Autoriser l\'installation depuis le navigateur'
          : '1️⃣ Activer les sources inconnues',
        description: capability.androidVersion >= 8
          ? 'Paramètres > Applications > Votre navigateur > Installer applications inconnues'
          : 'Paramètres > Sécurité > Sources inconnues',
        action: 'settings',
        completed: steps[0]?.completed || false
      },
      {
        id: 'step2',
        title: '2️⃣ Télécharger l\'APK',
        description: isMobile
          ? 'Appuyez sur le bouton ci-dessous pour télécharger'
          : 'Scannez le QR code ou cliquez sur le bouton ci-dessous',
        action: 'download',
        completed: isDownloading || isInstalling || isCompleted
      },
      {
        id: 'step3',
        title: '3️⃣ Ouvrir le fichier APK',
        description: 'Une fois téléchargé, ouvrez le fichier depuis les notifications',
        action: 'open',
        completed: isInstalling || isCompleted
      },
      {
        id: 'step4',
        title: '4️⃣ Installer l\'application',
        description: 'Appuyez sur "Installer" puis "Ouvrir"',
        action: 'install',
        completed: isCompleted
      }
    ]
  }, [capability, steps, isDownloading, isInstalling, isCompleted, isMobile])

  // =============================
  // RENDU
  // =============================

  if (isFailed) {
    return (
      <div className={`install-qr error ${className}`}>
        <div className="error-icon">❌</div>
        <div className="error-title">Erreur de génération</div>
        <div className="error-message">{error}</div>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className={`install-qr loading ${className}`}>
        <div className="spinner" />
        <div className="loading-text">Préparation de l'installation...</div>
      </div>
    )
  }

  return (
    <div className={`install-qr ${className}`}>
      {/* En-tête */}
      <div className="install-header">
        <h3 className="install-title">📱 Installer l'application</h3>
        <div className="header-right">
          {showStats && downloads > 0 && (
            <div className="downloads-count" title="Nombre de téléchargements">
              📥 {downloads}
            </div>
          )}
          {expiresAt && (
            <div className={`expiry-timer ${timeLeft < EXPIRY_WARNING ? 'warning' : ''}`}>
              ⏳ {formatTimeLeft(timeLeft)}
            </div>
          )}
        </div>
      </div>

      {/* QR Code (caché sur mobile) */}
      {!isMobile && (
        <div className="qr-container">
          <img 
            src={qrCode} 
            alt="QR Code d'installation"
            className="qr-image"
            style={{ width: size, height: size }}
            onClick={handleQRClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleQRClick()
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Ouvrir le lien de téléchargement"
          />
          <div className="qr-overlay">
            <span>Scanner avec l'appareil photo</span>
          </div>
        </div>
      )}

      {/* Actions rapides */}
      {showDownload && (
        <div className="quick-actions">
          {isMobile ? (
            <button 
              className="download-button mobile"
              onClick={() => window.location.href = downloadUrl}
              disabled={!downloadUrl}
            >
              📲 Installer directement
            </button>
          ) : (
            <>
              <button 
                className="download-button"
                onClick={handleDownload}
                disabled={!downloadUrl}
              >
                📥 Télécharger l'APK
              </button>
              <button 
                className="icon-button"
                onClick={handleCopyLink}
                title="Copier le lien"
              >
                {copied ? '✅' : '📋'}
              </button>
              <button 
                className="icon-button"
                onClick={handleShare}
                title="Partager"
              >
                📤
              </button>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {showInstructions && (
        <div className="instructions">
          <h4 className="instructions-title">📋 Instructions d'installation</h4>
          
          {instructionMessages.map((msg, idx) => (
            <div 
              key={msg.id || idx}
              className={`instruction-step ${msg.completed ? 'completed' : ''}`}
            >
              <div className="step-header">
                <span className="step-icon">{msg.completed ? '✅' : '⏳'}</span>
                <span className="step-title">{msg.title}</span>
              </div>
              
              <div className="step-description">{msg.description}</div>
              
              {msg.action === 'settings' && !msg.completed && (
                <button 
                  className="step-action"
                  onClick={handleOpenSettings}
                >
                  ⚙️ Ouvrir les paramètres
                </button>
              )}
              
              {msg.action === 'download' && !msg.completed && (
                <button 
                  className="step-action"
                  onClick={handleDownload}
                >
                  📥 Télécharger
                </button>
              )}
              
              {msg.action === 'install' && !msg.completed && isInstalling && (
                <button 
                  className="step-action"
                  onClick={handleInstallComplete}
                >
                  ✅ J'ai installé l'application
                </button>
              )}
            </div>
          ))}

          {isCompleted && (
            <div className="completion-message">
              <div className="completion-icon">🎉</div>
              <div className="completion-text">
                Installation terminée ! Vous pouvez maintenant ouvrir l'application.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barre de progression */}
      {currentStep > 0 && currentStep < 4 && (
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(currentStep / 4) * 100}%` }}
          />
        </div>
      )}

      <style jsx>{`
        .install-qr {
          background: #2d2d2d;
          border-radius: 8px;
          padding: 20px;
          color: #d4d4d4;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .install-qr.loading,
        .install-qr.error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #3e3e3e;
          border-top-color: #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .install-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .install-title {
          margin: 0;
          font-size: 16px;
          color: #007bff;
        }

        .downloads-count {
          padding: 4px 8px;
          background: #1e1e1e;
          border-radius: 4px;
          font-size: 12px;
          color: #4caf50;
        }

        .expiry-timer {
          padding: 4px 8px;
          background: #1e1e1e;
          border-radius: 4px;
          font-size: 12px;
          color: #888;
        }

        .expiry-timer.warning {
          background: #5a2e2e;
          color: #f48771;
        }

        .qr-container {
          position: relative;
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }

        .qr-image {
          border-radius: 8px;
          border: 2px solid #3e3e3e;
          transition: transform 0.2s;
          cursor: pointer;
        }

        .qr-image:hover {
          transform: scale(1.02);
        }

        .qr-image:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }

        .qr-overlay {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          pointer-events: none;
        }

        .quick-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
        }

        .download-button {
          flex: 1;
          padding: 10px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .download-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .download-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .download-button.mobile {
          background: #4caf50;
        }

        .download-button.mobile:hover {
          background: #388e3c;
        }

        .icon-button {
          padding: 10px 16px;
          background: #3e3e3e;
          border: none;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .icon-button:hover {
          background: #505050;
        }

        .instructions {
          border-top: 1px solid #3e3e3e;
          padding-top: 16px;
        }

        .instructions-title {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #888;
        }

        .instruction-step {
          margin-bottom: 16px;
          padding: 12px;
          background: #1e1e1e;
          border-radius: 6px;
          border-left: 3px solid #3e3e3e;
        }

        .instruction-step.completed {
          border-left-color: #4caf50;
          opacity: 0.8;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .step-icon {
          font-size: 16px;
        }

        .step-title {
          font-weight: bold;
          color: #d4d4d4;
        }

        .step-description {
          font-size: 13px;
          color: #888;
          margin-bottom: 8px;
        }

        .step-action {
          padding: 6px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .step-action:hover {
          background: #3e3e3e;
        }

        .completion-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #1e3a5f;
          border-radius: 6px;
        }

        .completion-icon {
          font-size: 24px;
        }

        .completion-text {
          flex: 1;
          color: #d4d4d4;
        }

        .progress-bar {
          height: 4px;
          background: #1e1e1e;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 16px;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }

        .error-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .error-title {
          font-size: 18px;
          font-weight: bold;
          color: #f48771;
          margin-bottom: 8px;
        }

        .error-message {
          color: #888;
          margin-bottom: 20px;
        }

        .retry-button {
          padding: 10px 20px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
        }

        .retry-button:hover {
          background: #0056b3;
        }
      `}</style>
    </div>
  )
}

export default InstallQR
