/**
 * LessonGuide - Panneau latéral de leçons guidées
 * Étapes numérotées, vérification auto, progression persistante
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LESSONS } from './lessonData';

const STORAGE_KEY = 'vibe_lesson_progress';

// =============================
// UTILITAIRES
// =============================

const loadProgress = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveProgress = (progress) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignorer */
  }
};

// =============================
// VUE LISTE DES LEÇONS
// =============================

const LessonList = ({ onSelect, progress }) => {
  return (
    <div style={styles.lessonList}>
      <div style={styles.listTitle}>📚 Leçons disponibles</div>
      {LESSONS.map(lesson => {
        const lessonProg = progress[lesson.id] || {};
        const completedSteps = Object.values(lessonProg).filter(Boolean).length;
        const totalSteps = lesson.steps.length;
        const pct = Math.round((completedSteps / totalSteps) * 100);

        return (
          <div
            key={lesson.id}
            style={styles.lessonCard}
            onClick={() => onSelect(lesson)}
          >
            <div style={styles.lessonCardHeader}>
              <span style={styles.lessonTitle}>{lesson.title}</span>
              <span style={{ ...styles.badge, background: diffColor(lesson.difficulty) }}>
                {lesson.difficulty}
              </span>
            </div>
            <div style={styles.lessonDesc}>{lesson.description}</div>
            <div style={styles.lessonMeta}>
              <span>⏱ {lesson.duration}</span>
              <span style={styles.progressText}>{completedSteps}/{totalSteps} étapes</span>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const diffColor = (diff) => {
  if (diff === 'Débutant') return '#27ae60';
  if (diff === 'Intermédiaire') return '#e67e22';
  return '#c0392b';
};

// =============================
// VUE LEÇON ACTIVE
// =============================

const ActiveLesson = ({ lesson, currentCode, onBack, progress, onProgressChange }) => {
  const lessonProg = progress[lesson.id] || {};
  const [activeStep, setActiveStep] = useState(() => {
    const firstIncomplete = lesson.steps.findIndex(s => !lessonProg[s.id]);
    return firstIncomplete === -1 ? 0 : firstIncomplete;
  });
  const [showHint, setShowHint] = useState(false);
  const [justPassed, setJustPassed] = useState(false);

  const step = lesson.steps[activeStep];
  const isPassed = !!lessonProg[step?.id];

  // Vérification automatique du code
  useEffect(() => {
    if (!step || isPassed) return;
    if (step.validate(currentCode)) {
      const newProg = {
        ...progress,
        [lesson.id]: { ...lessonProg, [step.id]: true },
      };
      onProgressChange(newProg);
      saveProgress(newProg);
      setJustPassed(true);
      setTimeout(() => setJustPassed(false), 2500);
    }
  }, [currentCode, step, isPassed]);

  const goNext = () => {
    if (activeStep < lesson.steps.length - 1) {
      setActiveStep(activeStep + 1);
      setShowHint(false);
    }
  };

  const goPrev = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      setShowHint(false);
    }
  };

  const completedCount = lesson.steps.filter(s => lessonProg[s.id]).length;
  const isLessonComplete = completedCount === lesson.steps.length;

  return (
    <div style={styles.activeLesson}>
      {/* Header */}
      <div style={styles.lessonHeader}>
        <button style={styles.backBtn} onClick={onBack}>← Retour</button>
        <span style={styles.lessonHeaderTitle}>{lesson.title}</span>
      </div>

      {/* Progression globale */}
      <div style={styles.globalProgress}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(completedCount / lesson.steps.length) * 100}%`,
            }}
          />
        </div>
        <span style={styles.progressText}>
          {completedCount}/{lesson.steps.length} étapes complétées
        </span>
      </div>

      {/* Étapes nav */}
      <div style={styles.stepsNav}>
        {lesson.steps.map((s, i) => (
          <button
            key={s.id}
            style={{
              ...styles.stepDot,
              ...(i === activeStep ? styles.stepDotActive : {}),
              ...(lessonProg[s.id] ? styles.stepDotDone : {}),
            }}
            onClick={() => setActiveStep(i)}
            title={s.title}
          >
            {lessonProg[s.id] ? '✓' : i + 1}
          </button>
        ))}
      </div>

      {/* Étape courante */}
      {step && (
        <div style={styles.stepContent}>
          <div style={styles.stepNumber}>Étape {activeStep + 1}</div>
          <div style={styles.stepTitle}>{step.title}</div>
          <div style={styles.stepInstruction}>{step.instruction}</div>

          {step.example && (
            <pre style={styles.stepExample}>{step.example}</pre>
          )}

          {/* Indice */}
          {showHint && (
            <div style={styles.hint}>
              <span style={styles.hintIcon}>💡</span>
              <span>{step.hint}</span>
            </div>
          )}

          <div style={styles.stepActions}>
            <button style={styles.hintBtn} onClick={() => setShowHint(!showHint)}>
              {showHint ? 'Cacher l\'indice' : '💡 Indice'}
            </button>
          </div>

          {/* Statut */}
          {justPassed && (
            <div style={styles.successBanner}>🎉 Parfait ! Étape validée !</div>
          )}
          {isPassed && !justPassed && (
            <div style={styles.doneBanner}>✅ Étape complétée</div>
          )}
          {!isPassed && !justPassed && (
            <div style={styles.pendingBanner}>⌨️ Écris le code dans l'éditeur pour valider</div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={styles.navButtons}>
        <button
          style={{ ...styles.navBtn, opacity: activeStep === 0 ? 0.4 : 1 }}
          onClick={goPrev}
          disabled={activeStep === 0}
        >
          ← Précédent
        </button>
        <button
          style={{ ...styles.navBtn, ...styles.navBtnNext, opacity: activeStep === lesson.steps.length - 1 ? 0.4 : 1 }}
          onClick={goNext}
          disabled={activeStep === lesson.steps.length - 1}
        >
          Suivant →
        </button>
      </div>

      {/* Fin de leçon */}
      {isLessonComplete && (
        <div style={styles.completeBanner}>
          🏆 Leçon terminée ! Félicitations !
        </div>
      )}
    </div>
  );
};

// =============================
// COMPOSANT PRINCIPAL
// =============================

const LessonGuide = ({ currentCode = '', onClose }) => {
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [progress, setProgress] = useState(loadProgress);

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.panelHeader}>
        <div style={styles.panelTitle}>
          <span>📖</span>
          <span>Leçons guidées</span>
        </div>
        {onClose && (
          <button style={styles.iconBtn} onClick={onClose}>✕</button>
        )}
      </div>

      {/* Contenu */}
      <div style={styles.content}>
        {selectedLesson ? (
          <ActiveLesson
            lesson={selectedLesson}
            currentCode={currentCode}
            onBack={() => setSelectedLesson(null)}
            progress={progress}
            onProgressChange={setProgress}
          />
        ) : (
          <LessonList
            onSelect={setSelectedLesson}
            progress={progress}
          />
        )}
      </div>
    </div>
  );
};

// =============================
// STYLES
// =============================
const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontSize: 13,
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
    flexShrink: 0,
  },
  panelTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 16,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
  },
  lessonList: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  listTitle: {
    fontWeight: 'bold',
    color: '#aaa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  lessonCard: {
    background: '#2a2a2a',
    border: '1px solid #3e3e3e',
    borderRadius: 8,
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  lessonCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#fff',
  },
  badge: {
    borderRadius: 10,
    padding: '2px 8px',
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lessonDesc: {
    color: '#888',
    fontSize: 12,
  },
  lessonMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#666',
    fontSize: 11,
  },
  progressBar: {
    height: 4,
    background: '#3e3e3e',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#007bff',
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  progressText: {
    color: '#888',
    fontSize: 11,
  },
  activeLesson: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 12,
  },
  lessonHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  backBtn: {
    background: 'none',
    border: '1px solid #3e3e3e',
    borderRadius: 4,
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 12,
    padding: '3px 8px',
  },
  lessonHeaderTitle: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#fff',
  },
  globalProgress: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  stepsNav: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '1px solid #3e3e3e',
    background: '#2d2d2d',
    color: '#888',
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  stepDotActive: {
    border: '2px solid #007bff',
    color: '#007bff',
  },
  stepDotDone: {
    background: '#27ae60',
    border: '1px solid #27ae60',
    color: '#fff',
  },
  stepContent: {
    background: '#252525',
    border: '1px solid #3e3e3e',
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  stepNumber: {
    color: '#007bff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  stepTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#fff',
  },
  stepInstruction: {
    color: '#ccc',
    lineHeight: 1.6,
    fontSize: 13,
  },
  stepExample: {
    background: '#1a1a1a',
    border: '1px solid #3e3e3e',
    borderRadius: 4,
    padding: '8px 10px',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#9cdcfe',
    margin: 0,
    overflowX: 'auto',
  },
  hint: {
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: 6,
    padding: '8px 10px',
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    color: '#e2d88f',
    fontSize: 12,
  },
  hintIcon: { fontSize: 14, flexShrink: 0 },
  stepActions: { display: 'flex', gap: 8 },
  hintBtn: {
    background: '#2d3748',
    border: '1px solid #4a5568',
    borderRadius: 4,
    color: '#e2d88f',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 10px',
  },
  successBanner: {
    background: '#1a3d2e',
    border: '1px solid #27ae60',
    borderRadius: 6,
    color: '#2ecc71',
    padding: '8px 12px',
    textAlign: 'center',
    fontWeight: 'bold',
    animation: 'fadein 0.3s',
  },
  doneBanner: {
    background: '#1a3d2e',
    border: '1px solid #27ae60',
    borderRadius: 6,
    color: '#2ecc71',
    padding: '6px 12px',
    textAlign: 'center',
  },
  pendingBanner: {
    background: '#2d2d2d',
    border: '1px solid #3e3e3e',
    borderRadius: 6,
    color: '#888',
    padding: '6px 12px',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  navButtons: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
  },
  navBtn: {
    background: '#2d2d2d',
    border: '1px solid #3e3e3e',
    borderRadius: 6,
    color: '#d4d4d4',
    cursor: 'pointer',
    fontSize: 13,
    padding: '7px 14px',
    transition: 'background 0.2s',
  },
  navBtnNext: {
    background: '#007bff',
    border: '1px solid #007bff',
    color: '#fff',
  },
  completeBanner: {
    background: '#1a1a2e',
    border: '2px solid #ffd700',
    borderRadius: 8,
    color: '#ffd700',
    padding: '12px 16px',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 15,
  },
};

export default LessonGuide;
