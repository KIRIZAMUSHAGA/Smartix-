/**
 * ImportAnalyzer
 * Analyse les imports dans le code pour détecter les dépendances manquantes
 */

import EventEmitter from 'events';

export class ImportAnalyzer extends EventEmitter {
  /**
   * Crée une instance de ImportAnalyzer
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      ignorePatterns: options.ignorePatterns || [
        /^\./,  // Imports relatifs
        /^@\//, // Imports alias
        /^[a-z]+:\/\// // URLs
      ],
      ...options
    };
  }

  /**
   * Analyse les imports dans les fichiers
   * @param {Object} files - Fichiers du projet
   * @param {Object} options - Options d'analyse
   * @returns {Promise<Object>} Résultat de l'analyse
   */
  async analyze(files, options = {}) {
    const startTime = Date.now();
    
    const knownDependencies = options.knownDependencies || [];
    const imports = [];
    const missing = [];
    const locations = new Map();

    // Parcourir tous les fichiers
    for (const [path, content] of Object.entries(files)) {
      if (this._shouldAnalyze(path)) {
        const fileImports = this._extractImports(content, path);
        
        fileImports.forEach(imp => {
          imports.push({
            ...imp,
            file: path
          });

          // Enregistrer les emplacements
          if (!locations.has(imp.package)) {
            locations.set(imp.package, []);
          }
          locations.get(imp.package).push({
            file: path,
            line: imp.line,
            import: imp.import
          });
        });
      }
    }

    // Identifier les dépendances manquantes
    const importPackages = [...new Set(imports.map(i => i.package))];
    importPackages.forEach(pkg => {
      if (!knownDependencies.includes(pkg) && !this._isIgnored(pkg)) {
        missing.push({
          name: pkg,
          locations: locations.get(pkg),
          count: locations.get(pkg).length
        });
      }
    });

    const result = {
      imports,
      missing,
      stats: {
        totalImports: imports.length,
        uniquePackages: importPackages.length,
        missingPackages: missing.length,
        duration: Date.now() - startTime
      }
    };

    this.emit('analysis:completed', result);
    return result;
  }

