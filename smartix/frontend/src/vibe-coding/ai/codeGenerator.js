/**
 * Générateur de code pour le module Vibe-Coding
 * Version corrigée avec:
 * - Imports inutiles supprimés
 * - Templates React/React Native corrects
 * - Mapping intelligent des features
 * - Détection du type de projet
 */

// =============================
// IMPORT DES DÉPENDANCES
// =============================
// Imports React pour le hook
import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';

// =============================
// CONFIGURATION
// =============================

// Mapping des termes utilisateur vers des features standard
const FEATURE_MAPPING = {
  // Authentification
  login: 'auth',
  signup: 'auth',
  register: 'auth',
  authentication: 'auth',
  'user system': 'auth',
  users: 'auth',
  'connexion': 'auth',
  'inscription': 'auth',

  // Base de données
  database: 'database',
  db: 'database',
  storage: 'database',
  'base de données': 'database',
  mongodb: 'database',
  sql: 'database',

  // API
  api: 'api',
  backend: 'api',
  rest: 'api',
  endpoint: 'api',

  // Hors ligne
  offline: 'offline',
  'hors ligne': 'offline',
  cache: 'offline',
  'sans internet': 'offline',

  // Mode sombre
  darkmode: 'darkmode',
  'dark mode': 'darkmode',
  'mode sombre': 'darkmode',
  theme: 'darkmode',
  'thème': 'darkmode',

  // Notifications
  notifications: 'notifications',
  notification: 'notifications',
  push: 'notifications',
  alert: 'notifications',

  // Recherche
  search: 'search',
  recherche: 'search',
  filter: 'search',
  'filtre': 'search',

  // Paiement
  payment: 'payment',
  'paiement': 'payment',
  stripe: 'payment',
  paypal: 'payment',

  // Upload
  upload: 'upload',
  file: 'upload',
  image: 'upload'
};

