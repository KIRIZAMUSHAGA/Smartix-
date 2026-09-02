/**
 * Logger - Logs centralisés
 */

export default class Logger {
  constructor(namespace = 'preview') {
    this.namespace = namespace;
    this.logs = [];
    this.maxLogs = 1000;
  }

  info(message, data = null) {
    this._log('info', message, data);
  }

  success(message, data = null) {
    this._log('success', message, data);
  }

  warn(message, data = null) {
    this._log('warn', message, data);
  }

  error(message, data = null) {
    this._log('error', message, data);
  }

  build(message, data = null) {
    this._log('build', message, data);
  }

  _log(level, message, data) {
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      level,
      message,
      data,
      namespace: this.namespace,
      timestamp: Date.now()
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console avec couleurs
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m',  // Vert
      warn: '\x1b[33m',     // Jaune
      error: '\x1b[31m',    // Rouge
      build: '\x1b[35m'     // Magenta
    };

    const reset = '\x1b[0m';
    const prefix = `[${this.namespace}] [${level}]`;
    
    console.log(`${colors[level] || ''}${prefix}${reset}`, message);
    if (data) console.log(data);
  }

  getLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  clear() {
    this.logs = [];
  }
}
