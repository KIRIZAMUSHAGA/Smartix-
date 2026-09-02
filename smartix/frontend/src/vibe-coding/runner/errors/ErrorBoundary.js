/**
 * ErrorBoundary
 * Composant React pour capturer les erreurs dans l'arbre de composants
 */

import React from 'react';
import PropTypes from 'prop-types';
import { SuggestionEngine } from './SuggestionEngine';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      error: null, 
      errorInfo: null,
      suggestion: null
    };
    
    this.suggestionEngine = new SuggestionEngine();
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ 
      errorInfo,
      suggestion: this.suggestionEngine.getDetailedSuggestion(error.message, {
        component: errorInfo.componentStack?.split('\n')[1]?.trim(),
        stack: errorInfo.componentStack
      })
    });

    // Appeler le callback onError si fourni
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Logger l'erreur
    console.error('❌ ErrorBoundary caught:', error);
    console.error('📍 Component stack:', errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null, errorInfo: null, suggestion: null });
  };

  handleCopyError = () => {
    const errorText = `
Error: ${this.state.error?.toString()}
Stack: ${this.state.error?.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
Timestamp: ${new Date().toISOString()}
    `.trim();
    
    navigator.clipboard?.writeText(errorText);
  };

  render() {
    if (this.state.error) {
      // Utiliser le fallback personnalisé si fourni
      if (this.props.fallback) {
        return this.props.fallback(
          this.state.error, 
          this.state.errorInfo,
          this.handleReset
        );
      }

      const { suggestion } = this.state;

      return (
        <div className="error-boundary">
          <div className="error-boundary-header">
            <span className="error-icon">⚠️</span>
            <h3>Une erreur est survenue</h3>
          </div>
          
          <div className="error-boundary-content">
            {/* Message d'erreur */}
            <div className="error-message">
              {this.state.error.toString()}
            </div>

            {/* Suggestion */}
            {suggestion && (
              <div className="error-suggestion">
                <h4>💡 {suggestion.title}</h4>
                <p>{suggestion.description}</p>
                
                {suggestion.solution && (
                  <div className="suggestion-solution">
                    <strong>Solution :</strong>
                    <p>{suggestion.solution}</p>
                  </div>
                )}

                {suggestion.example && (
                  <div className="suggestion-example">
                    <strong>Exemple :</strong>
                    <pre>{suggestion.example}</pre>
                  </div>
                )}

                {suggestion.steps && suggestion.steps.length > 0 && (
                  <div className="suggestion-steps">
                    <strong>Étapes de débogage :</strong>
                    <ol>
                      {suggestion.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {suggestion.references && (
                  <div className="suggestion-references">
                    <strong>Documentation :</strong>
                    <ul>
                      {suggestion.references.map((ref, i) => (
                        <li key={i}>
                          <a href={ref} target="_blank" rel="noopener noreferrer">
                            {ref}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Détails techniques */}
            <details className="error-details">
              <summary>Détails techniques</summary>
              <div className="error-stack">
                <strong>Stack trace :</strong>
                <pre>{this.state.error?.stack}</pre>
              </div>
              {this.state.errorInfo && (
                <div className="error-component-stack">
                  <strong>Composants :</strong>
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </details>

            {/* Actions */}
            <div className="error-actions">
              <button 
                className="error-button primary"
                onClick={this.handleReload}
              >
                🔄 Recharger la page
              </button>
              
              <button 
                className="error-button"
                onClick={this.handleReset}
              >
                ⏺️ Ignorer
              </button>
              
              <button 
                className="error-button"
                onClick={this.handleCopyError}
                title="Copier l'erreur"
              >
                📋 Copier
              </button>
            </div>

            {/* Props du composant (en développement) */}
            {process.env.NODE_ENV === 'development' && this.props.showProps && (
              <div className="error-props">
                <strong>Props du composant :</strong>
                <pre>{JSON.stringify(this.props, null, 2)}</pre>
              </div>
            )}
          </div>

          <style jsx>{`
            .error-boundary {
              background: #2d2d2d;
              border: 2px solid #f48771;
              border-radius: 8px;
              margin: 20px;
              overflow: hidden;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #d4d4d4;
            }

            .error-boundary-header {
              background: #5a2e2e;
              padding: 16px 20px;
              display: flex;
              align-items: center;
              gap: 12px;
              border-bottom: 1px solid #f48771;
            }

            .error-icon {
              font-size: 24px;
            }

            .error-boundary-header h3 {
              margin: 0;
              color: #fff;
              font-size: 18px;
            }

            .error-boundary-content {
              padding: 20px;
            }

            .error-message {
              color: #f48771;
              font-family: monospace;
              padding: 12px;
              background: #1e1e1e;
              border-radius: 6px;
              margin-bottom: 20px;
              font-size: 14px;
              border-left: 4px solid #f48771;
            }

            .error-suggestion {
              background: #1e3a5f;
              padding: 16px;
              border-radius: 6px;
              margin-bottom: 20px;
              border-left: 4px solid #007bff;
            }

            .error-suggestion h4 {
              margin: 0 0 12px 0;
              color: #007bff;
              font-size: 16px;
            }

            .error-suggestion p {
              margin: 8px 0;
              line-height: 1.5;
            }

            .suggestion-solution,
            .suggestion-example,
            .suggestion-steps,
            .suggestion-references {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid #3e3e3e;
            }

            .suggestion-example pre {
              background: #1e1e1e;
              padding: 12px;
              border-radius: 4px;
              overflow-x: auto;
              font-family: monospace;
              font-size: 13px;
              margin: 8px 0 0 0;
            }

            .suggestion-steps ol {
              margin: 8px 0 0 20px;
              padding: 0;
            }

            .suggestion-steps li {
              margin: 4px 0;
            }

            .suggestion-references ul {
              margin: 8px 0 0 20px;
              padding: 0;
            }

            .suggestion-references a {
              color: #007bff;
              text-decoration: none;
            }

            .suggestion-references a:hover {
              text-decoration: underline;
            }

            .error-details {
              margin-bottom: 20px;
            }

            .error-details summary {
              cursor: pointer;
              color: #888;
              padding: 8px;
              background: #2d2d2d;
              border-radius: 4px;
              font-weight: bold;
            }

            .error-details summary:hover {
              background: #3e3e3e;
            }

            .error-stack,
            .error-component-stack {
              margin-top: 12px;
            }

            .error-stack pre,
            .error-component-stack pre {
              background: #1e1e1e;
              padding: 12px;
              border-radius: 4px;
              overflow-x: auto;
              font-family: monospace;
              font-size: 12px;
              margin: 8px 0 0 0;
              white-space: pre-wrap;
              word-break: break-word;
            }

            .error-actions {
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }

            .error-button {
              padding: 10px 20px;
              background: #3e3e3e;
              border: none;
              border-radius: 6px;
              color: #d4d4d4;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
              display: inline-flex;
              align-items: center;
              gap: 6px;
            }

            .error-button:hover {
              background: #4e4e4e;
              transform: translateY(-1px);
            }

            .error-button.primary {
              background: #007bff;
              color: white;
            }

            .error-button.primary:hover {
              background: #0056b3;
            }

            .error-props {
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #3e3e3e;
            }

            .error-props pre {
              background: #1e1e1e;
              padding: 12px;
              border-radius: 4px;
              overflow-x: auto;
              margin: 8px 0 0 0;
            }

            @media (max-width: 768px) {
              .error-boundary {
                margin: 10px;
              }
              
              .error-actions {
                flex-direction: column;
              }
              
              .error-button {
                width: 100%;
                justify-content: center;
              }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.func,
  onError: PropTypes.func,
};

export default ErrorBoundary;
