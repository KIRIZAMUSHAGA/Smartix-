/**
 * InstallInstructions - Instructions d'installation pour Android
 * 
 * Rôle: Afficher les instructions pas à pas pour l'installation
 * - Étapes adaptées à la version Android
 * - Captures d'écran illustratives (optionnel)
 * - Liens vers les paramètres
 * - Progression en temps réel
 * - Support multi-langues
 * - Accessibilité
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { installHelper } from '../services/installHelper'

// =============================
// CONSTANTES
// =============================

const STEP_ICONS = {
  'enable_unknown_sources': '🔓',
  'allow_browser_install': '🌐',
  'download_apk': '📥',
  'open_apk': '📂',
  'confirm_install': '✅',
  'complete': '🎉'
}

const STEP_TITLES = {
  'fr': {
    'enable_unknown_sources': 'Activer les sources inconnues',
    'allow_browser_install': 'Autoriser l\'installation depuis le navigateur',
    'download_apk': 'Télécharger l\'APK',
    'open_apk': 'Ouvrir le fichier APK',
    'confirm_install': 'Confirmer l\'installation',
    'complete': 'Installation terminée'
  },
  'en': {
    'enable_unknown_sources': 'Enable unknown sources',
    'allow_browser_install': 'Allow installation from browser',
    'download_apk': 'Download APK',
    'open_apk': 'Open APK file',
    'confirm_install': 'Confirm installation',
    'complete': 'Installation complete'
  }
}

const STEP_TIPS = {
  'fr': {
    'enable_unknown_sources': 'Cette option permet d\'installer des applications en dehors du Play Store',
    'allow_browser_install': 'Autorisez votre navigateur à installer des applications',
    'download_apk': 'Le téléchargement peut prendre quelques secondes',
    'open_apk': 'Une fois téléchargé, ouvrez le fichier depuis les notifications',
    'confirm_install': 'Appuyez sur "Installer" puis sur "Ouvrir"'
  },
  'en': {
    'enable_unknown_sources': 'This allows installing apps from outside the Play Store',
    'allow_browser_install': 'Allow your browser to install apps',
    'download_apk': 'Download may take a few seconds',
    'open_apk': 'Once downloaded, open the file from notifications',
    'confirm_install': 'Tap "Install" then "Open"'
  }
}

// =============================
// SOUS-COMPOSANT : StepCard
// =============================

const StepCard = ({
  step,
  index,
  isActive,
  isCompleted,
  isLast,
  onAction,
  onToggle,
  showImages = true,
  language = 'fr',
  apkUrl
}) => {
  const [expanded, setExpanded] = useState(isActive)
  const cardRef = useRef(null)

  useEffect(() => {
    setExpanded(isActive)
  }, [isActive])

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [isActive])

  const handleToggle = () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    onToggle?.(step.id, newExpanded)
  }

  const handleAction = () => {
    if (step.id === 'download_apk' && apkUrl) {
      window.open(apkUrl, '_blank', 'noopener,noreferrer')
    }
    onAction?.(step.id)
  }

  const getStepStatusIcon = () => {
    if (isCompleted) return '✅'
    if (isActive) return '🟢'
    return '⚪'
  }

  return (
    <div 
      ref={cardRef}
      className={`step-card ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
      data-step-id={step.id}
      role="region"
      aria-label={`Étape ${index + 1}: ${step.title}`}
    >
      <div 
        className="step-header" 
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle()
          }
        }}
      >
        <div className="step-status-icon" aria-hidden="true">
          {getStepStatusIcon()}
        </div>
        <div className="step-icon" aria-hidden="true">
          {isCompleted ? '✅' : STEP_ICONS[step.id] || '📌'}
        </div>
        <div className="step-info">
          <div className="step-title">
            Étape {index + 1} : {step.title}
          </div>
          <div className="step-description">{step.description}</div>
        </div>
        <div className="step-expand" aria-hidden="true">
          {expanded ? '▼' : '▶'}
        </div>
      </div>

      {expanded && (
        <div className="step-details">
          {/* Astuce */}
          {STEP_TIPS[language]?.[step.id] && (
            <div className="step-tip">
              <span className="tip-icon">💡</span>
              <span className="tip-text">{STEP_TIPS[language][step.id]}</span>
            </div>
          )}

          {/* Détails supplémentaires */}
          {step.details && (
            <div className="step-details-text">{step.details}</div>
          )}

          {/* Capture d'écran illustrative */}
          {showImages && step.image && (
            <div className="step-image">
              <img 
                src={step.image} 
                alt={`Étape ${index + 1}`}
                loading="lazy"
              />
            </div>
          )}

          {/* Actions */}
          {step.action && !isCompleted && (
            <div className="step-actions">
              <button
                className="step-action-button"
                onClick={handleAction}
                aria-label={`Effectuer l'étape ${index + 1}`}
              >
                {step.actionLabel || (step.id === 'download_apk' ? '📥 Télécharger' : step.actionLabel)}
              </button>
            </div>
          )}

          {/* Statut */}
          {isCompleted && (
            <div className="step-completed-badge" role="status">
              <span aria-hidden="true">✓</span> Étape complétée
            </div>
          )}
        </div>
      )}

      {!isLast && !isCompleted && (
        <div className="step-connector" aria-hidden="true" />
      )}

      <style jsx>{`
        .step-card {
          margin-bottom: 8px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 6px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .step-card.completed {
          opacity: 0.8;
          border-left: 3px solid #4caf50;
        }

        .step-card.active {
          border-left: 3px solid #007bff;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          background: #1e1e1e;
          outline: none;
        }

        .step-header:hover,
        .step-header:focus-visible {
          background: #2d2d2d;
        }

        .step-header:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: -2px;
        }

        .step-status-icon {
          font-size: 12px;
          min-width: 20px;
          text-align: center;
        }

        .step-icon {
          font-size: 20px;
          min-width: 32px;
          text-align: center;
        }

        .step-info {
          flex: 1;
        }

        .step-title {
          font-weight: bold;
          color: #d4d4d4;
          margin-bottom: 4px;
        }

        .step-description {
          font-size: 12px;
          color: #888;
        }

        .step-expand {
          color: #888;
          font-size: 12px;
        }

        .step-details {
          padding: 16px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
        }

        .step-tip {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding: 8px;
          background: #1e3a5f;
          border-radius: 4px;
          font-size: 12px;
        }

        .tip-icon {
          font-size: 14px;
        }

        .tip-text {
          color: #d4d4d4;
        }

        .step-details-text {
          font-size: 13px;
          color: #d4d4d4;
          margin-bottom: 12px;
        }

        .step-image {
          margin: 12px 0;
          text-align: center;
        }

        .step-image img {
          max-width: 100%;
          max-height: 200px;
          border-radius: 4px;
          border: 1px solid #3e3e3e;
        }

        .step-actions {
          margin-top: 12px;
        }

        .step-action-button {
          padding: 8px 16px;
          background: #007bff;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .step-action-button:hover {
          background: #0056b3;
        }

        .step-action-button:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }

        .step-completed-badge {
          margin-top: 12px;
          padding: 6px 12px;
          background: #1e3a5f;
          border-radius: 4px;
          color: #4caf50;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .step-connector {
          height: 20px;
          width: 2px;
          background: #3e3e3e;
          margin-left: 28px;
        }
      `}</style>
    </div>
  )
}

