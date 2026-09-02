/**
 * Preview Component - Aperçu de l'application avec support multi-ports
 * Version professionnelle avec source de vérité unique et détection automatique
 */

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, Globe, Settings, ExternalLink, 
  RefreshCw, Loader2, Play, Maximize2, AlertCircle,
  Smartphone, Tablet, Monitor, Wifi, WifiOff
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Card } from '../../components/ui/card'
import { Progress } from '../../components/ui/progress'
import { Badge } from '../../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {

  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu'
import PropTypes from 'prop-types';

// =============================
// CONSTANTES
// =============================

const DEVICE_MODES = {
  DESKTOP: { width: '100%', height: '100%', icon: Monitor, label: 'Desktop' },
  TABLET: { width: '768px', height: '1024px', icon: Tablet, label: 'Tablette' },
  MOBILE: { width: '375px', height: '667px', icon: Smartphone, label: 'Mobile' }
}

// =============================
// ÉTATS DE LA PREVIEW
// =============================

const NotRunningState = () => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md p-8">
      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
        <Play className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold mb-3">Application non lancée</h3>
      <p className="text-muted-foreground mb-6">
        ▶️ Cliquez sur <span className="font-bold text-green-400">Run</span> dans la barre du bas pour voir le résultat de votre application
      </p>
      <div className="text-sm text-muted-foreground/50">
        Le serveur de développement démarrera automatiquement
      </div>
    </div>
  </div>
)

const LoadingState = ({ progress }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md p-8">
      <div className="relative mb-8">
        <div className="w-20 h-20 border-4 border-muted border-t-purple-500 rounded-full animate-spin mx-auto" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{progress}%</span>
        </div>
      </div>
      <h3 className="text-xl font-bold mb-3">Le workspace se charge...</h3>
      <p className="text-muted-foreground mb-4">
        Préparation de l'environnement de développement
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Installation des dépendances</span>
          <span className="text-green-400">✓</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Compilation du code</span>
          <span className="text-green-400">✓</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Démarrage du serveur</span>
          <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
        </div>
      </div>
    </div>
  </div>
)

const ErrorState = ({ error, onRetry }) => (
  <div className="h-full flex items-center justify-center">
    <div className="text-center max-w-md p-8">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-xl font-bold mb-3">Erreur de chargement</h3>
      <p className="text-muted-foreground mb-4">
        {error || "Impossible de charger l'application"}
      </p>
      <Button onClick={onRetry} variant="outline">
        Réessayer
      </Button>
    </div>
  </div>
)

// =============================
// COMPOSANT PRINCIPAL
// =============================

