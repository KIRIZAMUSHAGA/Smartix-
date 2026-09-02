/**
 * EventLog
 * Liste des événements avec filtres
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';

export const EventLog = ({ events = [] }) => {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  const eventTypes = ['all', 'error', 'warning', 'info', 'performance', 'memory', 'network'];

  const filteredEvents = events
    .filter(e => typeFilter === 'all' || e.type === typeFilter)
    .filter(e => 
      filter === '' || 
      JSON.stringify(e).toLowerCase().includes(filter.toLowerCase())
    );

  const getTypeColor = (type) => {
    const colors = {
      error: '#f48771',
      warning: '#ffd93e',
      info: '#9cdcfe',
      performance: '#b5cea8',
      memory: '#ce9178',
      network: '#4ec9b0'
    };
    return colors[type] || '#888';
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      millisecond: '2-digit'
    });
  };

  return (
    <div className="event-log">
      {/* Filtres */}
      <div className="event-filters">
        <input
          type="text"
          placeholder="Rechercher..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-input"
        />
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="type-select"
        >
          {eventTypes.map(type => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Statistiques */}
      <div className="event-stats">
        <span>Total: {filteredEvents.length}</span>
        {typeFilter !== 'all' && (
          <span>Filtre: {typeFilter}</span>
        )}
      </div>

      {/* Liste */}
      <div className="events-list">
        {filteredEvents.length === 0 ? (
          <div className="no-events">
            <div className="empty-icon">📭</div>
            <div>Aucun événement</div>
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <div
              key={index}
              className={`event-item ${expanded === index ? 'expanded' : ''}`}
              style={{ borderLeftColor: getTypeColor(event.type) }}
            >
              <div
                className="event-header"
                onClick={() => setExpanded(expanded === index ? null : index)}
              >
                <span className="event-time">{formatTime(event.timestamp)}</span>
                <span className="event-type" style={{ color: getTypeColor(event.type) }}>
                  [{event.type}]
                </span>
                <span className="event-message">
                  {event.data?.message || event.message || JSON.stringify(event.data)}
                </span>
                <span className="event-expand">
                  {expanded === index ? '▼' : '▶'}
                </span>
              </div>

              {expanded === index && (
                <div className="event-details">
                  <pre>{JSON.stringify(event, null, 2)}</pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .event-log {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .event-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .filter-input {
          flex: 1;
          padding: 8px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          font-size: 13px;
        }

        .filter-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .type-select {
          padding: 8px 12px;
          background: #2d2d2d;
          border: 1px solid #3e3e3e;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
        }

        .event-stats {
          padding: 8px;
          background: #2d2d2d;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 12px;
          color: #888;
          display: flex;
          gap: 16px;
        }

        .events-list {
          flex: 1;
          overflow: auto;
        }

        .no-events {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #888;
          gap: 16px;
        }

        .empty-icon {
          font-size: 48px;
        }

        .event-item {
          background: #2d2d2d;
          border-left: 4px solid transparent;
          border-radius: 4px;
          margin-bottom: 4px;
          overflow: hidden;
        }

        .event-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          cursor: pointer;
          user-select: none;
        }

        .event-header:hover {
          background: #3e3e3e;
        }

        .event-time {
          color: #888;
          font-size: 11px;
          min-width: 80px;
        }

        .event-type {
          font-size: 11px;
          font-weight: bold;
          min-width: 70px;
        }

        .event-message {
          flex: 1;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-expand {
          color: #888;
          font-size: 12px;
        }

        .event-details {
          padding: 12px;
          background: #1e1e1e;
          border-top: 1px solid #3e3e3e;
        }

        .event-details pre {
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          font-size: 11px;
          color: #b5cea8;
        }
      `}</style>
    </div>
  );
};

EventLog.propTypes = {
  events: PropTypes.array,
};

export default EventLog;
