/**
 * 🔐 ESLint Config - Enforce axiosInstance Usage
 * 
 * This rule prevents developers from importing axios directly,
 * which would bypass the global mutex and auth interceptors.
 * 
 * Exceptions allowed:
 * - src/config/axiosConfig.js (creates the instance)
 * - src/services/authService.js (avoids circular dependencies)
 */

module.exports = {
  rules: {
    'no-direct-axios-import': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce use of axiosInstance instead of direct axios import',
          category: 'Auth & Security',
          recommended: true
        }
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value;
            const filename = context.getFilename();

            // Allow axios import only in specific files
            const allowedFiles = [
              'axiosConfig.js',
              'authService.js'
            ];

            const isAllowedFile = allowedFiles.some(f => filename.endsWith(f));

            if (source === 'axios' && !isAllowedFile) {
              context.report({
                node,
                message: `❌ Direct axios import not allowed here. Use:
                  import axiosInstance from '../config/axiosConfig';
                  
                This ensures all requests go through the global mutex.
                Only axiosConfig.js and authService.js can import axios directly.`
              });
            }
          }
        };
      }
    }
  }
};
