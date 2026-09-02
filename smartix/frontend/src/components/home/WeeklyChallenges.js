import React from 'react';

import PropTypes from 'prop-types';

const WeeklyChallenges = ({ challenges = [] }) => {
  if (!challenges || challenges.length === 0) return null;

  return (
    <section className="weekly-challenges py-4">
      <h2 className="text-lg font-semibold mb-3">Défis de la semaine</h2>
      <div className="space-y-3">
        {challenges.map((challenge, index) => (
          <div key={challenge.id || index} className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
            <h3 className="font-medium text-sm">{challenge.title}</h3>
            {challenge.description && (
              <p className="text-gray-500 text-xs mt-1">{challenge.description}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              {challenge.points && (
                <span className="text-blue-600 text-xs font-semibold">+{challenge.points} pts</span>
              )}
              {challenge.deadline && (
                <span className="text-gray-400 text-xs">Fin : {challenge.deadline}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

WeeklyChallenges.propTypes = {
  challenges: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    description: PropTypes.string
  }))
};

export default WeeklyChallenges;
