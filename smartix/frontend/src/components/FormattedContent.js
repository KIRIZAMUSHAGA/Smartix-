import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

/**
 * Composant pour formater le contenu des posts avec des mentions cliquables
 */
const FormattedContent = ({ content, className = "" }) => {
  const navigate = useNavigate();

  if (!content) return null;

  // Regex pour détecter les mentions @username
  // On capture le username sans le @
  const parts = content.split(/(@\w+)/g);

  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${username}`);
              }}
              className="text-blue-500 hover:underline cursor-pointer font-medium"
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </p>
  );
};

FormattedContent.propTypes = {
  content: PropTypes.string.isRequired,
  className: PropTypes.string
};

export default FormattedContent;
