/**
 * Point d'entrée principal du module Runner
 * Exporte toutes les fonctionnalités publiques
 */

// Exporter la classe principale
export { AppRunner, appRunner } from '../runtime/appRunner';

// Exporter les hooks
export { useAppRunner } from './hooks/useAppRunner';

// Exporter les constantes
export { PROJECT_TYPES, DEFAULT_PORTS, I18N } from './core/constants';
export { RUNNER_EVENTS } from './core/events';

// Exporter les composants UI
export { DebugPanel } from './ui/DebugPanel';
export { DebugButton } from './ui/DebugButton';
export { LogsViewer } from './ui/LogsViewer';
export { StatsViewer } from './ui/StatsViewer';
export { EnvironmentPanel } from './ui/EnvironmentPanel';

// Exporter les composants d'erreur
export { ErrorBoundary } from './errors/ErrorBoundary';
export { SuggestionEngine } from './errors/SuggestionEngine';

// Exporter les sous-systèmes pour usage avancé
export { SandboxedRunner } from './sandbox/SandboxedRunner';
export { APIBridge } from './sandbox/APIBridge';
export { ConsoleCapture } from './sandbox/ConsoleCapture';

export { PerformanceMonitor } from './performance/PerformanceMonitor';
export { MetricsCollector } from './performance/MetricsCollector';

export { EnvironmentManager } from './environment/EnvironmentManager';
export { VariableManager } from './environment/VariableManager';
export { FeatureFlags } from './environment/FeatureFlags';

export { HotReloader } from './hotreload/HotReloader';
export { FileWatcher } from './hotreload/FileWatcher';
export { CSSStrategy } from './hotreload/strategies/CSSStrategy';
export { JSStrategy } from './hotreload/strategies/JSStrategy';
export { HTMLStrategy } from './hotreload/strategies/HTMLStrategy';

export { DependencyInstaller } from './dependencies/DependencyInstaller';
export { CDNLoader } from './dependencies/CDNLoader';
export { PackageAnalyzer } from './dependencies/PackageAnalyzer';

// Version du module
export const VERSION = '1.0.0';