// Templates de code par type de projet
const CODE_TEMPLATES = {
  react: {
    component: (name, features) => `import React from 'react';
import './${name}.css';

/**
 * Composant ${name}
 ${features?.map(f => ` * @feature ${f}`).join('\n')}
 */
const ${name} = ({ className, ...props }) => {
  return (
    <div className={\`${name.toLowerCase()}-container \${className || ''}\`} {...props}>
      <h2>${name}</h2>
      {/* Contenu du composant */}
    </div>
  );
};

export default ${name};`,

    screen: (name, features) => `import React from 'react';
import './${name}Screen.css';

/**
 * Écran ${name}
 ${features?.map(f => ` * @feature ${f}`).join('\n')}
 */
const ${name}Screen = () => {
  return (
    <div className="${name.toLowerCase()}-screen">
      <header className="screen-header">
        <h1>${name}</h1>
      </header>
      <main className="screen-content">
        {/* Contenu de l'écran */}
      </main>
    </div>
  );
};

export default ${name}Screen;`,

    api: (name, features) => `// API route pour ${name}
import express from 'express';

const router = express.Router();

/**
 * GET /api/${name.toLowerCase()}
 */
router.get('/', (req, res) => {
  res.json({ message: '${name} API endpoint' });
});

/**
 * POST /api/${name.toLowerCase()}
 */
router.post('/', (req, res) => {
  const data = req.body;
  res.json({ received: data, message: 'Data received' });
});

export default router;`,

    auth: `import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      // Implémenter la logique de connexion
      setUser({ email });
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};`,

    offline: `// Service de gestion hors-ligne
class OfflineService {
  constructor() {
    this.dbName = 'offlineDB';
    this.storeName = 'offlineStore';
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async save(key, data) {
    const tx = this.db.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    return store.put({ id: key, data, timestamp: Date.now() });
  }

  async get(key) {
    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    return store.get(key);
  }

  async getAll() {
    const tx = this.db.transaction(this.storeName, 'readonly');
    const store = tx.objectStore(this.storeName);
    return store.getAll();
  }
}

export default new OfflineService();`,

    darkmode: `import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : false;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};`,

    notifications: `// Service de notifications
class NotificationService {
  constructor() {
    this.permission = null;
  }

  async init() {
    if (!('Notification' in window)) {
      console.warn('Notifications non supportées');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    }

    return false;
  }

  notify(title, options = {}) {
    if (this.permission !== 'granted') {
      console.warn('Permission non accordée');
      return;
    }

    return new Notification(title, {
      icon: '/icon.png',
      badge: '/badge.png',
      ...options
    });
  }
}

export default new NotificationService();`,

    search: `import React, { useState } from 'react';
import './SearchBar.css';

const SearchBar = ({ onSearch, placeholder = 'Rechercher...' }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
      <button type="submit" className="search-button">
        🔍
      </button>
    </form>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  placeholder: PropTypes.node,
};

export default SearchBar;`,

    database: `// Schéma de base de données
import mongoose from 'mongoose';

// Configuration de la connexion
export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Modèle utilisateur
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);`
  },

  'react-native': {
    component: (name, features) => `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Composant ${name}
 ${features?.map(f => ` * @feature ${f}`).join('\n')}
 */
const ${name} = ({ style, ...props }) => {
  return (
    <View style={[styles.container, style]} {...props}>
      <Text style={styles.text}>${name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  text: {
    fontSize: 16,
    color: '#333'
  }
});

export default ${name};`,

    screen: (name, features) => `import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

/**
 * Écran ${name}
 ${features?.map(f => ` * @feature ${f}`).join('\n')}
 */
const ${name}Screen = ({ navigation }) => {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>${name}</Text>
      </View>
      <View style={styles.content}>
        {/* Contenu de l'écran */}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef'
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529'
  },
  content: {
    padding: 20
  }
});

export default ${name}Screen;`,

    auth: `import React, { createContext, useState, useContext } from 'react';
import { AsyncStorage } from 'react-native';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      // Implémenter la logique de connexion
      const userData = { email };
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};`,

    offline: `// Service de gestion hors-ligne pour React Native
import AsyncStorage from '@react-native-async-storage/async-storage';

class OfflineService {
  async save(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Offline save error:', error);
      return false;
    }
  }

  async get(key) {
    try {
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Offline get error:', error);
      return null;
    }
  }

  async getAll(keys) {
    try {
      const items = await AsyncStorage.multiGet(keys);
      return items.map(([key, value]) => ({ key, data: JSON.parse(value) }));
    } catch (error) {
      console.error('Offline getAll error:', error);
      return [];
    }
  }
}

export default new OfflineService();`,

    darkmode: `import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemTheme === 'dark');

  const toggleTheme = () => setIsDark(!isDark);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};`,

    notifications: `// Service de notifications pour React Native
import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';

class NotificationService {
  constructor() {
    this.configure();
  }

  configure() {
    PushNotification.configure({
      onRegister: function(token) {
        console.log('TOKEN:', token);
      },
      onNotification: function(notification) {
        console.log('NOTIFICATION:', notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  notify(title, message, options = {}) {
    PushNotification.localNotification({
      title,
      message,
      ...options
    });
  }
}

export default new NotificationService();`,

    search: `import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

const SearchBar = ({ onSearch, placeholder = 'Rechercher...' }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
      />
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>🔍</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  input: {
    flex: 1,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    marginRight: 8
  },
  button: {
    padding: 8,
    backgroundColor: '#007bff',
    borderRadius: 4,
    justifyContent: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16
  }
});

export default SearchBar;`,

    database: `// Configuration Firebase pour React Native
import firebase from '@react-native-firebase/app';
import '@react-native-firebase/firestore';
import '@react-native-firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.firestore();
export const auth = firebase.auth();

export default firebase;`
  },

  node: {
    api: (name, features) => `// API route pour ${name}
import express from 'express';

const router = express.Router();

// GET endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: '${name} API'
  });
});

// POST endpoint
router.post('/', (req, res) => {
  const { body } = req;
  
  if (!body) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body'
    });
  }
  
  res.json({
    success: true,
    received: body,
    timestamp: new Date().toISOString()
  });
});

// GET by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  res.json({
    success: true,
    data: { id },
    message: '${name} item'
  });
});

export default router;`,

    service: (name, features) => `// Service ${name}
class ${name}Service {
  constructor() {
    this.data = [];
  }

  async getAll() {
    return this.data;
  }

  async getById(id) {
    return this.data.find(item => item.id === id);
  }

  async create(item) {
    const newItem = {
      id: Date.now().toString(),
      ...item,
      createdAt: new Date().toISOString()
    };
    this.data.push(newItem);
    return newItem;
  }

  async update(id, updates) {
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    this.data[index] = {
      ...this.data[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    return this.data[index];
  }

  async delete(id) {
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    this.data.splice(index, 1);
    return true;
  }
}

export default new ${name}Service();`,

    auth: `// Service d'authentification
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class AuthService {
  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
}

export default new AuthService();`,

    database: `// Configuration base de données
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Modèle exemple
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Item = mongoose.model('Item', itemSchema);`
  }
};

