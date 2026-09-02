/**
 * WebSocketManager - Communication temps réel
 */

import { WebSocketServer } from 'ws';
import EventEmitter from 'events';

export default class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.port = null;
    this.clients = new Set();
  }

  async start(port = 24678) {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ port });
        this.port = port;

        this.wss.on('connection', (ws) => {
          this.clients.add(ws);
          this.emit('connection', ws);

          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message.toString());
              this.emit('message', data, ws);
            } catch (error) {
              this.emit('error', error);
            }
          });

          ws.on('close', () => {
            this.clients.delete(ws);
            this.emit('disconnection', ws);
          });
        });

        this.wss.on('error', (error) => {
          this.emit('error', error);
          reject(error);
        });

        resolve();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (!this.wss) {
        resolve();
        return;
      }

      // Fermer toutes les connexions
      this.clients.forEach(client => client.close());
      
      this.wss.close(() => {
        this.wss = null;
        this.port = null;
        this.clients.clear();
        resolve();
      });
    });
  }

  broadcast(message) {
    if (!this.wss) return;

    const data = JSON.stringify(message);
    
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    });
  }

  sendTo(clientId, message) {
    // TODO: Implémenter l'envoi à un client spécifique
  }

  getClientCount() {
    return this.clients.size;
  }
}
