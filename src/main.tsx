/**
 * main.tsx
 * 
 * Application entry point.
 * Initializes the React application and renders the root App component.
 * Uses StrictMode for additional development checks and warnings.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Initialize React application and mount to DOM
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)