// =============================
// CLASSE CODE GENERATOR
// =============================

class CodeGenerator {
  constructor() {
    this.initialized = false;
    this.generationHistory = [];
  }

  /**
   * Initialise le générateur
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.initialized = true;
      console.log('✅ CodeGenerator initialized');
    } catch (error) {
      console.error('❌ CodeGenerator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Normalise une feature (mapping intelligent)
   * @param {string} feature - Feature utilisateur
   * @returns {string} Feature normalisée
   */
  normalizeFeature(feature) {
    const normalized = feature.toLowerCase().trim();
    
    // Vérifier le mapping
    for (const [key, value] of Object.entries(FEATURE_MAPPING)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    
    return feature;
  }

  /**
   * Génère un composant
   * @param {Object} params - Paramètres
   * @returns {Object} Fichier généré
   */
  generateComponent({ name, features = [], projectType = 'react' }) {
    const templates = CODE_TEMPLATES[projectType] || CODE_TEMPLATES.react;
    const template = templates.component || CODE_TEMPLATES.react.component;
    
    const content = template(name, features);
    const fileName = `${name}.jsx`;
    const filePath = this._getComponentPath(projectType, fileName);

    return {
      path: filePath,
      content,
      type: 'component',
      name
    };
  }

    /**
   * Génère un écran
   * @param {Object} params - Paramètres
   * @returns {Object} Fichier généré
   */
  generateScreen({ name, features = [], projectType = 'react' }) {
    const templates = CODE_TEMPLATES[projectType] || CODE_TEMPLATES.react;
    const template = templates.screen || CODE_TEMPLATES.react.screen;
    
    const content = template(name, features);
    const fileName = `${name}Screen.jsx`;
    const filePath = this._getScreenPath(projectType, fileName);

    return {
      path: filePath,
      content,
      type: 'screen',
      name
    };
  }

  /**
   * Génère une API
   * @param {Object} params - Paramètres
   * @returns {Object} Fichier généré
   */
  generateApi({ name, features = [], projectType = 'node' }) {
    const templates = CODE_TEMPLATES[projectType] || CODE_TEMPLATES.node;
    const template = templates.api || CODE_TEMPLATES.node.api;
    
    const content = template(name, features);
    const fileName = `${name}.js`;
    const filePath = `api/routes/${fileName}`;

    return {
      path: filePath,
      content,
      type: 'api',
      name
    };
  }

  /**
   * Génère un service
   * @param {Object} params - Paramètres
   * @returns {Object} Fichier généré
   */
  generateService({ name, features = [], projectType = 'node' }) {
    const templates = CODE_TEMPLATES[projectType] || CODE_TEMPLATES.node;
    const template = templates.service || CODE_TEMPLATES.node.service;
    
    const content = template(name, features);
    const fileName = `${name}Service.js`;
    const filePath = `services/${fileName}`;

    return {
      path: filePath,
      content,
      type: 'service',
      name
    };
  }

  /**
   * Génère plusieurs fonctionnalités
   * @param {Array} features - Liste des fonctionnalités
   * @param {string} projectType - Type de projet
   * @param {Object} variables - Variables de remplacement
   * @returns {Promise<Object>} Fichiers générés
   */
  async generateFeatures(features, projectType = 'react', variables = {}) {
    const files = {};
    
    for (const feature of features) {
      const normalizedFeature = this.normalizeFeature(feature);
      const generated = this.generateFeature(normalizedFeature, projectType, variables);
      if (generated) {
        files[generated.path] = generated.content;
        this.generationHistory.push({
          ...generated,
          feature: normalizedFeature,
          timestamp: new Date().toISOString()
        });
      }
    }

    return files;
  }

  /**
   * Génère une fonctionnalité spécifique
   * @param {string} feature - Feature normalisée
   * @param {string} projectType - Type de projet
   * @param {Object} variables - Variables
   * @returns {Object|null} Fichier généré
   */
  generateFeature(feature, projectType, variables = {}) {
    const templates = CODE_TEMPLATES[projectType] || CODE_TEMPLATES.react;
    
    if (templates[feature]) {
      return {
        path: this._getFeaturePath(feature, projectType),
        content: typeof templates[feature] === 'function'
          ? templates[feature](variables.name || this._capitalize(feature), [feature])
          : templates[feature],
        type: feature,
        name: this._capitalize(feature)
      };
    }
    
    // Fallback sur composant générique
    return this.generateComponent({
      name: this._capitalize(feature),
      projectType,
      features: [feature]
    });
  }

  // =============================
  // FONCTIONS PRIVÉES
  // =============================

  /**
   * Obtient le chemin pour un composant
   * @private
   */
  _getComponentPath(projectType, fileName) {
    const paths = {
      react: 'src/components/',
      'react-native': 'src/components/',
      node: 'src/'
    };
    return `${paths[projectType] || 'src/'}${fileName}`;
  }

  /**
   * Obtient le chemin pour un écran
   * @private
   */
  _getScreenPath(projectType, fileName) {
    const paths = {
      react: 'src/screens/',
      'react-native': 'src/screens/'
    };
    return `${paths[projectType] || 'src/'}${fileName}`;
  }

  /**
   * Obtient le chemin pour une feature
   * @private
   */
  _getFeaturePath(feature, projectType) {
    const paths = {
      auth: 'src/contexts/',
      darkmode: 'src/contexts/',
      notifications: 'src/services/',
      offline: 'src/services/',
      search: 'src/components/',
      database: projectType === 'node' ? 'db/' : 'src/services/'
    };
    
    const basePath = paths[feature] || 'src/';
    const extension = projectType === 'react-native' ? '.js' : '.js';
    
    if (feature === 'auth') return `${basePath}AuthContext${extension}`;
    if (feature === 'darkmode') return `${basePath}ThemeContext${extension}`;
    if (feature === 'notifications') return `${basePath}NotificationService${extension}`;
    if (feature === 'offline') return `${basePath}OfflineService${extension}`;
    if (feature === 'search') return `${basePath}SearchBar${extension}x`;
    if (feature === 'database') return `${basePath}database${extension}`;
    
    return `${basePath}${this._capitalize(feature)}.js`;
  }

  /**
   * Capitalise une chaîne
   * @private
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// =============================
// HOOKS REACT
// =============================

export const useCodeGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);
  const generator = useRef(null);

  useEffect(() => {
    generator.current = new CodeGenerator();
    generator.current.initialize().catch(console.error);
  }, []);

  const generateComponent = useCallback((params) => {
    return generator.current.generateComponent(params);
  }, []);

  const generateScreen = useCallback((params) => {
    return generator.current.generateScreen(params);
  }, []);

  const generateApi = useCallback((params) => {
    return generator.current.generateApi(params);
  }, []);

  const generateService = useCallback((params) => {
    return generator.current.generateService(params);
  }, []);

  const generateFeatures = useCallback(async (features, projectType, variables) => {
    setLoading(true);
    try {
      const files = await generator.current.generateFeatures(features, projectType, variables);
      setLastGenerated({ features, files });
      return files;
    } finally {
      setLoading(false);
    }
  }, []);

  const normalizeFeature = useCallback((feature) => {
    return generator.current.normalizeFeature(feature);
  }, []);

  return {
    loading,
    lastGenerated,
    generateComponent,
    generateScreen,
    generateApi,
    generateService,
    generateFeatures,
    normalizeFeature
  };
};

// =============================
// EXPORT (SINGLETON)
// =============================
export const codeGenerator = new CodeGenerator();

// Initialisation automatique
if (typeof window !== 'undefined') {
  codeGenerator.initialize().catch(console.error);
}

export default codeGenerator;
