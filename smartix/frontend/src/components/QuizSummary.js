
import React from 'react';
import { Trophy, Clock, CheckCircle, XCircle, RotateCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import PropTypes from 'prop-types';

/**
 * QuizSummary - Affiche les résultats du quiz
 * Props:
 * - results: array - [{questionNumber, isCorrect, timeSpent}]
 * - totalQuestions: number
 * - onRestart: function - Callback pour recommencer (série suivante)
 * - onQuit: function - Callback pour quitter
 */
const QuizSummary = ({ results, totalQuestions, onRestart, onQuit }) => {
  const correctCount = results.filter(r => r.isCorrect).length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const totalTime = results.reduce((sum, r) => sum + r.timeSpent, 0);
  const avgTime = Math.round(totalTime / results.length / 1000);

  const isPassed = score >= 70;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* En-tête de résultat */}
        <Card className={`p-8 mb-6 text-center ${
          isPassed 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900 dark:to-emerald-900'
            : 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900 dark:to-red-900'
        }`}>
          <div className="mb-4">
            {isPassed ? (
              <Trophy className="w-20 h-20 mx-auto text-green-600 dark:text-green-400" />
            ) : (
              <RotateCw className="w-20 h-20 mx-auto text-orange-600 dark:text-orange-400" />
            )}
          </div>

          <h1 className="text-3xl font-bold mb-2">
            {isPassed ? 'Félicitations !' : 'Presque réussi !'}
          </h1>

          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            {isPassed 
              ? 'Vous avez validé ce chapitre avec succès !' 
              : 'Relisez le chapitre et réessayez avec une nouvelle série.'}
          </p>

          <div className="text-6xl font-bold mb-2">
            {score}%
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {correctCount} / {totalQuestions} réponses correctes
          </div>
        </Card>

        {/* Statistiques */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="font-semibold">Temps de réponse</h3>
            </div>
            <div className="text-2xl font-bold">{avgTime}s</div>
            <div className="text-sm text-gray-500">Moyenne par question</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-6 h-6 text-yellow-600" />
              <h3 className="font-semibold">Score total</h3>
            </div>
            <div className="text-2xl font-bold">{score}%</div>
            <div className="text-sm text-gray-500">
              {isPassed ? 'Chapitre validé ✓' : 'Minimum requis: 70%'}
            </div>
          </Card>
        </div>

        {/* Détail des réponses */}
        <Card className="p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Détail des réponses</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div 
                key={index}
                className="flex items-center justify-between p-3 rounded bg-gray-50 dark:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  {result.isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span>Question {result.questionNumber}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {Math.round(result.timeSpent / 1000)}s
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          {!isPassed && onRestart && (
            <Button
              onClick={onRestart}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white flex items-center justify-center gap-2"
            >
              <RotateCw className="w-5 h-5" />
              Relire et recommencer
            </Button>
          )}

          <Button
            onClick={onQuit}
            variant="outline"
            className="flex-1 flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            {isPassed ? 'Continuer vers le prochain chapitre' : 'Quitter'}
          </Button>
        </div>
      </div>
    </div>
  );
};

QuizSummary.propTypes = {
  results: PropTypes.array.isRequired,
  totalQuestions: PropTypes.any.isRequired,
  onRestart: PropTypes.func.isRequired,
  onQuit: PropTypes.func.isRequired,
};

export default QuizSummary;
