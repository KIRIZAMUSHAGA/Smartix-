import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App";
import ErrorBoundary from './components/ErrorBoundary';
import './i18n/config';

// Plusieurs pages (Courses, CourseReader, CourseEditor, AppDetail,
// MarketplaceApps, Stories, Explore, FeedSimple, et tout le module
// Vibe-Coding) appellent useQuery / useQueryClient. Sans ce provider,
// React-Query lève "No QueryClient set, use QueryClientProvider to set one"
// au premier rendu (typiquement après inscription quand on est routé sur
// /home → /courses).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

// Register Service Worker for PWA & offline support
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('✅ Service Worker registered'))
      .catch(err => console.warn('Service Worker registration failed:', err));
  });
}
