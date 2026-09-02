import React from 'react';
import TestPost from './TestPost';
import PropTypes from 'prop-types';

const TestFeed = () => {
  const testPosts = [
    {
      id: 1,
      text: "Ceci est un post standard sans arrière-plan.",
      backgroundColor: null,
      backgroundImage: null
    },
    {
      id: 2,
      text: "Ceci est un post avec un arrière-plan de couleur unie.",
      backgroundColor: "#4f46e5",
      backgroundImage: null
    },
    {
      id: 3,
      text: "Ceci est un post avec un dégradé linéaire.",
      backgroundColor: "linear-gradient(to bottom right, #ef4444, #f59e0b)",
      backgroundImage: null
    },
    {
      id: 4,
      text: "Ceci est un post immersif avec une image de fond.",
      backgroundColor: null,
      backgroundImage: "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: 5,
      text: "Dégradé complexe : de l'indigo au cyan.",
      backgroundColor: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
      backgroundImage: null
    }
  ];

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '40px 20px',
      backgroundColor: '#f3f4f6',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: '40px', 
        color: '#111827',
        fontFamily: 'sans-serif'
      }}>
        🛠️ Isolation Test Feed
      </h1>
      
      {testPosts.map(post => (
        <TestPost 
          key={post.id}
          text={post.text}
          backgroundColor={post.backgroundColor}
          backgroundImage={post.backgroundImage}
        />
      ))}
    </div>
  );
};

TestFeed.propTypes = {};

export default TestFeed;
