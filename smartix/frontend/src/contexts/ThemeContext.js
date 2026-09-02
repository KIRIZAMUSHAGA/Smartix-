import React, { createContext, useContext, useEffect } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import axios from '../config/axiosConfig';
import PropTypes from 'prop-types';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const { resolvedTheme, setTheme } = useNextTheme();
  const darkMode = resolvedTheme === 'dark';

  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const response = await axios.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.dark_mode !== undefined) {
            setTheme(response.data.dark_mode ? 'dark' : 'light');
          }
        }
      } catch (error) {
        console.error('Failed to load user preferences:', error);
      }
    };
    loadUserPreferences();
  }, [setTheme]);

  useEffect(() => {
    const saveToDB = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const userResponse = await axios.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          await axios.put(`/users/${userResponse.data.id}`,
            { dark_mode: darkMode },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      } catch (error) {
        console.error('Failed to save dark mode to DB:', error);
      }
    };
    saveToDB();
  }, [darkMode]);

  const toggleDarkMode = () => {
    setTheme(darkMode ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
