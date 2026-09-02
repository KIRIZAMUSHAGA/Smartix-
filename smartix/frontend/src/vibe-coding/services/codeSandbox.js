import { SandboxedRunner } from '../runner/sandbox/SandboxedRunner';

class CodeSandbox {
  constructor() {
    this._runner = new SandboxedRunner({ timeout: 10000 });
  }

  async test(file, code) {
    try {
      const result = await this._runner.run({ file, code });
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }

  async run(file, code) {
    return this.test(file, code);
  }

  async stop() {
    if (this._runner && typeof this._runner.stop === 'function') {
      await this._runner.stop();
    }
  }
}

export const codeSandbox = new CodeSandbox();
export default codeSandbox;
