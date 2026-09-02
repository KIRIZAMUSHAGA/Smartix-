/**
 * Service de Streaming Agnostique pour Kirix IA
 * Gère la réception des flux SSE et la simulation d'écriture progressive
 */

export class KirixStreamingService {
  constructor(options = {}) {
    this.typingSpeed = options.typingSpeed || 30; // ms par chunk
    this.onChunk = options.onChunk || (() => {});
    this.onDone = options.onDone || (() => {});
    this.onError = options.onError || (() => {});
    this.controller = new AbortController();
  }

  /**
   * Démarre une session de chat en streaming
   */
  async chat(question, threadId = null, fileIds = [], isTemporary = false) {
    this.isAborted = false;
    try {
      const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question,
          thread_id: threadId,
          file_ids: fileIds,
          is_temporary: isTemporary
        }),
        signal: this.controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (this.isAborted) {
          await reader.cancel();
          break;
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Split par double newline (format SSE standard)
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Garder le reste incomplet

        for (const line of lines) {
          if (this.isAborted) break;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                this.onError(data.error);
                return;
              }

              if (data.text) {
                // Simulation de frappe pour fluidité UX
                await this.simulateTyping(data.text);
              }

              if (data.done) {
                this.onDone(data);
                return;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError' || this.isAborted) {
        console.log('Streaming aborted');
      } else {
        this.onError(error.message);
      }
    }
  }

  /**
   * Simule l'écriture progressive
   */
  async simulateTyping(text) {
    if (this.isAborted) return;
    this.onChunk(text);
    if (this.typingSpeed > 0) {
      await new asyncioSleep(this.typingSpeed);
    }
  }

  stop() {
    this.isAborted = true;
    this.controller.abort();
  }
}

function asyncioSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
