/**
 * Code Formatter V2 pour Vibe-Coding
 * 
 * Fonctionnalités:
 * - Formatage multi-langages
 * - Détection automatique
 * - Correction automatique
 * - Validation syntaxique
 * - Analyse de complexité
 */

// =============================
// CONFIGURATION
// =============================

const DEFAULT_OPTIONS = {
  indentSize: 2,
  useTabs: false,
  semicolons: true,
  quotes: "single", // 'single', 'double', 'preserve'
  maxLineLength: 80,
  trailingComma: false,
  bracketSpacing: true,
  arrowParens: "always", // 'always', 'avoid'
  endOfLine: "lf" // 'lf', 'crlf', 'cr'
};

// =============================
// UTILITAIRES DE BASE
// =============================

const normalizeLineEndings = (code, endOfLine = "lf") => {
  if (endOfLine === "crlf") {
    return code.replace(/\r?\n/g, "\r\n");
  }
  if (endOfLine === "cr") {
    return code.replace(/\r?\n/g, "\r");
  }
  return code.replace(/\r\n/g, "\n");
};

const removeTrailingSpaces = (code) => {
  return code.replace(/[ \t]+$/gm, "");
};

const removeExtraEmptyLines = (code) => {
  return code.replace(/\n{3,}/g, "\n\n");
};

