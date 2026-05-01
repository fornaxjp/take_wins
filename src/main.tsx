(window as any).onerror = (msg, url, line, col, error) => {
    document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Fatal Error</h1><p>${msg}</p><pre>${error?.stack || ''}</pre></div>`;
};
(window as any).onunhandledrejection = (event) => {
    document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Unhandled Promise Rejection</h1><p>${event.reason}</p></div>`;
};
console.log('Main.tsx loaded');
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { NotificationProvider } from './components/NotificationProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </StrictMode>,
)
