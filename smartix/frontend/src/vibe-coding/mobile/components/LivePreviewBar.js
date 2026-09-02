/**
 * LivePreviewBar - Barre de contrôle pour le live preview
 * 
 * Rôle: Centre de contrôle mobile pour le live preview
 * - Statut de la session avec indicateur LIVE
 * - QR code pour connexion mobile avec feedback
 * - Appareils connectés avec avatars
 * - Actions (arrêter, prolonger, copier)
 * - Logs et métriques (optionnel)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLivePreview } from '../hooks/useLivePreview'
import { useDeviceManager } from '../hooks/useDeviceManager'
import { InstallQR } from './InstallQR'
import { DeviceList } from './DeviceList'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const SESSION_EXTEND_TIME = 30 * 60 * 1000 // 30 minutes
const MAX_DEVICES_DISPLAY = 3
const WARNING_THRESHOLD = 300000 // 5 minutes

// =============================
// UTILITAIRES
// =============================

const getDeviceType = (userAgent) => {
  if (!userAgent) return 'unknown'
  
  const ua = userAgent.toLowerCase()
  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios'
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac')) return 'mac'
  return 'other'
}

const getDeviceIcon = (device) => {
  const type = getDeviceType(device.userAgent)
  
  switch (type) {
    case 'android': return '🤖'
    case 'ios': return '🍎'
    case 'windows': return '💻'
    case 'mac': return '💻'
    default: return '📱'
  }
}

// =============================
// SOUS-COMPOSANT : DeviceAvatars
// =============================

const DeviceAvatars = React.memo(({ devices, max = MAX_DEVICES_DISPLAY }) => {
  const displayDevices = useMemo(
    () => devices.slice(0, max),
    [devices, max]
  )
  const remaining = devices.length - max

  return (
    <div className="device-avatars">
      {displayDevices.map((device, idx) => (
        <div
          key={device.clientId || device.id}
          className="device-avatar"
          title={`${device.model || 'Appareil'} - ${device.platform || 'inconnu'}`}
          style={{ zIndex: displayDevices.length - idx }}
        >
          {getDeviceIcon(device)}
        </div>
      ))}
      {remaining > 0 && (
        <div className="device-avatar more" title={`${remaining} autres appareil(s)`}>
          +{remaining}
        </div>
      )}
      <style jsx>{`
        .device-avatars {
          display: flex;
          align-items: center;
          margin-left: 8px;
        }

        .device-avatar {
          width: 28px;
          height: 28px;
          border-radius: 14px;
          background: #2d2d2d;
          border: 2px solid #1e1e1e;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: -8px;
          font-size: 14px;
          transition: transform 0.2s;
        }

        .device-avatar:hover {
          transform: translateY(-2px);
          z-index: 10;
        }

        .device-avatar.more {
          background: #3e3e3e;
          color: #888;
          font-size: 10px;
          font-weight: bold;
        }
      `}</style>
    </div>
  )
})

DeviceAvatars.displayName = 'DeviceAvatars'

// =============================
// SOUS-COMPOSANT : Notification
// =============================

const Notification = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.()
    }, 3000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`notification ${type}`}>
      <span className="notification-icon">
        {type === 'success' ? '✅' : 'ℹ️'}
      </span>
      <span className="notification-message">{message}</span>
      <button className="notification-close" onClick={onClose}>✕</button>
      <style jsx>{`
        .notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 10px 16px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 6px;
          color: #d4d4d4;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          animation: slideIn 0.3s ease;
          z-index: 10000;
        }

        .notification.success {
          border-left: 4px solid #4caf50;
        }

        .notification.info {
          border-left: 4px solid #2196f3;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .notification-icon {
          font-size: 16px;
        }

        .notification-close {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
        }

        .notification-close:hover {
          color: #fff;
        }
      `}</style>
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================

export const LivePreviewBar = ({
  projectId,
  onSessionStart,
  onSessionStop,
  onDeviceSelect,
  onDeviceInspect,
  showLogs = false,
  showPerformance = false,
  className = '',
  position = 'top' // top, bottom
}) => {
  const [showQR, setShowQR] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [showLogsPanel, setShowLogsPanel] = useState(false)
  const [showPerformancePanel, setShowPerformancePanel] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [timeLeft, setTimeLeft] = useState(null)
  const [copied, setCopied] = useState(false)
  const [notification, setNotification] = useState(null)

  const {
    state,
    connectedDevices,
    deviceCount,
    isActive,
    isStarting,
    isStopping,
    isError,
    error,
    startPreview,
    stopPreview,
    extendSession,
    previewUrl,
    qrCode,
    expiresAt,
    updatesSent
  } = useLivePreview(projectId, {
    autoStart: false,
    onDeviceConnected: (device) => {
      setNotification({
        message: `📱 ${device.deviceInfo?.model || 'Appareil'} connecté`,
        type: 'success'
      })
    },
    onError: (err) => {
      setNotification({
        message: `Erreur: ${err.message}`,
        type: 'error'
      })
    }
  })

  const { refresh } = useDeviceManager()

  // =============================
  // COMPTE À REBOURS
  // =============================

  useEffect(() => {
    if (!isActive || !expiresAt) {
      setTimeLeft(null)
      return
    }

    const updateTimer = () => {
      const remaining = expiresAt - Date.now()
      setTimeLeft(remaining > 0 ? remaining : 0)
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)

    return () => clearInterval(timer)
  }, [isActive, expiresAt])

  // =============================
  // FORMATAGE
  // =============================

  const formatTimeLeft = useCallback((ms) => {
    if (!ms || ms <= 0) return '0:00'
    
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  const getStatusIcon = useCallback(() => {
    if (isStarting) return '⏳'
    if (isActive) return '🟢'
    if (isStopping) return '⏸️'
    if (isError) return '❌'
    return '⚪'
  }, [isActive, isStarting, isStopping, isError])

  const getStatusText = useCallback(() => {
    if (isStarting) return 'Démarrage...'
    if (isActive) return 'Preview active'
    if (isStopping) return 'Arrêt...'
    if (isError) return `Erreur: ${error}`
    return 'Preview inactive'
  }, [isActive, isStarting, isStopping, isError, error])

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleStartPreview = useCallback(async () => {
    await startPreview()
    onSessionStart?.()
    setExpanded(true)
    setShowQR(true)
  }, [startPreview, onSessionStart])

  const handleStopPreview = useCallback(async () => {
    await stopPreview()
    setShowQR(false)
    setShowDevices(false)
    setShowLogsPanel(false)
    setShowPerformancePanel(false)
    setExpanded(false)
    onSessionStop?.()
  }, [stopPreview, onSessionStop])

  const handleExtendSession = useCallback(async () => {
    await extendSession(SESSION_EXTEND_TIME)
    setNotification({
      message: 'Session prolongée de 30 minutes',
      type: 'success'
    })
  }, [extendSession])

  const handleCopyUrl = useCallback(async () => {
    if (!previewUrl) return

    try {
      await navigator.clipboard.writeText(previewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erreur copie:', err)
    }
  }, [previewUrl])

  const handleDeviceSelect = useCallback((device) => {
    onDeviceSelect?.(device)
  }, [onDeviceSelect])

  const handleDeviceInspect = useCallback((device) => {
    onDeviceInspect?.(device)
  }, [onDeviceInspect])

  const closeNotification = useCallback(() => {
    setNotification(null)
  }, [])

  // =============================
  // RENDU
  // =============================

  return (
    <div className={`live-preview-bar ${position} ${expanded ? 'expanded' : ''} ${className}`}>
      {/* Barre principale */}
      <div className="preview-bar-main">
        <div className="preview-status">
          <span className="status-icon" title={getStatusText()}>
            {getStatusIcon()}
          </span>
          <span className="status-text">{getStatusText()}</span>
          {isActive && (
            <span className="live-badge" title="Live en cours">
              🔴 LIVE
            </span>
          )}
        </div>

        {isActive && (
          <>
            <div className="preview-info">
              <span className="info-item" title="Appareils connectés">
                📱 {deviceCount}
              </span>
              {updatesSent > 0 && (
                <span className="info-item" title="Mises à jour envoyées">
                  🔄 {updatesSent}
                </span>
              )}
              {timeLeft > 0 && (
                <span 
                  className={`info-item timer ${timeLeft < WARNING_THRESHOLD ? 'warning' : ''}`}
                  title={timeLeft < WARNING_THRESHOLD ? 'Session expire bientôt' : 'Temps restant'}
                >
                  ⏳ {formatTimeLeft(timeLeft)}
                </span>
              )}
            </div>

            {deviceCount > 0 && <DeviceAvatars devices={connectedDevices} />}

            <div className="preview-actions">
              <button
                className={`action-button qr ${showQR ? 'active' : ''}`}
                onClick={() => setShowQR(!showQR)}
                title={showQR ? 'Masquer le QR code' : 'Afficher le QR code'}
              >
                {showQR ? '❌' : '📷'}
              </button>
              <button
                className={`action-button devices ${showDevices ? 'active' : ''}`}
                onClick={() => setShowDevices(!showDevices)}
                title={showDevices ? 'Masquer la liste' : 'Afficher les appareils'}
              >
                📋 {deviceCount > 0 && <span className="badge">{deviceCount}</span>}
              </button>
              {showLogs && (
                <button
                  className={`action-button logs ${showLogsPanel ? 'active' : ''}`}
                  onClick={() => setShowLogsPanel(!showLogsPanel)}
                  title="Logs en direct"
                >
                  📝
                </button>
              )}
              {showPerformance && (
                <button
                  className={`action-button performance ${showPerformancePanel ? 'active' : ''}`}
                  onClick={() => setShowPerformancePanel(!showPerformancePanel)}
                  title="Performance"
                >
                  📊
                </button>
              )}
              <button
                className="action-button copy"
                onClick={handleCopyUrl}
                title={copied ? 'Copié !' : 'Copier l\'URL'}
              >
                {copied ? '✅' : '📋'}
              </button>
              <button
                className="action-button extend"
                onClick={handleExtendSession}
                title="Prolonger la session"
              >
                ⏱️
              </button>
              <button
                className="action-button stop"
                onClick={handleStopPreview}
                title="Arrêter la preview"
              >
                ⏹️
              </button>
            </div>
          </>
        )}

        {!isActive && !isStarting && (
          <div className="preview-actions">
            <button
              className="action-button start"
              onClick={handleStartPreview}
              disabled={isStarting}
            >
              ▶️ Démarrer la preview
            </button>
          </div>
        )}

        <button
          className="expand-toggle"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Réduire' : 'Développer'}
        >
          {expanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Panneau étendu */}
      {expanded && (
        <div className="preview-panel">
          {showQR && qrCode && (
            <div className="panel-section qr-section">
              <h4 className="section-title">
                <span>📱 Connexion mobile</span>
                {timeLeft < WARNING_THRESHOLD && timeLeft > 0 && (
                  <span className="warning-badge">⚠️ Expire bientôt</span>
                )}
              </h4>
              <div className="qr-wrapper">
                <img src={qrCode} alt="QR Code" className="qr-image" />
                <div className="qr-info">
                  <p className="qr-url" title={previewUrl}>
                    {previewUrl}
                  </p>
                  <div className="qr-actions">
                    <button 
                      className="copy-button"
                      onClick={handleCopyUrl}
                    >
                      {copied ? '✅ Copié' : '📋 Copier'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showDevices && (
            <div className="panel-section devices-section">
              <h4 className="section-title">
                📱 Appareils connectés ({deviceCount})
              </h4>
              <DeviceList
                sessionId={state.sessionId}
                maxHeight="300px"
                onDeviceSelect={handleDeviceSelect}
                onDeviceInspect={handleDeviceInspect}
                showSearch={true}
                showFilters={true}
                showStats={true}
              />
            </div>
          )}

          {showLogs && showLogsPanel && (
            <div className="panel-section logs-section">
              <h4 className="section-title">📝 Logs en direct</h4>
              <div className="logs-placeholder">
                Logs des appareils connectés...
              </div>
            </div>
          )}

          {showPerformance && showPerformancePanel && (
            <div className="panel-section performance-section">
              <h4 className="section-title">📊 Performance</h4>
              <div className="performance-placeholder">
                Métriques de performance...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={closeNotification}
        />
      )}

      <style jsx>{`
        .live-preview-bar {
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          overflow: hidden;
          color: #d4d4d4;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .live-preview-bar.top {
          margin-bottom: 16px;
        }

        .live-preview-bar.bottom {
          margin-top: 16px;
        }

        .live-preview-bar.expanded {
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .preview-bar-main {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
          flex-wrap: wrap;
          gap: 8px;
        }

        .preview-status {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 150px;
        }

        .status-icon {
          font-size: 16px;
        }

        .status-text {
          font-size: 12px;
          color: #d4d4d4;
        }

        .live-badge {
          font-size: 10px;
          font-weight: bold;
          color: #ff4444;
          background: #2d2d2d;
          padding: 2px 6px;
          border-radius: 10px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }

        .preview-info {
          display: flex;
          gap: 12px;
          margin-left: 16px;
          flex-wrap: wrap;
        }

        .info-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #888;
        }

        .info-item.timer.warning {
          color: #f48771;
        }

        .preview-actions {
          display: flex;
          gap: 4px;
          margin-left: auto;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 6px 10px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          position: relative;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .action-button:hover:not(:disabled) {
          background: #3e3e3e;
          border-color: #505050;
        }

        .action-button.active {
          background: #1e3a5f;
          border-color: #007bff;
        }

        .action-button.start {
          background: #4caf50;
          color: white;
          border-color: #388e3c;
        }

        .action-button.start:hover {
          background: #388e3c;
        }

        .action-button.stop {
          background: #f44336;
          color: white;
          border-color: #d32f2f;
        }

        .action-button.stop:hover {
          background: #d32f2f;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #f44336;
          color: white;
          font-size: 10px;
          font-weight: bold;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .expand-toggle {
          padding: 4px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          margin-left: 8px;
        }

        .expand-toggle:hover {
          color: #fff;
        }

        .preview-panel {
          padding: 16px;
          background: #2d2d2d;
        }

        .panel-section {
          margin-bottom: 16px;
        }

        .panel-section:last-child {
          margin-bottom: 0;
        }

           .section-title {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #007bff;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .warning-badge {
          font-size: 11px;
          background: #5a2e2e;
          color: #f48771;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .qr-section {
          display: flex;
          flex-direction: column;
        }

        .qr-wrapper {
          display: flex;
          gap: 16px;
          align-items: center;
          background: #1e1e1e;
          padding: 16px;
          border-radius: 6px;
          flex-wrap: wrap;
        }

        .qr-image {
          width: 120px;
          height: 120px;
          border-radius: 4px;
          border: 2px solid #3e3e3e;
        }

        .qr-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 200px;
        }

        .qr-url {
          font-family: monospace;
          font-size: 12px;
          color: #9cdcfe;
          word-break: break-all;
          background: #2d2d2d;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #3e3e3e;
        }

        .qr-actions {
          display: flex;
          gap: 8px;
        }

        .copy-button {
          padding: 6px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 12px;
        }

        .copy-button:hover {
          background: #3e3e3e;
        }

        .logs-placeholder,
        .performance-placeholder {
          background: #1e1e1e;
          padding: 40px;
          text-align: center;
          color: #888;
          border-radius: 4px;
        }

        @media (max-width: 768px) {
          .preview-info {
            margin-left: 0;
            width: 100%;
            order: 2;
          }

          .preview-actions {
            margin-left: 0;
            width: 100%;
            justify-content: flex-start;
            order: 3;
          }

          .qr-wrapper {
            flex-direction: column;
            text-align: center;
          }

          .qr-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  )
}

LivePreviewBar.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onSessionStart: PropTypes.func.isRequired,
  onSessionStop: PropTypes.func.isRequired,
  onDeviceSelect: PropTypes.func.isRequired,
  onDeviceInspect: PropTypes.func.isRequired,
  showLogs: PropTypes.bool,
  showPerformance: PropTypes.bool,
  className: PropTypes.any,
  position: PropTypes.number,
  bottom: PropTypes.node.isRequired,
};

export default LivePreviewBar
Notification.propTypes = {
  message: PropTypes.object.isRequired,
  type: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
