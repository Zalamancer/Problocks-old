import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

// Kill ALL default wheel/gesture behavior — capture phase runs before anything else
window.addEventListener('wheel', (e) => {
  e.preventDefault();
}, { passive: false, capture: true });

// Prevent Safari pinch-to-zoom and swipe-to-navigate gestures
window.addEventListener('gesturestart', (e) => e.preventDefault(), true);
window.addEventListener('gesturechange', (e) => e.preventDefault(), true);
window.addEventListener('gestureend', (e) => e.preventDefault(), true);

// Belt-and-suspenders: force overscroll-behavior via JS in case CSS layers reduce priority
document.documentElement.style.overscrollBehavior = 'none';
document.body.style.overscrollBehavior = 'none';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
