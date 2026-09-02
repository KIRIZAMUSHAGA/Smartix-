/**
 * Preview Frame pour le module Vibe-Coding
 * Affiche l'application en cours de développement
 */

import React, { useState, useEffect, useRef } from 'react';

export const PreviewFrame = ({ 
  projectId, 
  url = 'http://localhost:3000', 
  height = '100%',
  device = 'desktop' // mobile, tablet, desktop
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [devices, setDevices] = useState([
    { id: 'mobile', width: 375, height: 667, icon: '📱' },
    { id: 'tablet', width: 768, height: 1024, icon: '📟' },
    { id: 'desktop', width: '100%', height: '100%', icon: '🖥️' }
  ]);
  const [currentDevice, setCurrentDevice] = useState(device);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [url, reloadKey]);

  const handleReload = () => {
    setReloadKey(prev => prev + 1);
  };

  const handleDeviceChange = (deviceId) => {
    setCurrentDevice(deviceId);
  };

  const getDeviceStyle = () => {
    const device = devices.find(d => d.id === currentDevice);
    if (!device) return {};

    return {
      width: device.width,
      height: device.height,
      margin: '0 auto',
      border: currentDevice !== 'desktop' ? '12px solid #333' : 'none',
      borderRadius: currentDevice !== 'desktop' ? '24px' : '0',
      overflow: 'hidden'
    };
  };

  return (
    <div className="preview-container" style={{ height }}>
      {/* Barre d'outils du preview */}
      <div className="preview-toolbar">
        <div className="preview-title">🌍 Preview</div>
        
        <div className="device-selector">
          {devices.map(d => (
            <button
              key={d.id}
              onClick={() => handleDeviceChange(d.id)}
              className={`device-button ${currentDevice === d.id ? 'active' : ''}`}
              title={d.id}
            >
              {d.icon}
            </button>
          ))}
        </div>

        <div className="preview-actions">
          <button onClick={handleReload} title="Recharger">🔄</button>
          <button onClick={() => window.open(url, '_blank')} title="Ouvrir dans un nouvel onglet">↗️</button>
        </div>
      </div>

      {/* Barre d'adresse */}
      <div className="address-bar">
        <span className="address-icon">🔒</span>
        <span className="address-url">{url}</span>
      </div>

      {/* Iframe de preview */}
      <div className="iframe-wrapper" style={getDeviceStyle()}>
        {loading && (
          <div className="preview-loading">
            <div className="spinner" />
            <div>Chargement de l'application...</div>
          </div>
        )}

        {error ? (
          <div className="preview-error">
            <div className="error-icon">⚠️</div>
            <div className="error-message">{error}</div>
            <button onClick={handleReload}>Réessayer</button>
          </div>
        ) : (
          <iframe
            key={reloadKey}
            src={url}
            title="Preview"
            className="preview-iframe"
            onLoad={() => setLoading(false)}
            onError={() => setError('Impossible de charger l\'application')}
            sandbox="allow-scripts allow-same-origin allow-forms"
            allow="accelerometer; camera; microphone; geolocation; fullscreen"
          />
        )}
      </div>

      <style jsx>{`
        .preview-container {
          display: flex;
          flex-direction: column;
          background: #1e1e1e;
          border-radius: 4px;
          overflow: hidden;
        }
        .preview-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #2d2d2d;
          border-bottom: 1px solid #3e3e3e;
        }
        .preview-title {
          color: #fff;
          font-weight: bold;
          font-size: 14px;
        }
        .device-selector {
          display: flex;
          gap: 4px;
        }
        .device-button {
          background: #3e3e3e;
          border: none;
          color: #888;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .device-button:hover {
          background: #505050;
          color: #fff;
        }
        .device-button.active {
          background: #007bff;
          color: #fff;
        }
        .preview-actions {
          display: flex;
          gap: 4px;
        }
        .preview-actions button {
          background: #3e3e3e;
          border: none;
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .preview-actions button:hover {
          background: #505050;
        }
        .address-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: #252525;
          border-bottom: 1px solid #3e3e3e;
          color: #888;
          font-size: 12px;
        }
        .address-icon {
          font-size: 12px;
        }
        .address-url {
          flex: 1;
        }
        .iframe-wrapper {
          flex: 1;
          position: relative;
          background: #fff;
          transition: all 0.3s;
        }
        .preview-iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .preview-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(30, 30, 30, 0.9);
          color: #fff;
          z-index: 10;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #333;
          border-top-color: #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .preview-error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: #f44336;
        }
        .preview-error button {
          margin-top: 10px;
          padding: 5px 10px;
          background: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default PreviewFrame;
