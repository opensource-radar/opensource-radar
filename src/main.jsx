import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Analytics } from '@vercel/analytics/react'
import { withoutSearchText } from './analytics.js'

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
    {/* Counting visits must never affect the site, so it fails on its own. */}
    <ErrorBoundary fallback={null}>
      <Analytics beforeSend={withoutSearchText} />
    </ErrorBoundary>
  </StrictMode>,
)
