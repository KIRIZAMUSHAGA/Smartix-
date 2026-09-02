/**
 * useAndroidInstall - Hook React pour l'installation Android
 * 
 * Rôle: Interface React pour le module androidInstaller
 * - Génération de lien d'installation
 * - Tracking des téléchargements
 * - Suivi de progression
 * - Gestion des erreurs
 * - Auto-expiration
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { androidInstaller } from '../core/androidInstaller'
import { installHelper } from '../services/installHelper'
import { logger } from '../utils/logger'

// =============================
// CONSTANTES
// =============================

const INSTALL_STEPS = {
  IDLE: 'idle',
  GENERATING: 'generating',
  READY: 'ready',
  DOWNLOADING: 'downloading',
  INSTALLING: 'installing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
  UNSUPPORTED: 'unsupported'
}

const PROGRESS_STEPS = {
  [INSTALL_STEPS.GENERATING]: 10,
  [INSTALL_STEPS.READY]: 25,
  [INSTALL_STEPS.DOWNLOADING]: 50,
  [INSTALL_STEPS.INSTALLING]: 75,
  [INSTALL_STEPS.COMPLETED]: 100
}

// =============================
// HOOK PRINCIPAL
// =============================

export const useAndroidInstall = (projectId, options = {}) => {
  const {
    autoGenerate = true,
    version = '1.0.0',
    environment = 'development',
    onProgress,
    onComplete,
    onError,
    language = 'fr'
  } = options

  const [state, setState] = useState({
    status: INSTALL_STEPS.IDLE,
    sessionId: null,
    downloadUrl: null,
    qrCode: null,
    expiresAt: null,
    buildInfo: null,
    progress: 0,
    error: null
  })

  const [installSession, setInstallSession] = useState(null)
  const [steps, setSteps] = useState([])
  const [currentStep, setCurrentStep] = useState(0)
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [capability, setCapability] = useState(null)
  
  const mountedRef = useRef(true)
  const pollingRef = useRef(null)
  const expirationTimerRef = useRef(null)

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current)
      }
    }
  }, [])

  // Détection de la plateforme
  useEffect(() => {
    const detectPlatform = async () => {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
      const info = installHelper.detectPlatform(userAgent)
      
      if (mountedRef.current) {
        setDeviceInfo(info)
        
        // Vérifier la capacité d'installation
        const caps = await installHelper.checkInstallCapability({ userAgent })
        setCapability(caps)
      }
    }
    detectPlatform()
  }, [])

  // Gestion des événements androidInstaller
  useEffect(() => {
    if (!state.sessionId) return

    const handleDownload = ({ sessionId }) => {
      if (sessionId !== state.sessionId || !mountedRef.current) return

      setState(prev => ({ 
        ...prev, 
        status: INSTALL_STEPS.DOWNLOADING,
        progress: PROGRESS_STEPS[INSTALL_STEPS.DOWNLOADING]
      }))
      setCurrentStep(1)
      onProgress?.({ 
        step: INSTALL_STEPS.DOWNLOADING, 
        progress: PROGRESS_STEPS[INSTALL_STEPS.DOWNLOADING] 
      })
    }

    const handleInstall = ({ sessionId }) => {
      if (sessionId !== state.sessionId || !mountedRef.current) return

      setState(prev => ({ 
        ...prev, 
        status: INSTALL_STEPS.INSTALLING,
        progress: PROGRESS_STEPS[INSTALL_STEPS.INSTALLING]
      }))
      setCurrentStep(2)
      onProgress?.({ 
        step: INSTALL_STEPS.INSTALLING, 
        progress: PROGRESS_STEPS[INSTALL_STEPS.INSTALLING] 
      })
    }

    const handleComplete = ({ sessionId }) => {
      if (sessionId !== state.sessionId || !mountedRef.current) return

      setState(prev => ({ 
        ...prev, 
        status: INSTALL_STEPS.COMPLETED,
        progress: PROGRESS_STEPS[INSTALL_STEPS.COMPLETED]
      }))
      setCurrentStep(3)
      onProgress?.({ 
        step: INSTALL_STEPS.COMPLETED, 
        progress: PROGRESS_STEPS[INSTALL_STEPS.COMPLETED] 
      })
      onComplete?.({ sessionId })
    }

    androidInstaller.on('download', handleDownload)
    androidInstaller.on('install', handleInstall)
    androidInstaller.on('install:completed', handleComplete)

    return () => {
      androidInstaller.off('download', handleDownload)
      androidInstaller.off('install', handleInstall)
      androidInstaller.off('install:completed', handleComplete)
    }
  }, [state.sessionId, onProgress, onComplete])

  // Gestion de l'expiration
  useEffect(() => {
    if (!state.expiresAt || state.status !== INSTALL_STEPS.READY) return

    const timeUntilExpiry = state.expiresAt - Date.now()
    
    if (timeUntilExpiry <= 0) {
      setState(prev => ({ ...prev, status: INSTALL_STEPS.EXPIRED }))
      return
    }

    expirationTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, status: INSTALL_STEPS.EXPIRED }))
      }
    }, timeUntilExpiry)

    return () => {
      if (expirationTimerRef.current) {
        clearTimeout(expirationTimerRef.current)
      }
    }
  }, [state.expiresAt, state.status])

  /**
   * Génère un lien d'installation
   */
  const generateInstallLink = useCallback(async (customOptions = {}) => {
    if (!projectId) {
      const error = new Error('projectId requis')
      setState(prev => ({ ...prev, status: INSTALL_STEPS.FAILED, error }))
      onError?.(error)
      return
    }

    // Vérifier la capacité d'installation
    if (capability && !capability.canInstall) {
      setState(prev => ({ 
        ...prev, 
        status: INSTALL_STEPS.UNSUPPORTED,
        error: 'Installation non supportée sur cette plateforme'
      }))
      return
    }

    try {
      setState(prev => ({ 
        ...prev, 
        status: INSTALL_STEPS.GENERATING,
        progress: PROGRESS_STEPS[INSTALL_STEPS.GENERATING],
        error: null 
      }))

      onProgress?.({ 
        step: INSTALL_STEPS.GENERATING, 
        progress: PROGRESS_STEPS[INSTALL_STEPS.GENERATING] 
      })

      const result = await androidInstaller.generateInstallLink(projectId, {
        version,
        environment,
        ...customOptions
      })

      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        status: INSTALL_STEPS.READY,
        sessionId: result.sessionId,
        downloadUrl: result.downloadUrl,
        qrCode: result.qrCode,
        expiresAt: result.expiresAt,
        buildInfo: result.buildInfo,
        progress: PROGRESS_STEPS[INSTALL_STEPS.READY]
      }))

      onProgress?.({ 
        step: INSTALL_STEPS.READY, 
        progress: PROGRESS_STEPS[INSTALL_STEPS.READY] 
      })

      // Créer une session d'installation helper
      if (deviceInfo) {
        const session = installHelper.createInstallSession(result.sessionId, {
          userAgent: navigator.userAgent || '',
          platform: deviceInfo?.platform,
          model: deviceInfo?.model
        })
        setInstallSession(session)

        // Générer les instructions
        const instructions = installHelper.getInstallInstructions(result.sessionId, {
          language
        })
        setSteps(instructions)
      }

    } catch (error) {
      if (!mountedRef.current) return

      setState(prev => ({
        ...prev,
        status: INSTALL_STEPS.FAILED,
        error: error.message
      }))

      logger.error('Erreur génération installation', error)
      onError?.(error)
    }
  }, [projectId, version, environment, deviceInfo, capability, language, onProgress, onError])

  /**
   * Régénère un lien d'installation (reset + generate)
   */
  const regenerateInstallLink = useCallback(async (customOptions = {}) => {
    reset()
    await generateInstallLink(customOptions)
  }, [generateInstallLink])

  /**
   * Enregistre un téléchargement
   */
  const trackDownload = useCallback(async (deviceInfo = {}) => {
    if (!state.sessionId) {
      throw new Error('Aucune session active')
    }

    try {
      await androidInstaller.trackDownload(state.sessionId, {
        deviceId: deviceInfo.deviceId,
        model: deviceInfo.model || 'unknown',
        platform: deviceInfo.platform || deviceInfo?.platform || 'android',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        ...deviceInfo
      })

      // Mettre à jour l'étape dans installHelper
      if (installSession) {
        await installHelper.updateInstallStep(state.sessionId, 'download_apk', true)
      }

      setCurrentStep(1)

    } catch (error) {
      logger.error('Erreur tracking téléchargement', error)
      throw error
    }
  }, [state.sessionId, installSession])

  /**
   * Enregistre une installation
   */
  const trackInstall = useCallback(async (deviceInfo = {}) => {
    if (!state.sessionId) {
      throw new Error('Aucune session active')
    }

    try {
      await androidInstaller.trackInstall(state.sessionId, {
        deviceId: deviceInfo.deviceId,
        model: deviceInfo.model || 'unknown',
        platform: deviceInfo.platform || deviceInfo?.platform || 'android',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        ...deviceInfo
      })

      // Mettre à jour l'étape dans installHelper
      if (installSession) {
        await installHelper.updateInstallStep(state.sessionId, 'confirm_install', true)
        await installHelper.updateInstallStep(state.sessionId, 'complete', true)
      }

      setCurrentStep(3)

    } catch (error) {
      logger.error('Erreur tracking installation', error)
      throw error
    }
  }, [state.sessionId, installSession])

  /**
   * Met à jour une étape d'installation
   */
  const updateStep = useCallback(async (stepId, completed = true) => {
    if (!state.sessionId || !installSession) return

    try {
      await installHelper.updateInstallStep(state.sessionId, stepId, completed)
      
      // Recharger les instructions
      const instructions = installHelper.getInstallInstructions(state.sessionId, {
        language
      })
      setSteps(instructions)

      // Mettre à jour l'étape courante
      const stepIndex = instructions.findIndex(s => s.id === stepId)
      if (stepIndex !== -1 && completed) {
        setCurrentStep(stepIndex + 1)
      }

    } catch (error) {
      logger.error('Erreur mise à jour étape', error)
    }
  }, [state.sessionId, installSession, language])

  /**
   * Vérifie la capacité d'installation
   */
  const checkCapability = useCallback(async () => {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    return installHelper.checkInstallCapability({ userAgent })
  }, [])

  /**
   * Ouvre les paramètres Android
   */
  const openAndroidSettings = useCallback(async () => {
    return installHelper.openAndroidSettings()
  }, [])

  /**
   * Réinitialise l'état
   */
  const reset = useCallback(() => {
    setState({
      status: INSTALL_STEPS.IDLE,
      sessionId: null,
      downloadUrl: null,
      qrCode: null,
      expiresAt: null,
      buildInfo: null,
      progress: 0,
      error: null
    })
    setInstallSession(null)
    setSteps([])
    setCurrentStep(0)
  }, [])

  // Calcul du temps restant
  const expiresIn = state.expiresAt 
    ? Math.max(0, state.expiresAt - Date.now())
    : null

  return {
    // État
    state,
    steps,
    currentStep,
    deviceInfo,
    capability,
    
    // Statuts
    isIdle: state.status === INSTALL_STEPS.IDLE,
    isGenerating: state.status === INSTALL_STEPS.GENERATING,
    isReady: state.status === INSTALL_STEPS.READY,
    isDownloading: state.status === INSTALL_STEPS.DOWNLOADING,
    isInstalling: state.status === INSTALL_STEPS.INSTALLING,
    isCompleted: state.status === INSTALL_STEPS.COMPLETED,
    isFailed: state.status === INSTALL_STEPS.FAILED,
    isExpired: state.status === INSTALL_STEPS.EXPIRED,
    isUnsupported: state.status === INSTALL_STEPS.UNSUPPORTED,

    // Données
    downloadUrl: state.downloadUrl,
    qrCode: state.qrCode,
    sessionId: state.sessionId,
    error: state.error,
    progress: state.progress,
    expiresIn,
    buildInfo: state.buildInfo,

    // Actions
    generateInstallLink,
    regenerateInstallLink,
    trackDownload,
    trackInstall,
    updateStep,
    checkCapability,
    openAndroidSettings,
    reset,

    // Utilitaires
    canInstall: capability?.canInstall || false,
    requiresPermission: capability?.requiresPermission || false
  }
}

export default useAndroidInstall