// =============================
// COMPOSANT PRINCIPAL
// =============================

export const InstallInstructions = ({
  sessionId,
  steps: externalSteps,
  apkUrl,
  currentStep = 0,
  onStepComplete,
  onStepAction,
  onAllComplete,
  language = 'fr',
  showProgress = true,
  showImages = true,
  showStepper = true,
  className = ''
}) => {
  const [internalSteps, setInternalSteps] = useState([])
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [activeStep, setActiveStep] = useState(null)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [androidVersion, setAndroidVersion] = useState(null)

  // =============================
  // CHARGEMENT DES INSTRUCTIONS
  // =============================

  useEffect(() => {
    const loadInstructions = async () => {
      if (!sessionId && !externalSteps) return

      setLoading(true)
      try {
        const info = installHelper.detectPlatform(navigator.userAgent)
        setDeviceInfo(info)
        setAndroidVersion(parseFloat(info.androidVersion || '0'))

        if (externalSteps) {
          setInternalSteps(externalSteps)
        } else {
          const steps = await installHelper.getInstallInstructions(sessionId, { language })
          
          // Filtrer les étapes selon la version Android
          let filteredSteps = steps
          if (info.androidVersion) {
            const version = parseFloat(info.androidVersion)
            if (version < 8) {
              filteredSteps = steps.filter(s => s.id !== 'allow_browser_install')
            } else {
              filteredSteps = steps.filter(s => s.id !== 'enable_unknown_sources')
            }
          }
          
          setInternalSteps(filteredSteps)
        }
      } catch (error) {
        console.error('Erreur chargement instructions:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInstructions()
  }, [sessionId, externalSteps, language])

  // =============================
  // GESTIONNAIRES
  // =============================

  const handleStepComplete = useCallback(async (stepId) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev)
      newSet.add(stepId)

      if (newSet.size === internalSteps.length) {
        onAllComplete?.()
      }

      return newSet
    })

    if (sessionId) {
      await installHelper.updateInstallStep(sessionId, stepId, true)
    }

    onStepComplete?.(stepId)
  }, [sessionId, internalSteps.length, onStepComplete, onAllComplete])

  const handleStepAction = useCallback(async (stepId) => {
    if (stepId === 'enable_unknown_sources' || stepId === 'allow_browser_install') {
      await installHelper.openAndroidSettings()
    }

    onStepAction?.(stepId)
  }, [onStepAction])

  const handleStepToggle = useCallback((stepId, expanded) => {
    setActiveStep(expanded ? stepId : null)
  }, [])

  const handleOpenApp = useCallback(() => {
    if (deviceInfo?.isAndroid) {
      // Tenter d'ouvrir via deep link si disponible
      window.location.href = 'intent://#Intent;package=com.vibecoding.app;end'
    }
  }, [deviceInfo])

  // =============================
  // ÉTAPES AVEC STATUTS
  // =============================

  const stepsWithStatus = useMemo(() => {
    return internalSteps.map((step, index) => ({
      ...step,
      title: STEP_TITLES[language]?.[step.id] || step.title,
      isCompleted: completedSteps.has(step.id),
      isActive: activeStep === step.id || index === currentStep,
      index
    }))
  }, [internalSteps, completedSteps, activeStep, currentStep, language])

  const progress = useMemo(() => {
    if (stepsWithStatus.length === 0) return 0
    return (completedSteps.size / stepsWithStatus.length) * 100
  }, [stepsWithStatus.length, completedSteps.size])

  // =============================
  // RENDU
  // =============================

  if (loading) {
    return (
      <div className={`install-instructions loading ${className}`}>
        <div className="spinner" />
        <div>Chargement des instructions...</div>
        <style jsx>{`
          .install-instructions.loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            background: #2d2d2d;
            border-radius: 8px;
            color: #888;
            gap: 16px;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #3e3e3e;
            border-top-color: #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (internalSteps.length === 0) {
    return (
      <div className={`install-instructions empty ${className}`}>
        <div className="empty-icon">📋</div>
        <div className="empty-message">Aucune instruction disponible</div>
        <style jsx>{`
          .install-instructions.empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            background: #2d2d2d;
            border-radius: 8px;
            color: #888;
            gap: 16px;
          }

          .empty-icon {
            font-size: 48px;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`install-instructions ${className}`}>
      {/* En-tête */}
      <div className="instructions-header">
        <h3 className="instructions-title">
          📲 Installation sur {deviceInfo?.androidName || 'Android'}
        </h3>
        <div className="device-info">
          {deviceInfo?.androidVersion && (
            <span className="device-version">
              Version {deviceInfo.androidVersion}
            </span>
          )}
          {androidVersion !== null && (
            <span className="device-category">
              {androidVersion < 8 ? '🔓 Sources inconnues' : '🌐 Installation par application'}
            </span>
          )}
        </div>
      </div>

      {/* Stepper */}
      {showStepper && (
        <div className="step-indicator" role="list" aria-label="Progression des étapes">
          {stepsWithStatus.map((step, index) => (
            <div
              key={step.id}
              className={`step-dot ${step.isCompleted ? 'completed' : ''} ${step.isActive ? 'active' : ''}`}
              role="listitem"
              aria-label={`Étape ${index + 1}: ${step.title}`}
            >
              <span className="dot-number">{index + 1}</span>
            </div>
          ))}
        </div>
      )}

      {/* Barre de progression */}
      {showProgress && (
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
          <div 
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
          <span className="progress-text">
            {completedSteps.size}/{internalSteps.length} étapes
          </span>
        </div>
      )}

      {/* Liste des étapes */}
      <div className="steps-list">
        {stepsWithStatus.map((step, index) => (
          <StepCard
            key={step.id}
            step={step}
            index={index}
            isActive={step.isActive}
            isCompleted={step.isCompleted}
            isLast={index === stepsWithStatus.length - 1}
            onAction={handleStepAction}
            onToggle={handleStepToggle}
            showImages={showImages}
            language={language}
            apkUrl={apkUrl}
          />
        ))}
      </div>

      {/* Actions globales */}
      <div className="instructions-footer">
        {completedSteps.size === internalSteps.length ? (
          <div className="completion-message">
            <span className="completion-icon" aria-hidden="true">🎉</span>
            <span className="completion-text">
              Installation terminée !
            </span>
            <button
              className="open-app-button"
              onClick={handleOpenApp}
              aria-label="Ouvrir l'application"
            >
              🚀 Ouvrir l'application
            </button>
          </div>
        ) : (
          <button
            className="reset-button"
            onClick={() => {
              setCompletedSteps(new Set())
              setActiveStep(internalSteps[0]?.id)
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <style jsx>{`
        .install-instructions {
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 8px;
          overflow: hidden;
          color: #d4d4d4;
        }

        .instructions-header {
          padding: 16px;
          background: #1e1e1e;
          border-bottom: 1px solid #3e3e3e;
        }

        .instructions-title {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #007bff;
        }

        .device-info {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .device-version {
          font-size: 12px;
          color: #888;
        }

        .device-category {
          font-size: 12px;
          padding: 2px 6px;
          background: #2d2d2d;
          border-radius: 4px;
          color: #9cdcfe;
        }

        .step-indicator {
          display: flex;
          justify-content: space-between;
          padding: 16px 16px 0 16px;
        }

        .step-dot {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: #2d2d2d;
          border: 2px solid #3e3e3e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          position: relative;
        }

        .step-dot.completed {
          background: #4caf50;
          border-color: #388e3c;
          color: white;
        }

        .step-dot.active {
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0,123,255,0.3);
        }

        .dot-number {
          line-height: 1;
        }

        .progress-bar {
          position: relative;
          height: 4px;
          background: #1e1e1e;
          margin: 16px;
          overflow: visible;
          border-radius: 2px;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
          border-radius: 2px;
        }

            .progress-text {
          position: absolute;
          right: 0;
          top: 8px;
          font-size: 11px;
          color: #888;
        }

        .steps-list {
          padding: 16px;
        }

        .instructions-footer {
          padding: 16px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
        }

        .completion-message {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #1e3a5f;
          border-radius: 6px;
          flex-wrap: wrap;
        }

        .completion-icon {
          font-size: 24px;
        }

        .completion-text {
          flex: 1;
          color: #d4d4d4;
        }

        .open-app-button {
          padding: 6px 12px;
          background: #4caf50;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }

        .open-app-button:hover {
          background: #388e3c;
        }

        .open-app-button:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }

        .reset-button {
          padding: 8px 16px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .reset-button:hover {
          background: #3e3e3e;
        }

        .reset-button:focus-visible {
          outline: 2px solid #007bff;
          outline-offset: 2px;
        }

        @media (max-width: 768px) {
          .completion-message {
            flex-direction: column;
            text-align: center;
          }

          .open-app-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

export default InstallInstructions
         
