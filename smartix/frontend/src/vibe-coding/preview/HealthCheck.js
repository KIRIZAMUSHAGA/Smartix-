/**
 * HealthCheck - Surveillance de la santé du serveur
 */

import EventEmitter from 'events';

export default class HealthCheck extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    this.isHealthy = false;
    this.checkInterval = null;
    this.failCount = 0;
    this.maxFailures = 3;
  }

  async start(options = {}) {
    const {
      url = 'http://localhost:3000',
      interval = 5000,
      timeout = 2000,
      endpoint = '/api/health'
    } = options;

    this.url = url;
    this.endpoint = endpoint;
    this.isRunning = true;
    this.failCount = 0;

    this.checkInterval = setInterval(async () => {
      await this._check();
    }, interval);

    // Premier check immédiat
    await this._check();
  }

  async stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  async _check() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.url}${this.endpoint}`, {
        method: 'HEAD',
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeout);

      const wasHealthy = this.isHealthy;
      this.isHealthy = response?.ok || false;

      if (this.isHealthy) {
        this.failCount = 0;
        if (!wasHealthy) {
          this.emit('healthy');
        }
      } else {
        this.failCount++;
        if (wasHealthy || this.failCount >= this.maxFailures) {
          this.emit('unhealthy', `Échec après ${this.failCount} tentatives`);
        }
      }

    } catch (error) {
      this.isHealthy = false;
      this.failCount++;
      
      if (this.failCount >= this.maxFailures) {
        this.emit('unhealthy', error.message);
      }
    }
  }
}
