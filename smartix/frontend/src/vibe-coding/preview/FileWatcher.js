/**
 * FileWatcher - Surveillance efficace des fichiers
 * Utilise Chokidar (pas de polling)
 */

import chokidar from 'chokidar';
import EventEmitter from 'events';
import crypto from 'crypto';

export default class FileWatcher extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.fileHashes = new Map();
    this.watchPaths = [];
  }

  async watch(projectPath, options = {}) {
    const {
      ignored = /node_modules|\.git|\.cache/,
      persistent = true,
      ignoreInitial = true,
      awaitWriteFinish = {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    } = options;

    return new Promise((resolve, reject) => {
      try {
        this.watcher = chokidar.watch(projectPath, {
          ignored,
          persistent,
          ignoreInitial,
          awaitWriteFinish
        });

        this.watcher
          .on('add', path => this._handleAdd(path))
          .on('change', path => this._handleChange(path))
          .on('unlink', path => this._handleUnlink(path))
          .on('error', error => this.emit('error', error))
          .on('ready', () => {
            this.watchPaths = [projectPath];
            this.emit('ready');
            resolve();
          });

      } catch (error) {
        reject(error);
      }
    });
  }

  async unwatch() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  _handleAdd(path) {
    const hash = this._computeHash(path);
    this.fileHashes.set(path, { hash, mtime: Date.now() });
    this.emit('add', path);
  }

  async _handleChange(path) {
    const oldHash = this.fileHashes.get(path)?.hash;
    const newHash = await this._computeHash(path);
    
    if (oldHash !== newHash) {
      this.fileHashes.set(path, { hash: newHash, mtime: Date.now() });
      this.emit('change', path);
    }
  }

  _handleUnlink(path) {
    this.fileHashes.delete(path);
    this.emit('unlink', path);
  }

  async _computeHash(path) {
    try {
      const content = await fs.promises.readFile(path, 'utf-8');
      return crypto.createHash('sha1').update(content).digest('hex');
    } catch {
      return Date.now().toString();
    }
  }
}
