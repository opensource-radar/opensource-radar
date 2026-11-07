import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

const crashMessage = (
  <main className="empty-state" role="alert">
    <p>Something went wrong.</p>
    <button type="button" onClick={() => window.location.reload()}>
      Reload the page
    </button>
  </main>
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fallback={crashMessage}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