  /**
   * Extrait les imports d'un fichier
   * @private
   * @param {string} content - Contenu du fichier
   * @param {string} path - Chemin du fichier
   * @returns {Array} Imports trouvés
   */
  _extractImports(content, path) {
    const imports = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Import ES6: import ... from 'package'
      const importMatch = line.match(/import\s+(?:[\w*{},]\s+from\s+)?['"]([^'"]+)['"]/);
      if (importMatch) {
        const importPath = importMatch[1];
        const packageName = this._extractPackageName(importPath);
        
        if (packageName) {
          imports.push({
            type: 'import',
            import: importPath,
            package: packageName,
            line: lineNumber,
            code: line.trim()
          });
        }
      }

      // Require: require('package')
      const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (requireMatch) {
        const importPath = requireMatch[1];
        const packageName = this._extractPackageName(importPath);
        
        if (packageName) {
          imports.push({
            type: 'require',
            import: importPath,
            package: packageName,
            line: lineNumber,
            code: line.trim()
          });
        }
      }

      // Import dynamique: import('package')
      const dynamicMatch = line.match(/import\(['"]([^'"]+)['"]\)/);
      if (dynamicMatch) {
        const importPath = dynamicMatch[1];
        const packageName = this._extractPackageName(importPath);
        
        if (packageName) {
          imports.push({
            type: 'dynamic',
            import: importPath,
            package: packageName,
            line: lineNumber,
            code: line.trim()
          });
        }
      }

      // Export from: export ... from 'package'
      const exportMatch = line.match(/export\s+.*\s+from\s+['"]([^'"]+)['"]/);
      if (exportMatch) {
        const importPath = exportMatch[1];
        const packageName = this._extractPackageName(importPath);
        
        if (packageName) {
          imports.push({
            type: 'export',
            import: importPath,
            package: packageName,
            line: lineNumber,
            code: line.trim()
          });
        }
      }
    });

    return imports;
  }

  /**
   * Extrait le nom du package d'un chemin d'import
   * @private
   * @param {string} importPath - Chemin d'import
   * @returns {string|null} Nom du package
   */
  _extractPackageName(importPath) {
    // Ignorer les imports relatifs
    if (importPath.startsWith('.')) return null;
    if (importPath.startsWith('/')) return null;

    // Gérer les packages scoped (@scope/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      return parts.slice(0, 2).join('/');
    }

    // Package normal (package/subpath)
    return importPath.split('/')[0];
  }

  /**
   * Vérifie si un fichier doit être analysé
   * @private
   * @param {string} path - Chemin du fichier
   * @returns {boolean} true si doit être analysé
   */
  _shouldAnalyze(path) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte'];
    const ext = path.substring(path.lastIndexOf('.'));
    
    // Ignorer node_modules
    if (path.includes('node_modules')) return false;
    
    return extensions.includes(ext);
  }

  /**
   * Vérifie si un package doit être ignoré
   * @private
   * @param {string} packageName - Nom du package
   * @returns {boolean} true si doit être ignoré
   */
  _isIgnored(packageName) {
    return this.options.ignorePatterns.some(pattern => 
      pattern.test(packageName)
    );
  }

  /**
   * Analyse spécifique pour détecter les imports non utilisés
   * @param {string} content - Contenu du fichier
   * @param {Array} imports - Imports trouvés
   * @returns {Array} Imports non utilisés
   */
  detectUnusedImports(content, imports) {
    const unused = [];

    imports.forEach(imp => {
      if (imp.type === 'import') {
        // Extraire les identifiants importés
        const identifiers = this._extractImportedIdentifiers(imp.code);
        
        // Vérifier si chaque identifiant est utilisé
        const used = identifiers.some(id => 
          this._isIdentifierUsed(content, id, imp.line)
        );

        if (!used) {
          unused.push(imp);
        }
      }
    });

    return unused;
  }

  /**
   * Extrait les identifiants importés
   * @private
   * @param {string} importCode - Code de l'import
   * @returns {Array} Identifiants
   */
  _extractImportedIdentifiers(importCode) {
    const identifiers = [];

    // import default
    const defaultMatch = importCode.match(/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from/);
    if (defaultMatch) {
      identifiers.push(defaultMatch[1]);
    }

    // import { x, y as z }
    const namedMatch = importCode.match(/\{\s*([^}]+)\s*\}/);
    if (namedMatch) {
      const named = namedMatch[1].split(',').map(i => {
        const asMatch = i.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        return asMatch ? asMatch[2].trim() : i.trim();
      });
      identifiers.push(...named);
    }

    // import * as namespace
    const namespaceMatch = importCode.match(/\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (namespaceMatch) {
      identifiers.push(namespaceMatch[1]);
    }

    return identifiers;
  }

  /**
   * Vérifie si un identifiant est utilisé
   * @private
   * @param {string} content - Contenu du fichier
   * @param {string} identifier - Identifiant
   * @param {number} importLine - Ligne de l'import
   * @returns {boolean} true si utilisé
   */
  _isIdentifierUsed(content, identifier, importLine) {
    const lines = content.split('\n');
    
    // Chercher l'identifiant après la ligne d'import
    for (let i = importLine; i < lines.length; i++) {
      const line = lines[i];
      
      // Ignorer les commentaires
      if (line.trim().startsWith('//')) continue;
      
      // Vérifier si l'identifiant est présent (pas dans un string)
      const regex = new RegExp(`\\b${identifier}\\b(?![^"]*"(?:(?:\\\\.|[^"\\\\])*\\")*[^"]*$)`, 'g');
      if (regex.test(line)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Génère un rapport d'analyse
   * @param {Object} analysis - Résultat de l'analyse
   * @returns {Object} Rapport
   */
  generateReport(analysis) {
    return {
      summary: {
        totalFiles: analysis.imports.reduce((acc, i) => {
          acc.add(i.file);
          return acc;
        }, new Set()).size,
        totalImports: analysis.imports.length,
        uniquePackages: analysis.missing.length + (analysis.knownDependencies?.length || 0)
      },
      importsByType: this._groupBy(analysis.imports, 'type'),
      importsByFile: this._groupBy(analysis.imports, 'file'),
      missingDependencies: analysis.missing.map(m => ({
        name: m.name,
        occurrences: m.count,
        files: [...new Set(m.locations.map(l => l.file))].length
      })),
      recommendations: this._generateRecommendations(analysis.missing)
    };
  }

  /**
   * Groupe un tableau par propriété
   * @private
   * @param {Array} arr - Tableau
   * @param {string} prop - Propriété
   * @returns {Object} Objet groupé
   */
  _groupBy(arr, prop) {
    return arr.reduce((acc, item) => {
      const key = item[prop];
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  /**
   * Génère des recommandations
   * @private
   * @param {Array} missing - Dépendances manquantes
   * @returns {Array} Recommandations
   */
  _generateRecommendations(missing) {
    return missing.map(m => ({
      package: m.name,
      command: `npm install ${m.name}`,
      reason: `Importé dans ${m.count} fichier(s)`,
      priority: m.count > 5 ? 'high' : m.count > 2 ? 'medium' : 'low'
    }));
  }
}

export default ImportAnalyzer;
