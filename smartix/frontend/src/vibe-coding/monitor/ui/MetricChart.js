/**
 * MetricChart
 * Graphique simple pour visualiser les métriques
 */

import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

export const MetricChart = ({ title, data, color = '#007bff', unit = '' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Nettoyer
    ctx.clearRect(0, 0, width, height);

    // Trouver les valeurs min/max
    const values = data.map(d => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);

    // Dessiner la grille
    ctx.strokeStyle = '#2d2d2d';
    ctx.lineWidth = 1;

    // Lignes horizontales
    for (let i = 0; i <= 4; i++) {
      const y = height - (i * height / 4);
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 10, y);
      ctx.strokeStyle = '#2d2d2d';
      ctx.stroke();

      // Labels
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      const value = min + (max - min) * (i / 4);
      ctx.fillText(Math.round(value), 5, y - 5);
    }

    // Dessiner la courbe
    if (data.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillStyle = color + '20';

      const step = (width - 40) / (data.length - 1);

      // Remplissage
      ctx.beginPath();
      ctx.moveTo(30, height - 10);

      data.forEach((point, i) => {
        const x = 30 + i * step;
        const y = height - 10 - ((point.value - min) / (max - min || 1)) * (height - 40);
        ctx.lineTo(x, y);
      });

      ctx.lineTo(30 + (data.length - 1) * step, height - 10);
      ctx.closePath();
      ctx.fillStyle = color + '20';
      ctx.fill();

      // Courbe
      ctx.beginPath();
      data.forEach((point, i) => {
        const x = 30 + i * step;
        const y = height - 10 - ((point.value - min) / (max - min || 1)) * (height - 40);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Points
      data.forEach((point, i) => {
        const x = 30 + i * step;
        const y = height - 10 - ((point.value - min) / (max - min || 1)) * (height - 40);
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Légende
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    
    if (data.length > 0) {
      const last = data[data.length - 1];
      ctx.fillText(
        `actuel: ${last.value}${unit}`,
        width - 100,
        20
      );
    }

  }, [data, color, unit]);

  const getStats = () => {
    if (!data || data.length === 0) return null;

    const values = data.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max };
  };

  const stats = getStats();

  return (
    <div className="metric-chart">
      <div className="chart-header">
        <h4>{title}</h4>
        {stats && (
          <div className="chart-stats">
            <span>avg: {stats.avg.toFixed(1)}{unit}</span>
            <span>min: {stats.min}{unit}</span>
            <span>max: {stats.max}{unit}</span>
          </div>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="chart-canvas"
      />

      <style jsx>{`
        .metric-chart {
          background: #2d2d2d;
          border-radius: 6px;
          padding: 12px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .chart-header h4 {
          margin: 0;
          color: #888;
          font-size: 14px;
        }

        .chart-stats {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: #888;
        }

        .chart-canvas {
          width: 100%;
          height: auto;
          background: #1e1e1e;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

MetricChart.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.array.isRequired,
  color: PropTypes.string,
  unit: PropTypes.any,
};

export default MetricChart;
