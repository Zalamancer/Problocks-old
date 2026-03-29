import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

// Prevent browser zoom (Ctrl+wheel / trackpad pinch) — canvas zoom handled by Babylon.js
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });

// Prevent Safari pinch-to-zoom gestures
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());

// Prevent overscroll navigation (browser back/forward on horizontal swipe)
document.documentElement.style.overscrollBehavior = 'none';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
