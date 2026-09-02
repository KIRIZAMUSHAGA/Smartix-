
import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import '../styles/animations.css';
import PropTypes from 'prop-types';

/**
 * TimerBar - Affiche un timer avec barre de progression
 * Props:
 * - duration: number - Durée en secondes
 * - onTimeOut: function - Callback quand le temps est écoulé
 * - isActive: boolean - Si false, met le timer en pause
 */
const TimerBar = ({ duration, onTimeOut, isActive = true }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onTimeOut) onTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, onTimeOut]);

  const percentage = (timeLeft / duration) * 100;
  const isWarning = timeLeft <= 10;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 ${isWarning ? 'timer-warning text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
          <Clock className="w-5 h-5" />
          <span className="font-bold text-lg">{timeLeft}s</span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {Math.round(percentage)}%
        </span>
      </div>
      
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            isWarning ? 'bg-red-500' : 'bg-gradient-to-r from-[#00B894] to-[#0984E3]'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

TimerBar.propTypes = {
  duration: PropTypes.number.isRequired,
  onTimeOut: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
};

export default TimerBar;
