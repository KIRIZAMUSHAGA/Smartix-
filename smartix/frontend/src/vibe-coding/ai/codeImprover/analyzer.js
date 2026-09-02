/**
 * Analyseur de code utilisant AST
 * Évite les problèmes de regex globales
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

import { performanceRules } from './rules/performanceRules';
import { securityRules } from './rules/securityRules';
import { reactRules } from './rules/reactRules';
import { bestPractices } from './rules/bestPractices';

export class Analyzer {
  constructor() {
    this.parsers = {
      javascript: (code) => parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }),
      typescript: (code) => parser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] }),
      jsx: (code) => parser.parse(code, { sourceType: 'module', plugins: ['jsx'] })
    };
    
    this.rules = {
      ...performanceRules,
      ...securityRules,
      ...reactRules,
      ...bestPractices
    };
  }

  async initialize() {
    console.log('✅ Analyzer initialized');
  }

  async parseToAST(code, language = 'javascript') {
    try {
      const parserFn = this.parsers[language] || this.parsers.javascript;
      return parserFn(code);
    } catch (error) {
      console.error('AST parsing error:', error);
      throw new Error(`Failed to parse ${language} code`);
    }
  }

  async findIssues(ast, language = 'javascript') {
    const issues = [];

    // Parcourir l'AST une seule fois
    traverse(ast, {
      enter: (path) => {
        // Appliquer toutes les règles
        Object.values(this.rules).forEach(rule => {
          if (rule.condition(path)) {
            issues.push({
              rule: rule.name,
              message: rule.message,
              severity: rule.severity,
              loc: path.node.loc,
              fix: rule.fix ? rule.fix(path) : null
            });
          }
        });
      }
    });

    return issues;
  }

  generateCode(ast) {
    return generate(ast).code;
  }

  async findLineNumber(ast, nodeType, pattern) {
    let lineNumber = -1;
    
    traverse(ast, {
      enter(path) {
        if (path.node.type === nodeType) {
          const code = generate(path.node).code;
          if (code.includes(pattern)) {
            lineNumber = path.node.loc?.start?.line || -1;
            path.stop();
          }
        }
      }
    });

    return lineNumber;
  }
}