const Preview = ({ 
  // États principaux
  isRunning, 
  building, 
  buildProgress, 
  ports,
  currentPort,
  previewUrls,
  onPortChange,
  
  // Actions
  onRefresh,
  onOpenExternal,
  onPublish,
  onBack,
  onFullscreen,
  
  // Données externes
  externalUrl = null,
  error = null,
  onRetry,
  
  // Logs pour détection auto
  logs = []
}) => {
  const [showPortSettings, setShowPortSettings] = useState(false)
  const [deviceMode, setDeviceMode] = useState('DESKTOP')
  const [portHealth, setPortHealth] = useState({})

  // =============================
  // DÉTECTION AUTO DES PORTS DEPUIS LES LOGS
  // =============================
  useEffect(() => {
    logs.forEach(log => {
      const portMatch = log.message?.match(/port[:\s]*(\d+)/i)
      if (portMatch) {
        const port = parseInt(portMatch[1])
        if (port && !ports.includes(port)) {
          onPortChange?.(port, 'detected')
        }
      }
    })
  }, [logs, ports, onPortChange])

  // =============================
  // HEALTH CHECK DES PORTS
  // =============================
  useEffect(() => {
    const checkPortHealth = async () => {
      const health = {}
      for (const port of ports) {
        try {
          const response = await fetch(`http://localhost:${port}/health`, { 
            method: 'HEAD',
            mode: 'no-cors'
          })
          health[port] = 'online'
        } catch {
          health[port] = 'offline'
        }
      }
      setPortHealth(health)
    }

    if (isRunning) {
      const interval = setInterval(checkPortHealth, 10000)
      checkPortHealth()
      return () => clearInterval(interval)
    }
  }, [ports, isRunning])

  // URL active
  const previewUrl = previewUrls?.[currentPort] || `http://localhost:${currentPort}`
  const DeviceIcon = DEVICE_MODES[deviceMode].icon

  // Déterminer l'état du contenu
  const renderContent = () => {
    if (error) {
      return <ErrorState error={error} onRetry={onRetry} />
    }
    
    if (building) {
      return <LoadingState progress={buildProgress} />
    }
    
    if (!isRunning) {
      return <NotRunningState />
    }

    // Cas spécial: running mais pas encore d'URL
    if (isRunning && !previewUrl) {
      return <LoadingState progress={90} />
    }
    
    // Health check
    const isPortHealthy = portHealth[currentPort] === 'online'
    
    return (
      <div className="relative h-full">
        {/* Indicateur de santé du port */}
        {isRunning && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant={isPortHealthy ? 'default' : 'destructive'} className="gap-1">
              {isPortHealthy ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              Port {currentPort} {isPortHealthy ? 'actif' : 'inactif'}
            </Badge>
          </div>
        )}
        
        {/* Iframe avec dimension selon device mode */}
        <div className="h-full flex items-center justify-center bg-muted/20">
          <div 
            style={{
              width: DEVICE_MODES[deviceMode].width,
              height: DEVICE_MODES[deviceMode].height,
              transition: 'all 0.3s ease'
            }}
            className="bg-white shadow-2xl"
          >
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="Preview de l'application"
              aria-label="Preview application"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header Preview (toujours visible) */}
      <div className="border-b border-border bg-card">
        {/* Ligne 1 : Navigation principale */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              title="Retour à l'éditeur"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onPublish}
              className="gap-2"
              disabled={building}
            >
              <Globe className="w-4 h-4" />
              <span>Publish</span>
            </Button>
          </div>

          <div className="text-sm font-medium flex items-center gap-2">
            Preview
            {isRunning && <Badge variant="outline">Port {currentPort}</Badge>}
          </div>

          <div className="flex items-center gap-1">
            {/* Sélecteur de mode device */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Mode d'affichage">
                  <DeviceIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {Object.entries(DEVICE_MODES).map(([key, mode]) => {
                  const Icon = mode.icon
                  return (
                    <DropdownMenuItem 
                      key={key}
                      onClick={() => setDeviceMode(key)}
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {mode.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (onFullscreen) {
                  onFullscreen()
                } else {
                  window.open(previewUrl, '_blank')
                }
              }}
              title="Plein écran"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>

            <Dialog open={showPortSettings} onOpenChange={setShowPortSettings}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Paramètres des ports"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Configuration des ports</DialogTitle>
                  <DialogDescription>
                    Gérez les ports sur lesquels votre application écoute
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Ports détectés */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ports détectés</label>
                    <div className="flex flex-wrap gap-2">
                      {ports.map(port => (
                        <Button
                          key={port}
                          variant={currentPort === port ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => onPortChange(port)}
                          className="min-w-[60px]"
                        >
                          {port}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ports automatiquement détectés par les logs
                    </p>
                  </div>

                  {/* URLs générées */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URLs générées</label>
                    <div className="space-y-1">
                      {ports.map(port => (
                        <div key={port} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Port {port}:</span>
                          <span className="font-mono">http://localhost:{port}</span>
                          {portHealth[port] === 'online' && (
                            <Wifi className="w-3 h-3 text-green-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPortSettings(false)}>
                    Fermer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenExternal}
              disabled={!previewUrl}
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Ligne 2 : Barre d'URL avec sélecteur de ports */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={!isRunning || building}
            title="Rafraîchir"
            className="h-8 w-8"
          >
            <RefreshCw className={`w-3 h-3 ${building ? 'animate-spin' : ''}`} />
          </Button>
          
          {/* Sélecteur de ports */}
          <Select
            value={currentPort.toString()}
            onValueChange={(value) => onPortChange(parseInt(value))}
            disabled={!isRunning || building}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue placeholder="Port" />
            </SelectTrigger>
            <SelectContent>
              {ports.map(port => (
                <SelectItem key={port} value={port.toString()}>
                  Port {port} {portHealth[port] === 'online' ? '🟢' : '⚪'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* URL */}
          <div className="flex-1 flex items-center bg-muted rounded-md px-3 py-1">
            <span className="text-xs text-muted-foreground flex-1 truncate">
              {isRunning ? previewUrl : 'Application non démarrée'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenExternal}
              disabled={!previewUrl}
              className="h-6 w-6"
              title="Ouvrir"
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Zone de contenu dynamique */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  )
}

Preview.propTypes = {
  tats: PropTypes.any.isRequired,
  principaux: PropTypes.any.isRequired,
  isRunning: PropTypes.bool.isRequired,
  building: PropTypes.any.isRequired,
  buildProgress: PropTypes.any.isRequired,
  ports: PropTypes.any.isRequired,
  currentPort: PropTypes.any.isRequired,
  previewUrls: PropTypes.any.isRequired,
  onPortChange: PropTypes.func.isRequired,
  Actions: PropTypes.array.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onOpenExternal: PropTypes.func.isRequired,
  onPublish: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  onFullscreen: PropTypes.func.isRequired,
  Donn: PropTypes.any.isRequired,
  es: PropTypes.any.isRequired,
  externes: PropTypes.any.isRequired,
  externalUrl: PropTypes.any,
  error: PropTypes.bool,
  onRetry: PropTypes.func.isRequired,
  Logs: PropTypes.array.isRequired,
  pour: PropTypes.any.isRequired,
  tection: PropTypes.any.isRequired,
  auto: PropTypes.bool.isRequired,
  logs: PropTypes.array,
};

export default Preview
NotRunningState.propTypes = {};
LoadingState.propTypes = {
  progress: PropTypes.number.isRequired,
};
ErrorState.propTypes = {
  error: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
};
