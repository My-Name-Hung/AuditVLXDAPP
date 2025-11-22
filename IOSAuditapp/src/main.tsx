import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Log environment info for debugging on Safari iOS
if (typeof window !== 'undefined') {
  console.log('App starting...');
  console.log('User Agent:', navigator.userAgent);
  console.log('Platform:', navigator.platform);
  console.log('LocalStorage available:', typeof Storage !== 'undefined');
  
  // Test localStorage
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    console.log('LocalStorage is working');
  } catch (e) {
    console.warn('LocalStorage may not be available (possibly private browsing):', e);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
