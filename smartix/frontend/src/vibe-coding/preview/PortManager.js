/**
 * PortManager - Gestion des ports
 */

import net from 'net';

export default class PortManager {
  constructor() {
    this.usedPorts = new Set();
  }

  async findPort(startPort, maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      
      if (this.usedPorts.has(port)) {
        continue;
      }

      if (await this._isPortAvailable(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }

    throw new Error(`Aucun port disponible à partir de ${startPort}`);
  }

  _isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, 'localhost');
    });
  }

  releasePort(port) {
    this.usedPorts.delete(port);
  }
}
