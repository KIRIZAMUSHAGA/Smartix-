// =============================
// CONFIGURATION
// =============================
const REQUEST_TIMEOUT = 10000; // 10 secondes max par défaut
const MAX_CODE_LENGTH = 5000; // 5000 caractères max
const MAX_MEMORY_MB = 128; // Limite mémoire (backend)

// Langages supportés avec leurs extensions et timeouts spécifiques
const SUPPORTED_LANGUAGES = {
  javascript: { name: 'JavaScript', extension: 'js', timeout: 5000 },
  python: { name: 'Python', extension: 'py', timeout: 8000 },
  html: { name: 'HTML/CSS', extension: 'html', timeout: 3000 },
  json: { name: 'JSON', extension: 'json', timeout: 2000 },
  markdown: { name: 'Markdown', extension: 'md', timeout: 2000 }
};

// Patterns dangereux étendus
const DANGEROUS_PATTERNS = [
  // Accès au système de fichiers
  /require\(['"]fs['"]\)/i,
  /require\(['"]child_process['"]\)/i,
  /require\(['"]path['"]\)/i,
  /require\(['"]os['"]\)/i,
  
  // Accès aux variables d'environnement (versions contournées)
  /process\.env/i,
  /global\[['"]process['"]\]\[['"]env['"]\]/i,
  /globalThis\.process\.env/i,
  
  // Accès au stockage local
  /localStorage/i,
  /sessionStorage/i,
  /document\.cookie/i,
  /global\[['"]localStorage['"]\]/i,
  
  // Évaluation dynamique
  /eval\(/i,
  /Function\(/i,
  /new Function\(/i,
  /setTimeout\(['"][^'"]*['"]/i,
  /setInterval\(['"][^'"]*['"]/i,
  
  // Requêtes réseau
  /XMLHttpRequest/i,
  /fetch\(['"]/i,
  /WebSocket/i,
  /require\(['"]http['"]\)/i,
  /require\(['"]https['"]\)/i,
  
  // Accès à la console (peut être bénin mais à surveiller)
  /console\.log/i,
  /console\.error/i,
  
  // Tentatives de contournement
  /\['fs'\]/i,
  /\['child_process'\]/i,
  /\[\/\/\]: # \(.*\)/i // Commentaires qui cachent du code
];

// =============================
// UTILITAIRES
// =============================
const getToken = () => localStorage.getItem('access_token');

// =============================
// VALIDATION DU CODE
// =============================
const validateCode = (code, language) => {
  if (!code || typeof code !== 'string') {
    return {
      valid: false,
      error: 'Code invalide'
    };
  }

  if (code.length > MAX_CODE_LENGTH) {
    return {
      valid: false,
      error: `Code trop long (max ${MAX_CODE_LENGTH} caractères)`
    };
  }

  if (!SUPPORTED_LANGUAGES[language]) {
    return {
      valid: false,
      error: `Langage non supporté. Langages disponibles: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`
    };
  }

  return { valid: true };
};

// =============================
// ANALYSE STATIQUE AMÉLIORÉE
// =============================
const analyzeCode = (code) => {
  const analysis = {
    lines: code.split('\n').length,
    characters: code.length,
    hasComments: code.includes('//') || code.includes('/*') || code.includes('#') || code.includes('<!--'),
    hasFunctions: /function\s+\w+\(|def\s+\w+\(|\w+\s*=\s*\([^)]*\)\s*=>|async\s+function|async\s+\(/.test(code),
    hasLoops: /for\s*\(|while\s*\(|do\s*{|\bfor\s+await\s*\(/.test(code),
    hasConditionals: /if\s*\(|else\s*{|\bswitch\s*\(/.test(code),
    hasAsync: /async|await|Promise|setTimeout|setInterval/.test(code),
    dangerousPatterns: []
  };

  // Détection améliorée des patterns dangereux
  DANGEROUS_PATTERNS.forEach(pattern => {
    if (pattern.test(code)) {
      analysis.dangerousPatterns.push(pattern.toString());
    }
  });

  return analysis;
};

// =============================
// FORMATAGE DES RÉSULTATS
// =============================
const formatOutput = (data) => {
  if (!data) return null;

  return {
    output: data.output || data.stdout || '',
    error: data.error || data.stderr || '',
    executionTime: data.executionTime || 0,
    memoryUsed: data.memoryUsed || 0,
    exitCode: data.exitCode || 0
  };
};

// =============================
// FONCTION PRINCIPALE
// =============================
export const codeTool = {
  name: 'run_code',
  description: 'Exécuter ou analyser du code dans différents langages',
  
  execute: async (code, options = {}) => {
    const {
      language = 'javascript',
      mode = 'execute', // 'execute' ou 'analyze'
      timeout,
      userId = 'anonymous'
    } = options;

    // Validation du code
    const validation = validateCode(code, language);
    if (!validation.valid) {
      return {
        error: true,
        message: validation.error,
        code: 'INVALID_CODE'
      };
    }

    // Utiliser le timeout spécifique au langage si non fourni
    const actualTimeout = timeout || SUPPORTED_LANGUAGES[language].timeout || REQUEST_TIMEOUT;

    // Mode ANALYSE seulement (sans exécution)
    if (mode === 'analyze') {
      const analysis = analyzeCode(code);
      return {
        language,
        mode: 'analyze',
        analysis,
        timestamp: new Date().toISOString()
      };
    }

    // Mode EXÉCUTION (nécessite backend sécurisé)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), actualTimeout);

    try {
      const token = getToken();
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          code,
          language,
          options: {
            memory: MAX_MEMORY_MB,
            timeout: actualTimeout - 500 // Timeout légèrement inférieur
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erreur ${response.status}`);
      }

      const data = await response.json();
      
      // Vérifier si le backend a détecté une erreur
      if (data.error) {
        return {
          error: true,
          message: data.error,
          code: 'EXECUTION_ERROR',
          details: data.details || {}
        };
      }

      return {
        language,
        mode: 'execute',
        ...formatOutput(data),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          error: true,
          message: `L'exécution a pris trop de temps (limite: ${actualTimeout}ms)`,
          code: 'TIMEOUT',
          timeout: actualTimeout
        };
      }

      console.error('Code execution error:', error);

      // Erreurs spécifiques
      if (error.message.includes('syntax')) {
        return {
          error: true,
          message: 'Erreur de syntaxe dans le code',
          code: 'SYNTAX_ERROR'
        };
      }

      if (error.message.includes('memory')) {
        return {
          error: true,
          message: `Limite mémoire dépassée (${MAX_MEMORY_MB}MB)`,
          code: 'MEMORY_LIMIT'
        };
      }

      if (error.message.includes('forbidden') || error.message.includes('dangerous')) {
        return {
          error: true,
          message: 'Le code contient des opérations interdites',
          code: 'FORBIDDEN_OPERATION'
        };
      }

      return {
        error: true,
        message: error.message || 'Échec de l\'exécution du code',
        code: error.code || 'UNKNOWN_ERROR'
      };
    }
  },

  // =============================
  // FONCTIONS UTILITAIRES
  // =============================

  /**
   * Analyser du code sans l'exécuter
   */
  analyze: (code) => {
    return codeTool.execute(code, { mode: 'analyze' });
  },

  /**
   * Obtenir les langages supportés
   */
  getSupportedLanguages: () => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([key, value]) => ({
      id: key,
      name: value.name,
      extension: value.extension,
      timeout: value.timeout
    }));
  },

  /**
   * Vérifier si un langage est supporté
   */
  isLanguageSupported: (language) => {
    return !!SUPPORTED_LANGUAGES[language];
  },

  /**
   * Formater du code (indentation, etc.) - côté client
   */
  formatCode: (code, language = 'javascript') => {
    // Version simple, idéalement utiliser Prettier
    try {
      // Supprimer les lignes vides en trop
      let formatted = code.replace(/\n\s*\n\s*\n/g, '\n\n');
      
      // Ajouter une indentation basique (simulée)
      const lines = formatted.split('\n');
      let indent = 0;
      const indented = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.endsWith('}') || trimmed.endsWith(']') || trimmed.endsWith(')')) {
          indent = Math.max(0, indent - 1);
        }
        const result = '  '.repeat(indent) + trimmed;
        if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
          indent++;
        }
        return result;
      });
      
      return indented.join('\n');
    } catch (error) {
      console.error('Format error:', error);
      return code;
    }
  },

  /**
   * Estimer la complexité du code
   */
  estimateComplexity: (code) => {
    const analysis = analyzeCode(code);
    
    let complexity = 'faible';
    const score = 
      (analysis.hasLoops ? 3 : 0) +
      (analysis.hasAsync ? 2 : 0) +
      (analysis.hasFunctions ? 2 : 0) +
      (analysis.hasConditionals ? 1 : 0) +
      analysis.dangerousPatterns.length * 5;

    if (score > 8) complexity = 'élevée';
    else if (score > 3) complexity = 'moyenne';

    return {
      complexity,
      score,
      details: analysis
    };
  },

  /**
   * ✅ Nettoyer le code (supprimer les commentaires) - version améliorée
   */
  stripComments: (code, language = 'javascript') => {
    let cleaned = code;
    
    // Supprimer les commentaires selon le langage
    if (language === 'javascript' || language === 'json') {
      cleaned = cleaned
        .replace(/\/\/.*$/gm, '') // Ligne comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Block comments
    }
    
    if (language === 'html') {
      cleaned = cleaned
        .replace(/<!--[\s\S]*?-->/g, ''); // ✅ HTML comments
    }
    
    if (language === 'python') {
      cleaned = cleaned
        .replace(/#.*$/gm, ''); // Python comments
    }
    
    if (language === 'markdown') {
      cleaned = cleaned
        .replace(/<!--[\s\S]*?-->/g, '') // HTML comments in markdown
        .replace(/\[comment\]:.*$/gm, ''); // Markdown comment syntax
    }
    
    return cleaned;
  },

  /**
   * ✅ Vérification rapide de sécurité
   */
  quickSecurityCheck: (code) => {
    const analysis = analyzeCode(code);
    
    return {
      safe: analysis.dangerousPatterns.length === 0,
      warnings: analysis.dangerousPatterns,
      score: analysis.dangerousPatterns.length
    };
  }
};

export default codeTool;
