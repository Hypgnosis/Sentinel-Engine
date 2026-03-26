import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// --- SENTINEL EDGE NODE: Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Sentinel Engine: Edge Node active. Scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Sentinel Engine: Edge Node registration failed:', error);
      });
  });
}
