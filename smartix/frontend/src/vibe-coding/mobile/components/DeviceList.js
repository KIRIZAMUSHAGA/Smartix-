/**
 * DeviceList - Liste des appareils connectés
 * 
 * Rôle: Afficher les appareils connectés au live preview
 * - Liste virtualisée des appareils
 * - Statut en temps réel (actif/idle/offline)
 * - Filtres et recherche avec debounce
 * - Actions (bloquer/déconnecter/inspecter)
 * - Masquage IP pour sécurité
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useDeviceManager } from '../hooks/useDeviceManager'

// =============================
// CONSTANTES
// =============================

const REFRESH_INTERVAL = 2000 // 2 secondes
const MAX_DISPLAYED_DEVICES = 100
const ACTIVE_THRESHOLD = 10000 // 10 secondes
const IDLE_THRESHOLD = 60000 // 1 minute
const SEARCH_DEBOUNCE = 300 // 300ms

// =============================
// UTILITAIRES
// =============================

const maskIP = (ip) => {
  if (!ip) return 'Inconnue'
  const parts = ip.split('.')
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
  }
  return ip
}

const isRealDevice = (userAgent) => {
  return /Android|iPhone|iPad|iPod/i.test(userAgent || '')
}

const getDeviceStatus = (device) => {
  if (device.status === 'blocked') return 'blocked'
  if (device.status !== 'connected') return 'disconnected'

  const now = Date.now()
  const lastSeen = new Date(device.lastSeen || 0).getTime()
  const timeSinceLastSeen = now - lastSeen

  if (timeSinceLastSeen < ACTIVE_THRESHOLD) return 'active'
  if (timeSinceLastSeen < IDLE_THRESHOLD) return 'idle'
  return 'offline'
}

const getStatusIcon = (status) => {
  switch (status) {
    case 'active': return '🟢'
    case 'idle': return '🟡'
    case 'offline': return '⚫'
    case 'blocked': return '🔒'
    default: return '⚫'
  }
}

const getStatusLabel = (status) => {
  switch (status) {
    case 'active': return 'Actif'
    case 'idle': return 'Inactif'
    case 'offline': return 'Hors ligne'
    case 'blocked': return 'Bloqué'
    default: return 'Déconnecté'
  }
}

const formatDuration = (ms) => {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${Math.round(ms / 3600000)}h`
}

// =============================
// SOUS-COMPOSANT : DeviceCard
// =============================

const DeviceCard = ({
  device,
  onBlock,
  onUnblock,
  onDisconnect,
  onInspect,
  onSelect,
  isSelected = false
}) => {
  const [expanded, setExpanded] = useState(false)
  const deviceStatus = getDeviceStatus(device)
  const isReal = isRealDevice(device.userAgent)

  const getDeviceIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'android': return '🤖'
      case 'ios': return '🍎'
      default: return isReal ? '📱' : '💻'
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Inconnu'
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'à l\'instant'
    if (diff < 3600000) return `il y a ${Math.floor(diff / 60000)} min`
    if (diff < 86400000) return `il y a ${Math.floor(diff / 3600000)} h`
    return date.toLocaleDateString('fr-FR')
  }

  return (
    <div 
      className={`device-card ${deviceStatus} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect?.(device)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect?.(device)
        }
      }}
    >
      <div className="device-header">
        <div className="device-icon">
          {getDeviceIcon(device.platform)}
        </div>
        
        <div className="device-info">
          <div className="device-name">
            {device.model || 'Appareil inconnu'}
            {device.manufacturer && ` (${device.manufacturer})`}
            {isReal && <span className="real-device-badge" title="Appareil réel">📱</span>}
          </div>
          <div className="device-meta">
            <span className={`status-badge ${deviceStatus}`}>
              {getStatusIcon(deviceStatus)} {getStatusLabel(deviceStatus)}
            </span>
            <span className="device-version">
              {device.platform} {device.version}
            </span>
          </div>
        </div>

        <button 
          className="expand-button"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          aria-label={expanded ? 'Réduire' : 'Développer'}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="device-details">
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{device.id?.substring(0, 8)}...</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{isReal ? '📱 Réel' : '💻 Simulé'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Première connexion:</span>
              <span className="detail-value">{formatDate(device.firstSeen)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Dernière activité:</span>
              <span className="detail-value">{formatDate(device.lastSeen)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Connexions:</span>
              <span className="detail-value">{device.connections || 1}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Temps total:</span>
              <span className="detail-value">
                {device.totalTime ? formatDuration(device.totalTime) : '0s'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">IP:</span>
              <span className="detail-value">{maskIP(device.ip)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Ping:</span>
              <span className="detail-value">{device.latency ? `${device.latency}ms` : 'N/A'}</span>
            </div>
          </div>

          {device.userAgent && (
            <div className="detail-section">
              <div className="detail-label">User Agent:</div>
              <div className="detail-value user-agent">{device.userAgent}</div>
            </div>
          )}

          {device.metadata && Object.keys(device.metadata).length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Métadonnées:</div>
              <pre className="metadata">{JSON.stringify(device.metadata, null, 2)}</pre>
            </div>
          )}

          <div className="device-actions">
            {deviceStatus !== 'blocked' && deviceStatus !== 'disconnected' && (
              <>
                <button 
                  className="action-button inspect"
                  onClick={(e) => {
                    e.stopPropagation()
                    onInspect?.(device)
                  }}
                  title="Ouvrir l'inspecteur"
                >
                  🔍 Inspecter
                </button>
                <button 
                  className="action-button disconnect"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDisconnect?.(device.id)
                  }}
                  title="Déconnecter l'appareil"
                >
                  ⚡ Déconnecter
                </button>
              </>
            )}
            {deviceStatus === 'blocked' ? (
              <button 
                className="action-button unblock"
                onClick={(e) => {
                  e.stopPropagation()
                  onUnblock?.(device.id)
                }}
              >
                ✅ Débloquer
              </button>
            ) : (
              <button 
                className="action-button block"
                onClick={(e) => {
                  e.stopPropagation()
                  onBlock?.(device.id, 'manual')
                }}
              >
                🔒 Bloquer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================

export const DeviceList = ({
  projectId = null,
  sessionId = null,
  showFilters = true,
  showSearch = true,
  showStats = true,
  maxHeight = '400px',
  onDeviceSelect,
  onDeviceBlock,
  onDeviceUnblock,
  onDeviceDisconnect,
  onDeviceInspect,
  className = ''
}) => {
  const {
    devices,
    connectedDevices,
    blockedDevices,
    stats,
    loading,
    error,
    blockDevice,
    unblockDevice,
    refresh,
    getDevicesBySession,
    disconnectDevice
  } = useDeviceManager({
    autoRefresh: true,
    refreshInterval: REFRESH_INTERVAL
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, active, idle, offline, blocked
  const [sortBy, setSortBy] = useState('lastSeen') // lastSeen, firstSeen, model
  const [selectedDevice, setSelectedDevice] = useState(null)

  // =============================
  // DEBOUNCE RECHERCHE
  // =============================

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, SEARCH_DEBOUNCE)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // =============================
  // NETTOYAGE SÉLECTION
  // =============================

  useEffect(() => {
    if (!selectedDevice) return

    const exists = sessionDevices.find(d => d.id === selectedDevice.id)
    if (!exists) {
      setSelectedDevice(null)
    }
  }, [sessionDevices, selectedDevice])

  // =============================
  // FILTRAGE
  // =============================

  // Filtrer les appareils par session si sessionId est fourni
  const sessionDevices = useMemo(() => {
    if (sessionId) {
      return getDevicesBySession(sessionId)
    }
    return devices
  }, [sessionId, devices, getDevicesBySession])

  // Appliquer les filtres (avec copie pour éviter la mutation)
  const filteredDevices = useMemo(() => {
    let result = [...sessionDevices]

    // Filtre par recherche textuelle
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      result = result.filter(d => 
        d.model?.toLowerCase().includes(term) ||
        d.manufacturer?.toLowerCase().includes(term) ||
        d.id?.toLowerCase().includes(term) ||
        d.platform?.toLowerCase().includes(term) ||
        d.version?.toLowerCase().includes(term)
      )
    }

    // Filtre par statut
    switch (filter) {
      case 'active':
        result = result.filter(d => getDeviceStatus(d) === 'active')
        break
      case 'idle':
        result = result.filter(d => getDeviceStatus(d) === 'idle')
        break
      case 'offline':
        result = result.filter(d => getDeviceStatus(d) === 'offline')
        break
      case 'blocked':
        result = result.filter(d => getDeviceStatus(d) === 'blocked')
        break
      default:
        break
    }

    // Tri
    result.sort((a, b) => {
      const aStatus = getDeviceStatus(a)
      const bStatus = getDeviceStatus(b)

      // Priorité aux actifs
      if (aStatus !== bStatus) {
        const priority = { active: 0, idle: 1, offline: 2, blocked: 3 }
        return priority[aStatus] - priority[bStatus]
      }

      switch (sortBy) {
        case 'lastSeen':
          return (b.lastSeen || 0) - (a.lastSeen || 0)
        case 'firstSeen':
          return (b.firstSeen || 0) - (a.firstSeen || 0)
        case 'model':
          return (a.model || '').localeCompare(b.model || '')
        default:
          return 0
      }
    })

    return result.slice(0, MAX_DISPLAYED_DEVICES)
  }, [sessionDevices, debouncedSearch, filter, sortBy])

  // =============================
  // STATISTIQUES AVANCÉES
  // =============================

  const statsDisplay = useMemo(() => {
    const active = sessionDevices.filter(d => getDeviceStatus(d) === 'active').length
    const idle = sessionDevices.filter(d => getDeviceStatus(d) === 'idle').length
    const offline = sessionDevices.filter(d => getDeviceStatus(d) === 'offline').length
    const blocked = sessionDevices.filter(d => getDeviceStatus(d) === 'blocked').length

    const avgSessionTime = sessionDevices.length
      ? sessionDevices.reduce((acc, d) => acc + (d.totalTime || 0), 0) / sessionDevices.length
      : 0

    const realDevices = sessionDevices.filter(d => isRealDevice(d.userAgent)).length

    return {
      total: sessionDevices.length,
      active,
      idle,
      offline,
      blocked,
      avgSessionTime,
      realDevices,
      virtualDevices: sessionDevices.length - realDevices
    }
  }, [sessionDevices])

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleBlockDevice = useCallback(async (deviceId, reason) => {
    const result = await blockDevice(deviceId, reason)
    if (result.success) {
      onDeviceBlock?.({ deviceId, reason })
    }
  }, [blockDevice, onDeviceBlock])

  const handleUnblockDevice = useCallback(async (deviceId) => {
    const result = await unblockDevice(deviceId)
    if (result.success) {
      onDeviceUnblock?.({ deviceId })
    }
  }, [unblockDevice, onDeviceUnblock])

  const handleDisconnectDevice = useCallback(async (deviceId) => {
    const result = await disconnectDevice(deviceId)
    if (result) {
      refresh()
      onDeviceDisconnect?.({ deviceId })
    }
  }, [disconnectDevice, refresh, onDeviceDisconnect])

  const handleInspectDevice = useCallback((device) => {
    onDeviceInspect?.(device)
  }, [onDeviceInspect])

  const handleDeviceSelect = useCallback((device) => {
    setSelectedDevice(device)
    onDeviceSelect?.(device)
  }, [onDeviceSelect])

  if (loading && !devices.length) {
    return (
      <div className={`device-list loading ${className}`}>
        <div className="spinner" />
        <div>Chargement des appareils...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`device-list error ${className}`}>
        <div className="error-icon">⚠️</div>
        <div className="error-message">{error}</div>
        <button className="retry-button" onClick={refresh}>
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className={`device-list ${className}`}>
      {/* En-tête */}
      <div className="list-header">
        <h3 className="list-title">📱 Appareils connectés</h3>
        <div className="live-indicator">
          <span className="live-dot">🔴</span>
          <span className="live-text">Live</span>
        </div>
      </div>

      {/* Statistiques */}
      {showStats && (
        <div className="stats-bar">
          <div className="stat-item" title="Total">
            <span className="stat-icon">📊</span>
            <span className="stat-value">{statsDisplay.total}</span>
          </div>
          <div className="stat-item" title="Actifs">
            <span className="stat-icon">🟢</span>
            <span className="stat-value">{statsDisplay.active}</span>
          </div>
          <div className="stat-item" title="Inactifs">
            <span className="stat-icon">🟡</span>
            <span className="stat-value">{statsDisplay.idle}</span>
          </div>
          <div className="stat-item" title="Hors ligne">
            <span className="stat-icon">⚫</span>
            <span className="stat-value">{statsDisplay.offline}</span>
          </div>
          <div className="stat-item" title="Bloqués">
            <span className="stat-icon">🔒</span>
            <span className="stat-value">{statsDisplay.blocked}</span>
          </div>
          <div className="stat-item" title="Appareils réels">
            <span className="stat-icon">📱</span>
            <span className="stat-value">{statsDisplay.realDevices}</span>
          </div>
          <div className="stat-item" title="Temps moyen">
            <span className="stat-icon">⏱️</span>
            <span className="stat-value">{formatDuration(statsDisplay.avgSessionTime)}</span>
          </div>
        </div>
      )}

      {/* Barre d'outils */}
      {(showFilters || showSearch) && (
        <div className="list-toolbar">
          {showSearch && (
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Rechercher un appareil..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              {searchTerm && (
                <button
                  className="clear-search"
                  onClick={() => setSearchTerm('')}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {showFilters && (
            <div className="filter-group">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="filter-select"
                title="Filtrer par statut"
              >
                <option value="all">Tous</option>
                <option value="active">🟢 Actifs</option>
                <option value="idle">🟡 Inactifs</option>
                <option value="offline">⚫ Hors ligne</option>
                <option value="blocked">🔒 Bloqués</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
                title="Trier par"
              >
                <option value="lastSeen">Dernière activité ↓</option>
                <option value="firstSeen">Première connexion ↓</option>
                <option value="model">Modèle</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Liste des appareils */}
      <div className="devices-container" style={{ maxHeight }}>
        {filteredDevices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📱</div>
            <div className="empty-message">
              {debouncedSearch || filter !== 'all'
                ? 'Aucun appareil ne correspond aux filtres'
                : 'Aucun appareil connecté'}
            </div>
          </div>
        ) : (
          filteredDevices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onBlock={handleBlockDevice}
              onUnblock={handleUnblockDevice}
              onDisconnect={handleDisconnectDevice}
              onInspect={handleInspectDevice}
              onSelect={handleDeviceSelect}
              isSelected={selectedDevice?.id === device.id}
            />
          ))
        )}
      </div>

      {/* Pied de page */}
      <div className="list-footer">
        <div className="footer-info">
          {filteredDevices.length} appareil(s) affiché(s)
        </div>
        <button className="refresh-button" onClick={refresh} title="Rafraîchir">
          🔄
        </button>
      </div>

      <style jsx>{`
        .device-list {
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          overflow: hidden;
          color: #d4d4d4;
        }

        .device-list.loading,
        .device-list.error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
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

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
        }

        .list-title {
          margin: 0;
          font-size: 14px;
          color: #007bff;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }

        .live-dot {
          animation: pulse 2s infinite;
        }

        .live-text {
          color: #4caf50;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .stats-bar {
          display: flex;
          gap: 12px;
          padding: 8px 16px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
          flex-wrap: wrap;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          padding: 2px 8px;
          background: #2d2d2d;
          border-radius: 4px;
        }

        .stat-icon {
          font-size: 12px;
        }

        .stat-value {
          font-weight: bold;
        }

        .list-toolbar {
          padding: 8px 12px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .search-box {
          flex: 1;
          position: relative;
          min-width: 200px;
        }

        .search-icon {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: #888;
          font-size: 12px;
        }

        .search-input {
          width: 100%;
          padding: 6px 8px 6px 30px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .clear-search {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 2px 4px;
        }

        .filter-group {
          display: flex;
          gap: 4px;
        }

        .filter-select {
          padding: 6px 8px;
          background: #1e1e1e;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          font-size: 12px;
        }

        .devices-container {
          overflow-y: auto;
          padding: 8px;
        }

        @media (max-width: 768px) {
          .list-toolbar {
            flex-direction: column;
          }

          .filter-group {
            width: 100%;
          }

          .filter-select {
            flex: 1;
          }

          .stats-bar {
            gap: 6px;
          }
        }

        .device-card {
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 6px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .device-card:hover {
          background: #3e3e3e;
          border-color: #505050;
        }

        .device-card.selected {
          border-color: #007bff;
          background: #1e3a5f;
        }

        .device-card.active {
          border-left: 3px solid #4caf50;
        }

        .device-card.idle {
          border-left: 3px solid #ffd93e;
        }

        .device-card.offline {
          border-left: 3px solid #888;
        }

        .device-card.blocked {
          border-left: 3px solid #f44336;
          opacity: 0.7;
        }

        .device-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
        }

        .device-icon {
          font-size: 24px;
        }

        .device-info {
          flex: 1;
        }

        .device-name {
          font-weight: bold;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .real-device-badge {
          font-size: 12px;
        }

        .device-meta {
          display: flex;
          gap: 12px;
          font-size: 11px;
        }

        .status-badge {
          padding: 2px 6px;
          border-radius: 3px;
          background: #1e1e1e;
        }

        .status-badge.active {
          color: #4caf50;
        }

        .status-badge.idle {
          color: #ffd93e;
        }

        .status-badge.offline {
          color: #888;
        }

        .status-badge.blocked {
          color: #f44336;
        }

        .device-version {
          color: #888;
        }

        .expand-button {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
        }

        .expand-button:hover {
          color: #fff;
        }

        .device-details {
          padding: 12px;
          border-top: 1px solid #3e3e3e;
          background: #1e1e1e;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .detail-label {
          font-size: 10px;
          color: #888;
        }

        .detail-value {
          font-size: 11px;
          color: #d4d4d4;
        }

        .detail-section {
          margin-bottom: 12px;
        }

        .user-agent {
          font-family: monospace;
          font-size: 10px;
          word-break: break-word;
        }

        .metadata {
          font-size: 10px;
          background: #1a1a1a;
          padding: 4px;
          border-radius: 4px;
          margin: 4px 0 0 0;
          overflow-x: auto;
        }

        .device-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        }

        .action-button.inspect {
          background: #2196f3;
          color: white;
        }

        .action-button.inspect:hover {
          background: #1976d2;
        }

        .action-button.disconnect {
          background: #ff9800;
          color: white;
        }

        .action-button.disconnect:hover {
          background: #f57c00;
        }

        .action-button.block {
          background: #f44336;
          color: white;
        }

        .action-button.block:hover {
          background: #d32f2f;
        }

        .action-button.unblock {
          background: #4caf50;
          color: white;
        }

        .action-button.unblock:hover {
          background: #388e3c;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #888;
          gap: 16px;
        }

        .empty-icon {
          font-size: 48px;
        }

        .list-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #2d2d2d;
          border-top: 1px solid #3e3e3e;
        }

        .footer-info {
          font-size: 11px;
          color: #888;
        }

        .refresh-button {
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 4px;
        }

        .refresh-button:hover {
          color: #fff;
        }

        .error-icon {
          font-size: 32px;
          margin-bottom: 12px;
        }

        .error-message {
          color: #f48771;
          margin-bottom: 16px;
        }

        .retry-button {
          padding: 8px 16px;
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

export default DeviceList
