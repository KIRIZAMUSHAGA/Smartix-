/**
 * ProcessManager - Gestion des processus externes
 */

import { spawn } from 'child_process';
import EventEmitter from 'events';

export default class ProcessManager extends EventEmitter {
  constructor() {
    super();
    this.processes = new Map();
  }

  async start(command, args = [], options = {}) {
    const id = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    return new Promise((resolve, reject) => {
      try {
        const proc = spawn(command, args, {
          shell: true,
          stdio: 'pipe',
          ...options
        });

        const processInfo = {
          id,
          command,
          args,
          proc,
          startTime: Date.now(),
          stdout: [],
          stderr: []
        };

        proc.stdout.on('data', (data) => {
          const output = data.toString();
          processInfo.stdout.push(output);
          this.emit('stdout', { id, output });
        });

        proc.stderr.on('data', (data) => {
          const output = data.toString();
          processInfo.stderr.push(output);
          this.emit('stderr', { id, output });
        });

        proc.on('close', (code) => {
          processInfo.exitCode = code;
          processInfo.endTime = Date.now();
          this.emit('exit', { id, code });
        });

        proc.on('error', (error) => {
          this.emit('error', { id, error });
        });

        this.processes.set(id, processInfo);
        
        // Attendre que le processus soit prêt
        setTimeout(() => resolve(processInfo), 500);

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(id) {
    const proc = this.processes.get(id);
    if (!proc) return false;

    return new Promise((resolve) => {
      proc.proc.on('close', () => {
        this.processes.delete(id);
        resolve(true);
      });

      proc.proc.kill();
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.processes.has(id)) {
          proc.proc.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  async stopAll() {
    const promises = Array.from(this.processes.keys()).map(id => this.stop(id));
    return Promise.all(promises);
  }
}
