import { useState, useEffect, useCallback } from 'react';
import CodeValidator from './CodeValidator';

const LEVEL_COLORS = {
  debutant: '#27ae60',
  intermediaire: '#e67e22',
  avance: '#e74c3c',
  expert: '#8e44ad',
};

const TYPE_ICONS = {
  theorie: '📖',
  exercice: '💻',
  quiz: '❓',
  projet: '🚀',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : Carte d'un jour
// ─────────────────────────────────────────────────────────────────────────────

const DayCard = ({ day, isLocked, isCompleted, onClick }) => (
  <div
    onClick={!isLocked ? onClick : undefined}
    style={{
      background: isCompleted ? '#1a472a' : isLocked ? '#1a1a2e' : '#16213e',
      border: `2px solid ${isCompleted ? '#27ae60' : isLocked ? '#333' : '#0f3460'}`,
      borderRadius: 12,
      padding: '16px',
      cursor: isLocked ? 'not-allowed' : 'pointer',
      opacity: isLocked ? 0.5 : 1,
      transition: 'transform 0.2s, border-color 0.2s',
      position: 'relative',
      minHeight: 110,
    }}
    onMouseEnter={e => {
      if (!isLocked) e.currentTarget.style.transform = 'translateY(-3px)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>JOUR {day.day}</span>
      {isLocked && <span style={{ fontSize: 16 }}>🔒</span>}
      {isCompleted && <span style={{ fontSize: 16 }}>✅</span>}
    </div>
    <div style={{ color: '#e0e0e0', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>
      {day.title}
    </div>
    <div style={{ color: '#888', fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
      {day.description}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{
        background: LEVEL_COLORS[day.level] || '#555',
        color: '#fff',
        borderRadius: 20,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
      }}>
        {day.level}
      </span>
      <span style={{ color: '#666', fontSize: 12 }}>
        {day.completed_lessons || 0}/{day.total_lessons} leçons
      </span>
    </div>
    {!isLocked && !isCompleted && (
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: `${((day.completed_lessons || 0) / day.total_lessons) * 100}%`,
        height: 3,
        background: '#27ae60',
        borderRadius: '0 0 0 10px',
        transition: 'width 0.5s ease',
      }} />
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : Visualiseur de leçon
// ─────────────────────────────────────────────────────────────────────────────

const LessonViewer = ({ day, progress, onClose, onComplete }) => {
  const [selectedLesson, setSelectedLesson] = useState(day.lessons[0] || null);
  const [code, setCode] = useState(selectedLesson?.code_stub || '');
  const [showSolution, setShowSolution] = useState(false);
  const [xpGained, setXpGained] = useState(null);

  useEffect(() => {
    if (selectedLesson) {
      setCode(selectedLesson.code_stub || '');
      setShowSolution(false);
      setXpGained(null);
    }
  }, [selectedLesson]);

  const handleValidationComplete = (success, result) => {
    if (success) {
      setXpGained(selectedLesson.xp_reward);
      onComplete(selectedLesson.id, selectedLesson.xp_reward);
    }
  };

  const isLessonCompleted = (lessonId) =>
    progress?.completed_lessons?.includes(lessonId);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: '#0d1117',
        border: '1px solid #30363d',
        borderRadius: 16,
        width: '100%', maxWidth: 900,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* En-tête */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #30363d',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#161b22',
        }}>
          <div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
              📅 Jour {day.day}
            </div>
            <h2 style={{ color: '#e0e0e0', margin: 0, fontSize: 18 }}>{day.title}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid #30363d',
              color: '#e0e0e0', borderRadius: 8,
              padding: '6px 14px', cursor: 'pointer', fontSize: 14,
            }}
          >
            ✕ Fermer
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Liste des leçons du jour */}
          <div style={{
            width: 220, borderRight: '1px solid #30363d',
            padding: 16, overflowY: 'auto',
            background: '#0d1117',
          }}>
            <div style={{ color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              LEÇONS
            </div>
            {day.lessons.map((lesson, idx) => {
              const completed = isLessonCompleted(lesson.id);
              const selected = selectedLesson?.id === lesson.id;
              return (
                <div
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  style={{
                    padding: '10px 12px',
                    marginBottom: 8,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selected ? '#1f6feb20' : 'transparent',
                    border: `1px solid ${selected ? '#1f6feb' : '#30363d'}`,
                    color: completed ? '#27ae60' : '#c9d1d9',
                    fontSize: 13,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span>{TYPE_ICONS[lesson.type] || '📄'}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>
                      {idx + 1}. {lesson.title}
                    </span>
                    {completed && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✅</span>}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: 11 }}>
                    +{lesson.xp_reward} XP
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contenu de la leçon */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {selectedLesson ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 24 }}>
                    {TYPE_ICONS[selectedLesson.type] || '📄'}
                  </span>
                  <div>
                    <h3 style={{ color: '#e6edf3', margin: 0 }}>{selectedLesson.title}</h3>
                    <span style={{
                      background: LEVEL_COLORS[selectedLesson.level] || '#555',
                      color: '#fff', borderRadius: 20,
                      padding: '2px 10px', fontSize: 11,
                    }}>
                      {selectedLesson.level}
                    </span>
                  </div>
                  <span style={{
                    marginLeft: 'auto',
                    background: '#1f6feb20',
                    border: '1px solid #1f6feb',
                    color: '#58a6ff',
                    borderRadius: 20,
                    padding: '4px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                  }}>
                    +{selectedLesson.xp_reward} XP
                  </span>
                </div>

                {/* Contenu markdown simplifié */}
                <div style={{
                  background: '#161b22', borderRadius: 10,
                  padding: 20, marginBottom: 20,
                  color: '#c9d1d9', lineHeight: 1.7,
                  fontSize: 14, whiteSpace: 'pre-wrap',
                  border: '1px solid #30363d',
                }}>
                  {selectedLesson.content}
                </div>

                {/* Zone de code (si exercice ou projet) */}
                {selectedLesson.code_stub !== null && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 8,
                      }}>
                        <span style={{ color: '#8b949e', fontSize: 13 }}>
                          💻 Ton code :
                        </span>
                        {selectedLesson.solution && (
                          <button
                            onClick={() => setShowSolution(!showSolution)}
                            style={{
                              background: 'none',
                              border: '1px solid #30363d',
                              color: showSolution ? '#f0883e' : '#8b949e',
                              borderRadius: 6, padding: '4px 12px',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            {showSolution ? '🙈 Masquer la solution' : '💡 Voir la solution'}
                          </button>
                        )}
                      </div>
                      <textarea
                        value={showSolution ? selectedLesson.solution : code}
                        onChange={e => !showSolution && setCode(e.target.value)}
                        readOnly={showSolution}
                        style={{
                          width: '100%', minHeight: 160,
                          background: '#0d1117',
                          border: '1px solid #30363d',
                          color: '#e6edf3',
                          fontFamily: 'Fira Code, Consolas, monospace',
                          fontSize: 13, borderRadius: 8,
                          padding: 14, resize: 'vertical',
                          boxSizing: 'border-box',
                          lineHeight: 1.6,
                        }}
                        placeholder="// Écris ton code ici..."
                        spellCheck={false}
                      />
                    </div>

                    {/* XP gagné */}
                    {xpGained && (
                      <div style={{
                        background: '#1a472a', border: '1px solid #27ae60',
                        borderRadius: 10, padding: 16, marginBottom: 16,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 28, marginBottom: 4 }}>🎉</div>
                        <div style={{ color: '#27ae60', fontWeight: 700, fontSize: 16 }}>
                          Leçon complétée !
                        </div>
                        <div style={{ color: '#c9d1d9', fontSize: 14, marginTop: 4 }}>
                          +{xpGained} XP gagnés
                        </div>
                      </div>
                    )}

                    {/* Validateur */}
                    {selectedLesson.tests?.length > 0 && (
                      <CodeValidator
                        code={code}
                        language={selectedLesson.id.startsWith('py_') ? 'python' : 'javascript'}
                        tests={selectedLesson.tests}
                        xpReward={selectedLesson.xp_reward}
                        alreadyCompleted={isLessonCompleted(selectedLesson.id)}
                        onValidationComplete={handleValidationComplete}
                      />
                    )}
                  </>
                )}

                {/* Leçon théorique (pas de code) */}
                {selectedLesson.code_stub === null && (
                  <button
                    onClick={() => handleValidationComplete(true, {})}
                    disabled={isLessonCompleted(selectedLesson.id)}
                    style={{
                      width: '100%', padding: '14px',
                      background: isLessonCompleted(selectedLesson.id) ? '#27ae60' : '#238636',
                      color: '#fff', border: 'none',
                      borderRadius: 10, fontSize: 15,
                      fontWeight: 700, cursor: isLessonCompleted(selectedLesson.id) ? 'default' : 'pointer',
                    }}
                  >
                    {isLessonCompleted(selectedLesson.id) ? '✅ Leçon complétée' : '✔️ Marquer comme lu'}
                  </button>
                )}
              </>
            ) : (
              <div style={{ color: '#8b949e', textAlign: 'center', marginTop: 60 }}>
                Sélectionne une leçon pour commencer
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal : CurriculumView
// ─────────────────────────────────────────────────────────────────────────────

const CurriculumView = ({ user }) => {
  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadCurriculum(), loadProgress()]);
    setLoading(false);
  };

  const loadCurriculum = async () => {
    try {
      const res = await fetch('/api/curriculum');
      if (res.ok) setDays(await res.json());
    } catch (e) {
      console.error('Erreur curriculum:', e);
    }
  };

  const loadProgress = async () => {
    try {
      const res = await fetch('/api/user/progress');
      if (res.ok) setProgress(await res.json());
    } catch (e) {
      console.error('Erreur progression:', e);
    }
  };

  const completeLesson = useCallback(async (lessonId, xp) => {
    try {
      const res = await fetch('/api/user/complete-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_id: lessonId, xp_earned: xp }),
      });
      const result = await res.json();
      if (result.completed) {
        setProgress(prev => ({
          ...prev,
          completed_lessons: [...(prev?.completed_lessons || []), lessonId],
          total_xp: result.total_xp,
          level: result.new_level,
          streak_days: result.streak,
        }));
      }
    } catch (e) {
      console.error('Erreur validation leçon:', e);
    }
  }, []);

  const enrichedDays = days.map(day => {
    const completedInDay = day.lessons?.filter(l =>
      progress?.completed_lessons?.includes(l.id)
    ).length || 0;
    return {
      ...day,
      completed_lessons: completedInDay,
      completed: completedInDay === (day.total_lessons || 1),
    };
  });

  const filteredDays = enrichedDays.filter(day => {
    const matchSearch = !searchQuery ||
      day.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      day.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLevel = filterLevel === 'all' || day.level === filterLevel;
    return matchSearch && matchLevel;
  });

  const totalCompleted = progress?.completed_lessons?.length || 0;
  const totalLessons = days.reduce((sum, d) => sum + (d.total_lessons || 0), 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d1117',
      color: '#e6edf3',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* En-tête héro */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1f2937 100%)',
        borderBottom: '1px solid #30363d',
        padding: '32px 40px',
      }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>
          📚 100 Days of Code
        </h1>
        <p style={{ color: '#8b949e', margin: '0 0 24px', fontSize: 15 }}>
          Deviens développeur en 100 jours — étape par étape
        </p>

        {/* Statistiques utilisateur */}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            { value: progress?.total_xp || 0, label: 'XP Total', icon: '⭐' },
            { value: `Niv. ${progress?.level || 1}`, label: 'Niveau', icon: '🏅' },
            { value: `🔥 ${progress?.streak_days || 0}`, label: 'Streak jours', icon: null },
            { value: totalCompleted, label: 'Leçons terminées', icon: '✅' },
            { value: `${overallPct}%`, label: 'Progression', icon: '📈' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 12, padding: '14px 20px',
              textAlign: 'center', minWidth: 100,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#58a6ff' }}>
                {stat.value}
              </div>
              <div style={{ color: '#8b949e', fontSize: 12, marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Barre de progression globale */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#8b949e', fontSize: 13 }}>Progression globale</span>
            <span style={{ color: '#58a6ff', fontSize: 13, fontWeight: 700 }}>{overallPct}%</span>
          </div>
          <div style={{ background: '#30363d', borderRadius: 999, height: 8, overflow: 'hidden' }}>
            <div style={{
              width: `${overallPct}%`, height: '100%',
              background: 'linear-gradient(90deg, #1f6feb, #58a6ff)',
              borderRadius: 999, transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div style={{
        padding: '20px 40px',
        display: 'flex', gap: 12, flexWrap: 'wrap',
        alignItems: 'center',
        borderBottom: '1px solid #21262d',
      }}>
        <input
          type="text"
          placeholder="🔍 Rechercher une leçon..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: '#161b22', border: '1px solid #30363d',
            color: '#e6edf3', borderRadius: 8,
            padding: '8px 14px', fontSize: 14,
            outline: 'none', flex: '1', minWidth: 200,
          }}
        />
        {['all', 'debutant', 'intermediaire', 'avance', 'expert'].map(level => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            style={{
              background: filterLevel === level
                ? (LEVEL_COLORS[level] || '#1f6feb')
                : '#161b22',
              border: `1px solid ${filterLevel === level ? (LEVEL_COLORS[level] || '#1f6feb') : '#30363d'}`,
              color: '#e6edf3', borderRadius: 20,
              padding: '6px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {level === 'all' ? 'Tous' : level}
          </button>
        ))}
      </div>

      {/* Grille des jours */}
      <div style={{ padding: '32px 40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#8b949e', padding: 60 }}>
            Chargement du curriculum...
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {filteredDays.map(day => {
                const isLocked = day.day > ((progress?.current_day || 1) + 3);
                return (
                  <DayCard
                    key={day.day}
                    day={day}
                    isLocked={isLocked}
                    isCompleted={day.completed}
                    onClick={() => setSelectedDay(day)}
                  />
                );
              })}
            </div>
            {filteredDays.length === 0 && (
              <div style={{ textAlign: 'center', color: '#8b949e', padding: 60 }}>
                Aucun résultat pour cette recherche
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal leçon */}
      {selectedDay && (
        <LessonViewer
          day={selectedDay}
          progress={progress}
          onClose={() => setSelectedDay(null)}
          onComplete={completeLesson}
        />
      )}
    </div>
  );
};

export default CurriculumView;
