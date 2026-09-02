import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import OfflinePullMessage from '../components/ui/OfflinePullMessage';

const PullToRefreshContext = createContext(null);

export const PullToRefreshProvider = ({ children }) => {
  const handlerRef = useRef(null);

  const runRefresh = useCallback(async () => {
    if (handlerRef.current) {
      try {
        await handlerRef.current();
        return;
      } catch (err) {
        console.error('Registered pull-to-refresh handler failed:', err);
        if (!navigator.onLine) throw err;
      }
    }
    if (typeof window !== 'undefined' && window.location && navigator.onLine) {
      window.location.reload();
    }
  }, []);

  const {
    isPulling,
    pullDistance,
    showOfflineMessage,
    hideOfflineMessage,
  } = usePullToRefresh(runRefresh);

  const setRefreshHandler = useCallback((fn) => {
    handlerRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  const clearRefreshHandler = useCallback(() => {
    handlerRef.current = null;
  }, []);

  const value = { setRefreshHandler, clearRefreshHandler };

  return (
    <PullToRefreshContext.Provider value={value}>
      <OfflinePullMessage show={showOfflineMessage} onHide={hideOfflineMessage} />
      {(isPulling || pullDistance > 0) && (
        <div
          className="pull-to-refresh-indicator"
          style={{ transform: `translateY(${Math.min(pullDistance, 80)}px)` }}
        >
          <div className="pull-spinner" />
        </div>
      )}
      {children}
    </PullToRefreshContext.Provider>
  );
};

PullToRefreshProvider.propTypes = {
  children: PropTypes.node,
};

export const useRegisterRefresh = (fn) => {
  const ctx = useContext(PullToRefreshContext);
  useEffect(() => {
    if (!ctx) return undefined;
    ctx.setRefreshHandler(fn);
    return () => ctx.clearRefreshHandler();
  }, [ctx, fn]);
};

export default PullToRefreshContext;