const detectQuotes = (code) => {
  const singleCount = (code.match(/'/g) || []).length;
  const doubleCount = (code.match(/"/g) || []).length;
  return singleCount > doubleCount ? "single" : "double";
};

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isInString = (code, index) => {
  let inString = false;
  let stringChar = null;
  
  for (let i = 0; i < index; i++) {
    const char = code[i];
    
    if ((char === '"' || char === "'" || char === '`') && 
        (i === 0 || code[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }
  }
  
  return inString;
};

// =============================
// FORMATAGE JAVASCRIPT / TYPESCRIPT
// =============================

const formatJavaScript = (code, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors = [];
  let formatted = code;

  try {
    formatted = normalizeLineEndings(formatted, opts.endOfLine);
    formatted = removeTrailingSpaces(formatted);

    // Détection du style de quotes existant si "preserve"
    const quoteStyle = opts.quotes === "preserve" 
      ? detectQuotes(formatted) 
      : opts.quotes;

    // Normalisation des quotes (en évitant les chaînes)
    if (quoteStyle === "single") {
      formatted = formatted.replace(/"(.*?)"/g, (match, p1) => {
        return `'${p1.replace(/'/g, "\\'")}'`;
      });
    } else if (quoteStyle === "double") {
      formatted = formatted.replace(/'(.*?)'/g, (match, p1) => {
        return `"${p1.replace(/"/g, '\\"')}"`;
      });
    }

    // Formatage de l'indentation
    const lines = formatted.split("\n");
    let indentLevel = 0;
    let inTemplate = false;
    let inBlockComment = false;

    const result = lines.map((line, lineIndex) => {
      let trimmed = line.trim();
      
      // Ignorer les lignes vides
      if (!trimmed) return "";

      // Gestion des commentaires de bloc
      if (trimmed.includes("/*")) inBlockComment = true;
      if (trimmed.includes("*/")) inBlockComment = false;

      // Réduire l'indentation pour les fermetures
      if (!inBlockComment && !inTemplate && /^[}\])]/.test(trimmed)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Générer l'indentation
      const indent = opts.useTabs
        ? "\t".repeat(indentLevel)
        : " ".repeat(indentLevel * opts.indentSize);

      // Ajouter l'indentation
      let newLine = indent + trimmed;

      // Gérer les templates strings
      if (trimmed.includes("`")) {
        inTemplate = !inTemplate;
      }

      // Augmenter l'indentation après les ouvertures
      if (!inBlockComment && !inTemplate) {
        if (/[{\[(]/.test(trimmed) && !trimmed.includes("}")) {
          indentLevel++;
        }
        
        // Gérer les cas spéciaux comme les ternaires
        if (trimmed.match(/[=!]=?>\s*$/)) {
          indentLevel++;
        }
      }

      // Ajouter les points-virgules si demandé
      if (opts.semicolons && !inBlockComment && !inTemplate) {
        const shouldAddSemicolon = 
          !trimmed.endsWith(";") &&
          !trimmed.endsWith("{") &&
          !trimmed.endsWith("}") &&
          !trimmed.endsWith(":") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*") &&
          !trimmed.endsWith("*/") &&
          !trimmed.match(/^\s*[)}\]]/);

        if (shouldAddSemicolon) {
          newLine += ";";
        }
      }

      return newLine;
    });

    formatted = result.join("\n");

    // Nettoyage final
    formatted = removeExtraEmptyLines(formatted);
    formatted = formatted.replace(/\n\s*\n\s*\n/g, "\n\n");

    // Vérifier la longueur des lignes
    if (opts.maxLineLength > 0) {
      const longLines = formatted.split("\n").filter(l => l.length > opts.maxLineLength);
      if (longLines.length > 0) {
        errors.push(`${longLines.length} ligne(s) dépassent ${opts.maxLineLength} caractères`);
      }
    }

  } catch (error) {
    errors.push(`Erreur de formatage: ${error.message}`);
    return { formatted: code, errors };
  }

  return { formatted, errors };
};

// =============================
// FORMATAGE HTML
// =============================

const formatHTML = (code, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors = [];
  let formatted = code;

  try {
    formatted = normalizeLineEndings(formatted, opts.endOfLine);
    formatted = removeTrailingSpaces(formatted);

    // Séparer les balises
    formatted = formatted.replace(/>\s*</g, ">\n<");

    const lines = formatted.split("\n");
    let indentLevel = 0;
    let inScript = false;
    let inStyle = false;

    const result = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      // Gérer les balises fermantes
      if (/^<\/.+>/.test(trimmed)) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indent = " ".repeat(indentLevel * opts.indentSize);
      let newLine = indent + trimmed;

      // Gérer les balises ouvrantes
      if (/^<[^/!].*>$/.test(trimmed) && !trimmed.endsWith("/>")) {
        if (trimmed.startsWith("<script")) inScript = true;
        if (trimmed.startsWith("<style")) inStyle = true;
        indentLevel++;
      }

      // Gérer les balises auto-fermantes
      if (trimmed.endsWith("/>")) {
        // Ne pas augmenter l'indentation
      }

      // Gérer la fin des blocs script/style
      if (trimmed === "</script>") inScript = false;
      if (trimmed === "</style>") inStyle = false;

      // Formater le contenu des scripts/styles
      if (inScript && !trimmed.startsWith("<script")) {
        // Appliquer le formateur JavaScript
        const jsFormatted = formatJavaScript(trimmed, opts);
        newLine = indent + jsFormatted.formatted;
      } else if (inStyle && !trimmed.startsWith("<style")) {
        // Appliquer le formateur CSS
        const cssFormatted = formatCSS(trimmed, opts);
        newLine = indent + cssFormatted.formatted;
      }

      return newLine;
    });

    formatted = result.join("\n");
    formatted = removeExtraEmptyLines(formatted);

  } catch (error) {
    errors.push(`Erreur de formatage HTML: ${error.message}`);
    return { formatted: code, errors };
  }

  return { formatted, errors };
};

// =============================
// FORMATAGE CSS
// =============================

const formatCSS = (code, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors = [];
  let formatted = code;

  try {
    formatted = normalizeLineEndings(formatted, opts.endOfLine);
    formatted = removeTrailingSpaces(formatted);

    // Espacement autour des accolades
    formatted = formatted.replace(/\s*{\s*/g, " {\n");
    formatted = formatted.replace(/\s*}\s*/g, "\n}\n");
    
    // Saut de ligne après les points-virgules
    formatted = formatted.replace(/;(?=\s*[a-zA-Z-])/g, ";\n");

    const lines = formatted.split("\n");
    let indentLevel = 0;

    const result = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      if (trimmed.includes("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indent = " ".repeat(indentLevel * opts.indentSize);
      let newLine = indent + trimmed;

      if (trimmed.includes("{")) {
        indentLevel++;
      }

      return newLine;
    });

    formatted = result.join("\n");

    // Espacement optionnel autour des propriétés
    if (opts.bracketSpacing) {
      formatted = formatted.replace(/:(\S)/g, ": $1");
    }

    formatted = removeExtraEmptyLines(formatted);

  } catch (error) {
    errors.push(`Erreur de formatage CSS: ${error.message}`);
    return { formatted: code, errors };
  }

  return { formatted, errors };
};

// =============================
// FORMATAGE JSON
// =============================

const formatJSON = (code, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors = [];

  try {
    const parsed = JSON.parse(code);
    const formatted = JSON.stringify(parsed, null, opts.indentSize);
    return { formatted, errors };
  } catch (error) {
    errors.push(`JSON invalide: ${error.message}`);
    return { formatted: code, errors };
  }
};

// =============================
// FORMATAGE MARKDOWN
// =============================

const formatMarkdown = (code, options = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let formatted = code;

  formatted = normalizeLineEndings(formatted, opts.endOfLine);
  formatted = removeTrailingSpaces(formatted);

  // Espacement autour des titres
  formatted = formatted.replace(/([^\n])\n(#{1,6})/g, "$1\n\n$2");
  formatted = formatted.replace(/(#{1,6}[^\n]+)\n([^\n#])/g, "$1\n\n$2");

  // Espacement autour des listes
  formatted = formatted.replace(/([^\n])\n([*-] )/g, "$1\n\n$2");
  formatted = formatted.replace(/([*-] [^\n]+)\n([^\n*-])/g, "$1\n\n$2");

  // Espacement autour des blocs de code
  formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
  });

  formatted = removeExtraEmptyLines(formatted);

  return { formatted, errors: [] };
};

// =============================
// DETECTION LANGAGE
// =============================

export const detectLanguage = (filename, content = "") => {
  if (!filename && !content) return "text";

  if (filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
      js: "javascript", mjs: "javascript", cjs: "javascript",
      ts: "typescript", jsx: "jsx", tsx: "tsx",
      html: "html", htm: "html", css: "css", scss: "css",
      json: "json", md: "markdown", yml: "yaml", yaml: "yaml",
      xml: "xml", svg: "xml"
    };
    if (map[ext]) return map[ext];
  }

  // Détection basée sur le contenu
  if (content) {
    if (content.trim().startsWith("<!DOCTYPE html>")) return "html";
    if (content.trim().startsWith("<?xml")) return "xml";
    if (content.trim().startsWith("{")) return "json";
    if (content.includes("function") || content.includes("const ")) return "javascript";
  }

  return "text";
};

// =============================
// FORMAT PRINCIPAL
// =============================

export const formatCode = (code, language = "javascript", options = {}) => {
  if (!code) return { formatted: code, errors: [] };

  const formatters = {
    javascript: formatJavaScript,
    typescript: formatJavaScript,
    jsx: formatJavaScript,
    tsx: formatJavaScript,
    html: formatHTML,
    css: formatCSS,
    json: formatJSON,
    markdown: formatMarkdown,
    yaml: (c) => ({ formatted: c, errors: [] }), // TODO
    xml: (c) => ({ formatted: c, errors: [] })   // TODO
  };

  const formatter = formatters[language] || ((c) => ({ formatted: c, errors: [] }));
  return formatter(code, options);
};

// =============================
// FORMAT FICHIER
// =============================

export const formatFile = (filename, code, options = {}) => {
  const language = detectLanguage(filename, code);
  return formatCode(code, language, options);
};

// =============================
// MINIFICATION
// =============================

export const minifyCode = (code, language = "javascript") => {
  if (!code) return code;

  let minified = code;

  // Supprimer les commentaires (en évitant les chaînes)
  if (language === "javascript" || language === "css") {
    minified = minified.replace(/\/\/.*$/gm, (match, offset) => {
      return isInString(code, offset) ? match : "";
    });
    minified = minified.replace(/\/\*[\s\S]*?\*\//g, (match, offset) => {
      return isInString(code, offset) ? match : "";
    });
  }

  if (language === "html") {
    minified = minified.replace(/<!--[\s\S]*?-->/g, "");
  }

  // Réduire les espaces
  minified = minified.replace(/\s+/g, " ");
  
  // Supprimer les espaces autour des opérateurs (sauf dans les chaînes)
  minified = minified.replace(/\s*([=+\-*/<>!&|])\s*/g, "$1");

  return minified.trim();
};

// =============================
// VALIDATION SYNTAXE
// =============================

export const validateSyntax = (code, language = "javascript") => {
  const errors = [];

  try {
    if (language === "json") {
      JSON.parse(code);
    } else if (language === "javascript" || language === "jsx" || language === "typescript") {
      // Vérification plus robuste
      try {
        new Function(code);
      } catch (e) {
        // Essayer avec eval pour les modules ES6
        eval?.(`"use strict";${code}`);
      }
    } else if (language === "css") {
      // Vérification CSS basique
      const style = document.createElement("style");
      style.textContent = code;
      document.head.appendChild(style);
      document.head.removeChild(style);
    } else if (language === "html") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(code, "text/html");
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        errors.push(parseError.textContent || "Erreur de parsing HTML");
      }
    }
  } catch (err) {
    errors.push(err.message);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// =============================
// AUTO FIX
// =============================

export const autoFixCode = (code) => {
  let fixed = code;
  
  fixed = normalizeLineEndings(fixed);
  fixed = removeTrailingSpaces(fixed);
  fixed = removeExtraEmptyLines(fixed);
  
  // Ajouter une nouvelle ligne à la fin
  if (!fixed.endsWith("\n")) {
    fixed += "\n";
  }

  return fixed;
};

// =============================
// COMPLEXITÉ
// =============================

export const calculateComplexity = (code, language = "javascript") => {
  let complexity = 1;

  if (language === "javascript" || language === "typescript") {
    complexity += (code.match(/if\s*\(/g) || []).length;
    complexity += (code.match(/for\s*\(/g) || []).length * 2;
    complexity += (code.match(/while\s*\(/g) || []).length * 2;
    complexity += (code.match(/switch\s*\(/g) || []).length * 2;
    complexity += (code.match(/catch\s*\(/g) || []).length;
    complexity += (code.match(/\?.*:/g) || []).length; // Ternaires
    complexity += (code.match(/&&/g) || []).length;
    complexity += (code.match(/\|\|/g) || []).length;
  } else if (language === "css") {
    complexity += (code.match(/@media/g) || []).length * 2;
    complexity += (code.match(/@keyframes/g) || []).length;
  } else if (language === "html") {
    complexity += (code.match(/<[^>]+>/g) || []).length;
  }

  return complexity;
};

// =============================
// EXPORT
// =============================

export default {
  formatCode,
  formatFile,
  minifyCode,
  validateSyntax,
  autoFixCode,
  calculateComplexity,
  detectLanguage
};
