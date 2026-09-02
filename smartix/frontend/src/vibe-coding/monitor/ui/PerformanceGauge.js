/**
 * PerformanceGauge
 * Jauge de performance circulaire
 */

import React, { useEffect, useRef } from 'react';

export const PerformanceGauge = ({ 
  label, 
  value, 
  max = 100, 
  unit = '', 
  color = '#007bff',
  size = 120,
  thresholds = { warning: 70, danger: 90 }
}) => {
  const canvasRef = useRef(null);
  const percentage = (value / max) * 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;

    // Nettoyer
    ctx.clearRect(0, 0, size, size);

    // Fond du cercle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Arc de progression
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * (percentage / 100));

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Cercle intérieur
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e1e';
    ctx.fill();
    ctx.strokeStyle = '#3e3e3e';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Valeur
    ctx.fillStyle = '#d4d4d4';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, centerX, centerY - 5);

    // Unité
    if (unit) {
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.fillText(unit, centerX, centerY + 15);
    }

    // Marqueurs de seuils
    if (percentage > thresholds.warning) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = percentage > thresholds.danger ? '#dc3545' : '#ffd93e';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

  }, [value, max, color, size, percentage, thresholds, unit]);

  const getStatusColor = () => {
    if (percentage > thresholds.danger) return '#dc3545';
    if (percentage > thresholds.warning) return '#ffd93e';
    return '#28a745';
  };

  return (
    <div className="performance-gauge">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="gauge-canvas"
      />
      
      <div className="gauge-label">{label}</div>
      
      <div className="gauge-status" style={{ color: getStatusColor() }}>
        {percentage > thresholds.danger ? 'Critique' :
         percentage > thresholds.warning ? 'Attention' : 'Normal'}
      </div>

      <style jsx>{`
        .performance-gauge {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .gauge-canvas {
          display: block;
          margin-bottom: 8px;
        }

        .gauge-label {
          font-size: 12px;
          color: #888;
          margin-bottom: 4px;
        }

        .gauge-status {
          font-size: 11px;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default PerformanceGauge;
