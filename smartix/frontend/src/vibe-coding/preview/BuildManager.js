/**
 * BuildManager - Gère les builds avec file d'attente
 */

import EventEmitter from 'events';

export default class BuildManager extends EventEmitter {
  constructor(projectId) {
    super();
    this.projectId = projectId;
    this.queue = [];
    this.isBuilding = false;
    this.currentBuild = null;
    this.buildHistory = [];
  }

  async queueBuild(file) {
    this.queue.push({
      file,
      timestamp: Date.now()
    });
    
    if (!this.isBuilding) {
      await this._processQueue();
    }
  }

  async build() {
    return this.queueBuild('full');
  }

  async _processQueue() {
    if (this.queue.length === 0) {
      this.isBuilding = false;
      return;
    }

    this.isBuilding = true;
    const buildJob = this.queue.shift();

    try {
      this.emit('build-start', buildJob);
      
      const startTime = Date.now();
      const result = await this._runBuild(buildJob);
      const duration = Date.now() - startTime;

      const buildResult = {
        ...result,
        duration,
        job: buildJob,
        timestamp: Date.now()
      };

      this.buildHistory.unshift(buildResult);
      this.emit('build-complete', buildResult);

    } catch (error) {
      this.emit('build-error', {
        error,
        job: buildJob,
        timestamp: Date.now()
      });
    }

    // Traiter le prochain build
    setImmediate(() => this._processQueue());
  }

  async _runBuild(job) {
    // TODO: Implémenter le vrai build
    // - Compilation TypeScript
    // - Minification
    // - Optimisation
    
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          files: job.file === 'full' ? 42 : 1,
          type: job.file === 'full' ? 'full' : 'incremental'
        });
      }, job.file === 'full' ? 2000 : 500);
    });
  }

  get queueLength() {
    return this.queue.length;
  }

  get lastBuild() {
    return this.buildHistory[0] || null;
  }
}
