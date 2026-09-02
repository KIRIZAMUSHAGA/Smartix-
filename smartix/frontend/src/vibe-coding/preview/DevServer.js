/**
 * DevServer - Serveur de développement réel
 * Utilise Vite pour le HMR et le build
 */

import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

export default class DevServer {
  constructor() {
    this.server = null;
    this.port = null;
    this.url = null;
    this.viteConfig = null;
  }

  async start(project, options = {}) {
    try {
      this.port = options.port || 3000;
      
      // Configuration Vite dynamique
      const config = {
        root: project.path,
        server: {
          port: this.port,
          host: true,
          strictPort: false, // Permet de trouver un autre port si occupé
          hmr: {
            clientPort: this.port,
            overlay: true
          },
          watch: {
            usePolling: false,
            interval: 1000
          }
        },
        build: {
          outDir: 'dist',
          sourcemap: true
        },
        optimizeDeps: {
          include: ['react', 'react-dom']
        }
      };

      // Créer le serveur Vite
      this.server = await createServer(config);
      
      // Démarrer le serveur
      await this.server.listen();
      
      this.url = `http://localhost:${this.port}`;
      
      return { success: true, url: this.url };
      
    } catch (error) {
      console.error('Erreur démarrage Vite:', error);
      throw new Error(`Impossible de démarrer le serveur: ${error.message}`);
    }
  }

  async stop() {
    if (this.server) {
      await this.server.close();
      this.server = null;
    }
  }

  async build() {
    if (!this.server) {
      throw new Error('Serveur non démarré');
    }
    
    // Build via Vite
    const result = await this.server.build();
    return result;
  }

  get url() {
    return this._url;
  }

  set url(value) {
    this._url = value;
  }
}
