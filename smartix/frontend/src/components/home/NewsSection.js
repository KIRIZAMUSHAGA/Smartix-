import React from 'react';

import PropTypes from 'prop-types';

const NewsSection = ({ news = [] }) => {
  if (!news || news.length === 0) return null;

  return (
    <section className="news-section py-4">
      <h2 className="text-lg font-semibold mb-3">Actualités</h2>
      <div className="space-y-3">
        {news.map((item, index) => (
          <div key={item.id || index} className="bg-white rounded-lg p-4 shadow-sm">
            {item.image && (
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-40 object-cover rounded-md mb-2"
              />
            )}
            <h3 className="font-medium text-sm">{item.title}</h3>
            {item.summary && (
              <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.summary}</p>
            )}
            {item.date && (
              <span className="text-gray-400 text-xs mt-1 block">{item.date}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

NewsSection.propTypes = {
  news: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    content: PropTypes.string
  }))
};

export default NewsSection;
