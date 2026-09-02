/**
 * Point d'entrée du module Code Improver
 * Version modulaire avec AST et règles séparées
 */

import { Analyzer } from './analyzer';
import { RefactorEngine } from './refactorEngine';
import { Optimizer } from './optimizer';
import { MetricsCalculator } from './metrics';
import { AIReview } from './aiReview';

// Imports React pour le hook
import { useState, useEffect, useRef, useCallback } from 'react';

export class CodeImprover {
  constructor() {
    this.analyzer = new Analyzer();
    this.refactorEngine = new RefactorEngine();
    this.optimizer = new Optimizer();
    this.metrics = new MetricsCalculator();
    this.aiReview = new AIReview();
    
    this.initialized = false;
    this.analysisHistory = [];
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.analyzer.initialize();
      await this.refactorEngine.initialize();
      this.initialized = true;
      console.log('✅ CodeImprover initialized');
    } catch (error) {
      console.error('❌ CodeImprover initialization failed:', error);
      throw error;
    }
  }

  async analyzeCode(code, language = 'javascript', options = {}) {
    const ast = await this.analyzer.parseToAST(code, language);
    const issues = await this.analyzer.findIssues(ast, language);
    const metrics = this.metrics.calculate(ast, code);
    const suggestions = await this.refactorEngine.suggestRefactors(ast, language);
    
    const analysis = {
      issues,
      suggestions,
      metrics,
      qualityScore: this._calculateQualityScore(issues, metrics),
      timestamp: new Date().toISOString()
    };

    this.analysisHistory.push(analysis);
    return analysis;
  }

  async improveCode(code, language = 'javascript', options = {}) {
    const ast = await this.analyzer.parseToAST(code, language);
    const improvedAst = await this.refactorEngine.applyAutoFixes(ast, language);
    const optimizedAst = await this.optimizer.optimize(improvedAst, language);
    
    return this.analyzer.generateCode(optimizedAst, language);
  }

  async analyzeProject(projectId, userId) {
    // Implémentation existante...
  }

  async aiReview(code, language = 'javascript') {
    return this.aiReview.review(code, language);
  }

  async suggestFixes(code, language = 'javascript') {
    const ast = await this.analyzer.parseToAST(code, language);
    return this.refactorEngine.suggestFixes(ast, language);
  }

  async applyFix(code, fixId, language = 'javascript') {
    const ast = await this.analyzer.parseToAST(code, language);
    const fixedAst = await this.refactorEngine.applyFix(ast, fixId, language);
    return this.analyzer.generateCode(fixedAst, language);
  }

  _calculateQualityScore(issues, metrics) {
    const baseScore = 100;
    const issuePenalty = issues.reduce((acc, issue) => {
      const penalty = issue.severity === 'error' ? 5 : 
                      issue.severity === 'warning' ? 2 : 1;
      return acc + penalty;
    }, 0);

    return Math.max(0, Math.min(100, baseScore - issuePenalty));
  }
}

// Hook React
export const useCodeImprover = () => {
  const [loading, setLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [previewChanges, setPreviewChanges] = useState(null);
  const improver = useRef(null);

  useEffect(() => {
    improver.current = new CodeImprover();
    improver.current.initialize().catch(console.error);
  }, []);

  const analyzeCode = useCallback(async (code, language, options) => {
    setLoading(true);
    try {
      const result = await improver.current.analyzeCode(code, language, options);
      setLastAnalysis(result);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const improveCode = useCallback(async (code, language, options) => {
    setLoading(true);
    try {
      return await improver.current.improveCode(code, language, options);
    } finally {
      setLoading(false);
    }
  }, []);

  const suggestFixes = useCallback(async (code, language) => {
    return improver.current.suggestFixes(code, language);
  }, []);

  const previewFix = useCallback(async (code, fixId, language) => {
    const fixed = await improver.current.applyFix(code, fixId, language);
    setPreviewChanges({ original: code, fixed, fixId });
    return fixed;
  }, []);

  return {
    loading,
    lastAnalysis,
    previewChanges,
    analyzeCode,
    improveCode,
    suggestFixes,
    previewFix,
    aiReview: useCallback((code, lang) => improver.current.aiReview(code, lang), [])
  };
};

export default CodeImprover;
