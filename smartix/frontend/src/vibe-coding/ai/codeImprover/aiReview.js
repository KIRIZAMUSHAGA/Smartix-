/**
 * Revue de code par IA
 * Suggestions intelligentes basées sur le contexte
 */

export class AIReview {
  constructor() {
    this.patterns = {
      security: [
        { pattern: /password|token|secret|key/i, message: 'Données sensibles détectées' },
        { pattern: /eval\(/, message: 'Utilisation dangereuse de eval()' }
      ],
      performance: [
        { pattern: /\.map\(.*\)\.filter\(/, message: 'Double itération' },
        { pattern: /setState\(.*\)/g, message: 'État React' }
      ],
      ux: [
        { pattern: /<button[^>]*>(?!.*<\/button>)/, message: 'Bouton sans texte' },
        { pattern: /<img[^>]*>(?!.*alt=)/, message: 'Image sans alt' }
      ]
    };
  }

  async review(code, language) {
    const review = {
      summary: '',
      suggestions: [],
      security: [],
      performance: [],
      bestPractices: []
    };

    // Analyse pattern
    Object.entries(this.patterns).forEach(([category, patterns]) => {
      patterns.forEach(({ pattern, message }) => {
        const matches = code.match(pattern);
        if (matches) {
          review[category].push({
            message,
            count: matches.length,
            examples: matches.slice(0, 3)
          });
        }
      });
    });

    // Suggestions générales
    if (code.length > 1000) {
      review.suggestions.push('Envisager de découper ce fichier en modules plus petits');
    }

    if (code.includes('function') && code.includes('class')) {
      review.suggestions.push('Mélange de paradigmes fonctionnel et OOP');
    }

    if (code.includes('console.log')) {
      review.suggestions.push('Nettoyer les logs de développement');
    }

    // Résumé
    const totalIssues = review.security.length + review.performance.length + review.bestPractices.length;
    review.summary = totalIssues === 0 
      ? '✅ Code propre !' 
      : `⚠️ ${totalIssues} point(s) d\'amélioration identifié(s)`;

    return review;
  }
}
