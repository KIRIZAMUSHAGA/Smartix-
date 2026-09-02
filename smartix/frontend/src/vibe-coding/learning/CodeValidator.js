import { useState } from 'react';

const CodeValidator = ({
  code,
  language = 'javascript',
  tests = [],
  xpReward = 10,
  alreadyCompleted = false,
  onValidationComplete,
}) => {
  const [validating, setValidating] = useState(false);
  const [results, setResults] = useState(null);
  const [attempts, setAttempts] = useState(0);

  const validate = async () => {
    if (!code.trim()) {
      setResults({ error: 'Le code est vide. Écris quelque chose avant de valider !' });
      return;
    }

    setValidating(true);
    setResults(null);

    try {
      const res = await fetch('/api/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, tests }),
      });

      if (!res.ok) {
        throw new Error(`Erreur serveur : ${res.status}`);
      }

      const data = await res.json();
      setResults(data);
      setAttempts(prev => prev + 1);

      if (data.success && onValidationComplete) {
        onValidationComplete(true, { ...data, xp_earned: xpReward });
      }
    } catch (err) {
      setResults({ error: err.message || 'Impossible de valider le code pour l\'instant.' });
    } finally {
      setValidating(false);
    }
  };

  const reset = () => {
    setResults(null);
    setAttempts(0);
  };

  return (
    <div style={{
      background: '#0d1117',
      border: '1px solid #30363d',
      borderRadius: 12,
      padding: 20,
    }}>
      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: results ? 16 : 0 }}>
        <button
          onClick={validate}
          disabled={validating || alreadyCompleted}
          style={{
            flex: 1,
            padding: '12px 0',
            background: alreadyCompleted
              ? '#27ae60'
              : validating
              ? '#1f6feb80'
              : '#238636',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: alreadyCompleted || validating ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {alreadyCompleted
            ? '✅ Déjà complétée'
            : validating
            ? '⏳ Validation en cours...'
            : '✅ Vérifier ma solution'}
        </button>

        {results && !results.success && (
          <button
            onClick={reset}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: '1px solid #30363d',
              color: '#8b949e',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            🔄 Réessayer
          </button>
        )}
      </div>

      {/* Compteur de tentatives */}
      {attempts > 0 && !alreadyCompleted && (
        <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 12, textAlign: 'right' }}>
          {attempts} tentative{attempts > 1 ? 's' : ''}
        </div>
      )}

      {/* Résultats */}
      {results && (
        <div style={{ marginTop: 4 }}>
          {results.error ? (
            <div style={{
              background: '#2d1b1b',
              border: '1px solid #f85149',
              borderRadius: 10,
              padding: 16,
              color: '#f85149',
              fontSize: 14,
            }}>
              ⚠️ {results.error}
            </div>
          ) : (
            <>
              {/* Bannière succès / échec */}
              <div style={{
                background: results.success ? '#1a472a' : '#2d1b1b',
                border: `1px solid ${results.success ? '#27ae60' : '#f85149'}`,
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{
                    color: results.success ? '#27ae60' : '#f85149',
                    fontWeight: 700,
                    fontSize: 16,
                  }}>
                    {results.success ? '🎉 Félicitations !' : '❌ Pas encore correct'}
                  </span>
                  <span style={{
                    background: results.success ? '#27ae6030' : '#f8514920',
                    color: results.success ? '#27ae60' : '#f85149',
                    border: `1px solid ${results.success ? '#27ae60' : '#f85149'}`,
                    borderRadius: 20,
                    padding: '3px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                  }}>
                    {results.passed_count}/{results.total_count} tests
                  </span>
                </div>

                {results.success && (
                  <div style={{ marginTop: 10, color: '#c9d1d9', fontSize: 14 }}>
                    <p style={{ margin: '0 0 6px' }}>✨ Bravo ! Tu as réussi cette leçon.</p>
                    <p style={{ margin: 0, fontWeight: 700, color: '#f0883e' }}>
                      📈 +{xpReward} XP gagnés !
                    </p>
                  </div>
                )}
              </div>

              {/* Détail des tests */}
              {results.results && results.results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {results.results.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: r.passed ? '#1a472a20' : '#2d1b1b',
                        border: `1px solid ${r.passed ? '#27ae6040' : '#f8514940'}`,
                        borderRadius: 8,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>
                        {r.passed ? '✅' : '❌'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <code style={{
                          fontSize: 12,
                          color: r.passed ? '#27ae60' : '#c9d1d9',
                          fontFamily: 'Fira Code, Consolas, monospace',
                          wordBreak: 'break-all',
                          display: 'block',
                        }}>
                          {r.test}
                        </code>
                        {!r.passed && r.error && (
                          <div style={{
                            marginTop: 6,
                            color: '#f85149',
                            fontSize: 12,
                            fontFamily: 'Fira Code, Consolas, monospace',
                            background: '#1a0000',
                            padding: '6px 10px',
                            borderRadius: 6,
                            wordBreak: 'break-all',
                          }}>
                            {r.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Conseil si échec */}
              {!results.success && attempts >= 2 && (
                <div style={{
                  marginTop: 12,
                  background: '#1c2128',
                  border: '1px solid #30363d',
                  borderRadius: 8,
                  padding: 12,
                  color: '#8b949e',
                  fontSize: 13,
                }}>
                  💡 <strong style={{ color: '#e6edf3' }}>Conseil :</strong>{' '}
                  Relis l'énoncé attentivement et vérifie le nom exact des variables.
                  Tu peux aussi cliquer sur "Voir la solution" pour t'aider.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CodeValidator;
