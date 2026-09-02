/**
 * QRCodeModal - Modal affichant un QR code de l'URL de preview
 * Génère le QR code en canvas via la bibliothèque qrcode
 */

import React, { useEffect, useRef, useState } from 'react';

const QRCodeModal = ({ url, onClose }) => {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url || !canvasRef.current) return;

    const generate = async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(canvasRef.current, url, {
          width: 240,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      } catch (e) {
        console.error('Erreur génération QR code:', e);
        setError("Impossible de générer le QR code. Vérifiez que la bibliothèque 'qrcode' est installée.");
      }
    };

    generate();
  }, [url]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignorer */
    }
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div style={styles.overlay} onClick={handleBackdrop}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <span>📱</span>
            <span>Preview sur mobile</span>
          </div>
          <button style={styles.closeBtn} onClick={onClose} title="Fermer">✕</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          <p style={styles.subtitle}>
            Scannez ce QR code pour ouvrir la preview sur votre téléphone.
          </p>

          <div style={styles.qrContainer}>
            {error ? (
              <div style={styles.error}>{error}</div>
            ) : (
              <canvas ref={canvasRef} style={styles.canvas} />
            )}
          </div>

          <div style={styles.urlRow}>
            <span style={styles.urlText} title={url}>{url}</span>
            <button style={styles.copyBtn} onClick={handleCopy}>
              {copied ? '✅ Copié' : '📋 Copier'}
            </button>
          </div>

          <p style={styles.hint}>
            Votre téléphone et votre ordinateur doivent être sur le même réseau.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    background: '#1e1e1e',
    border: '1px solid #3e3e3e',
    borderRadius: 10,
    width: 320,
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#2d2d2d',
    borderBottom: '1px solid #3e3e3e',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 6px',
  },
  body: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 13,
    textAlign: 'center',
    margin: 0,
  },
  qrContainer: {
    background: '#fff',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    display: 'block',
  },
  error: {
    color: '#f44336',
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
    maxWidth: 240,
  },
  urlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#2d2d2d',
    border: '1px solid #3e3e3e',
    borderRadius: 6,
    padding: '6px 10px',
    width: '100%',
    boxSizing: 'border-box',
  },
  urlText: {
    flex: 1,
    color: '#d4d4d4',
    fontFamily: 'monospace',
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyBtn: {
    background: '#3e3e3e',
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    padding: '4px 8px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  hint: {
    color: '#555',
    fontSize: 11,
    textAlign: 'center',
    margin: 0,
  },
};

export default QRCodeModal;
