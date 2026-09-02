
import React, { useState, useEffect, useCallback } from 'react';
import TimerBar from './TimerBar';
import ConfettiEffect from './ConfettiEffect';
import { playSuccess, playError, playTimeover } from '../utils/soundPlayer';
import { Button } from './ui/button';
import { Card } from './ui/card';
import PropTypes from 'prop-types';

/**
 * QuizPage - Affiche une question de quiz
 * Props:
 * - question: object - { text, choices: [{text, isCorrect}] }
 * - questionNumber: number - Numéro de la question
 * - totalQuestions: number - Total de questions
 * - timePerQuestion: number - Temps en secondes
 * - onAnswer: function - Callback (isCorrect, timeSpent, choiceIndex)
 * - onNext: function - Callback pour passer à la question suivante
 */
const QuizPage = ({ 
  question, 
  questionNumber, 
  totalQuestions, 
  timePerQuestion = 30,
  onAnswer,
  onNext
}) => {
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [startTime] = useState(Date.now());
  const [showConfetti, setShowConfetti] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Empêcher sélection de texte (anti-triche)
  useEffect(() => {
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = 'auto';
    };
  }, []);

  // Bloquer navigation arrière
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = (e) => {
      e.preventDefault();
      alert('Impossible de revenir en arrière pendant le quiz');
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(null, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleTimeOut = useCallback(() => {
    if (isAnswered || isTimedOut) return;

    setIsTimedOut(true);
    playTimeover();

    const timeSpent = Date.now() - startTime;
    if (onAnswer) {
      onAnswer(false, timeSpent, -1);
    }

    setTimeout(() => {
      if (onNext) onNext();
    }, 800);
  }, [isAnswered, isTimedOut, onAnswer, onNext, startTime]);

  const handleChoiceClick = (index) => {
    if (isAnswered || isTimedOut) return;

    setSelectedChoice(index);
    setIsAnswered(true);

    const timeSpent = Date.now() - startTime;
    const isCorrect = question.choices[index].isCorrect;

    if (onAnswer) {
      onAnswer(isCorrect, timeSpent, index);
    }

    if (isCorrect) {
      playSuccess();
      setShowConfetti(true);
      setTimeout(() => {
        if (onNext) onNext();
      }, 900);
    } else {
      playError();
      setTimeout(() => {
        if (onNext) onNext();
      }, 800);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      {showConfetti && <ConfettiEffect />}

      <div className="max-w-4xl mx-auto py-8">
        {/* En-tête */}
        <div className="mb-6">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Question {questionNumber} / {totalQuestions}
          </div>
          <TimerBar 
            duration={timePerQuestion} 
            onTimeOut={handleTimeOut}
            isActive={!isAnswered && !isTimedOut}
          />
        </div>

        {/* Question */}
        <Card className="p-8 mb-6 bg-white dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            {question.text}
          </h2>

          {/* Choix */}
          <div className="space-y-4">
            {question.choices.map((choice, index) => {
              const isSelected = selectedChoice === index;
              const isCorrect = choice.isCorrect;
              const showResult = isAnswered && isSelected;

              let buttonClass = 'w-full p-6 text-left text-lg border-2 rounded-lg transition-all ';
              
              if (showResult) {
                if (isCorrect) {
                  buttonClass += 'border-green-500 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-100 answer-correct';
                } else {
                  buttonClass += 'border-red-500 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-100';
                }
              } else if (isAnswered || isTimedOut) {
                buttonClass += 'border-gray-300 bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed';
              } else {
                buttonClass += 'border-gray-300 hover:border-[#00B894] hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer';
              }

              return (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(index)}
                  disabled={isAnswered || isTimedOut}
                  className={buttonClass}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{choice.text}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {isTimedOut && (
          <div className="text-center text-red-600 dark:text-red-400 font-semibold">
            ⏱️ Temps écoulé ! Passage à la question suivante...
          </div>
        )}
      </div>
    </div>
  );
};

QuizPage.propTypes = {
  question: PropTypes.object.isRequired,
  questionNumber: PropTypes.any.isRequired,
  totalQuestions: PropTypes.any.isRequired,
  timePerQuestion: PropTypes.any,
  onAnswer: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

export default QuizPage;
