/**
 * NotificationService
 * Gère l'envoi de notifications pour les alertes
 */

import EventEmitter from 'events';

export class NotificationService extends EventEmitter {
  /**
   * Crée une instance de NotificationService
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      enableSound: options.enableSound || false,
      enableDesktop: options.enableDesktop !== false,
      enableConsole: options.enableConsole !== false,
      channels: options.channels || ['console', 'desktop'],
      ...options
    };

    this.notifications = [];
    this.maxHistory = 100;
    this.desktopPermission = false;
    
    this._initialize();
  }

  /**
   * Initialise le service
   * @private
   */
  async _initialize() {
    if (this.options.enableDesktop && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        this.desktopPermission = true;
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        this.desktopPermission = permission === 'granted';
      }
    }
  }

  /**
   * Envoie une notification
   * @param {Object} alert - Alerte à notifier
   */
  notify(alert) {
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      alert,
      channels: [],
      timestamp: Date.now(),
      read: false
    };

    // Envoyer via les canaux configurés
    this.options.channels.forEach(channel => {
      switch (channel) {
        case 'console':
          this._sendConsole(alert);
          notification.channels.push('console');
          break;
        case 'desktop':
          this._sendDesktop(alert);
          notification.channels.push('desktop');
          break;
        case 'sound':
          this._sendSound(alert);
          notification.channels.push('sound');
          break;
      }
    });

    this.notifications.push(notification);

    if (this.notifications.length > this.maxHistory) {
      this.notifications.shift();
    }

    this.emit('notification-sent', notification);
  }

  /**
   * Envoie une notification console
   * @private
   * @param {Object} alert - Alerte
   */
  _sendConsole(alert) {
    const styles = {
      critical: 'background: #dc3545; color: white; font-weight: bold;',
      high: 'background: #f48771; color: black;',
      medium: 'background: #ffd93e; color: black;',
      low: 'background: #17a2b8; color: white;',
      info: 'background: #6c757d; color: white;'
    };

    const style = styles[alert.severity] || styles.info;

    console.log(
      `%c⚠️ ALERTE ${alert.severity.toUpperCase()}`,
      style,
      `\n${alert.title}\n${alert.message}`
    );
  }

  /**
   * Envoie une notification desktop
   * @private
   * @param {Object} alert - Alerte
   */
  _sendDesktop(alert) {
    if (!this.desktopPermission) return;

    try {
      const notification = new Notification(`⚠️ ${alert.title}`, {
        body: alert.message,
        icon: this._getIcon(alert.severity),
        tag: alert.id,
        requireInteraction: alert.severity === 'critical'
      });

      notification.onclick = () => {
        window.focus();
        this.emit('notification-clicked', alert);
      };

    } catch (error) {
      console.warn('Erreur notification desktop:', error);
    }
  }

  /**
   * Joue un son de notification
   * @private
   * @param {Object} alert - Alerte
   */
  _sendSound(alert) {
    if (!this.options.enableSound) return;

    // Jouer un son selon la sévérité
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Fréquence selon sévérité
    const frequencies = {
      critical: 800,
      high: 600,
      medium: 400,
      low: 200,
      info: 100
    };

    oscillator.frequency.value = frequencies[alert.severity] || 400;
    gainNode.gain.value = 0.1;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  }

  /**
   * Obtient l'icône selon la sévérité
   * @private
   * @param {string} severity - Sévérité
   * @returns {string} URL de l'icône
   */
  _getIcon(severity) {
    const icons = {
      critical: '/icons/error.png',
      high: '/icons/warning.png',
      medium: '/icons/warning.png',
      low: '/icons/info.png',
      info: '/icons/info.png'
    };
    return icons[severity] || '/icons/alert.png';
  }

  /**
   * Marque une notification comme lue
   * @param {string} notificationId - ID de la notification
   */
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.emit('notification-read', notification);
    }
  }

  /**
   * Marque toutes les notifications comme lues
   */
  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.emit('all-notifications-read');
  }

  /**
   * Récupère les notifications non lues
   * @returns {Array} Notifications non lues
   */
  getUnread() {
    return this.notifications.filter(n => !n.read);
  }

  /**
   * Récupère l'historique des notifications
   * @param {number} limit - Nombre de notifications
   * @returns {Array} Historique
   */
  getHistory(limit = 50) {
    return this.notifications.slice(-limit);
  }

  /**
   * Récupère les statistiques
   * @returns {Object} Statistiques
   */
  getStats() {
    const byChannel = {};
    const bySeverity = {};

    this.notifications.forEach(n => {
      n.channels.forEach(c => {
        byChannel[c] = (byChannel[c] || 0) + 1;
      });
      
      bySeverity[n.alert.severity] = (bySeverity[n.alert.severity] || 0) + 1;
    });

    return {
      total: this.notifications.length,
      unread: this.getUnread().length,
      byChannel,
      bySeverity,
      desktopPermission: this.desktopPermission
    };
  }

  /**
   * Configure les canaux de notification
   * @param {Array} channels - Canaux à activer
   */
  setChannels(channels) {
    this.options.channels = channels;
    this.emit('channels-updated', channels);
  }

  /**
   * Active/désactive le son
   * @param {boolean} enabled - Activer le son
   */
  setSoundEnabled(enabled) {
    this.options.enableSound = enabled;
    if (enabled && !this.options.channels.includes('sound')) {
      this.options.channels.push('sound');
    } else if (!enabled) {
      this.options.channels = this.options.channels.filter(c => c !== 'sound');
    }
  }

  /**
   * Nettoire l'historique
   */
  clearHistory() {
    this.notifications = [];
    this.emit('history-cleared');
  }

  /**
   * Teste tous les canaux de notification
   */
  testAll() {
    const testAlert = {
      id: 'test',
      title: 'Notification de test',
      message: 'Ceci est une notification de test',
      severity: 'info',
      timestamp: Date.now()
    };

    this.notify(testAlert);
  }
}

export default NotificationService;
