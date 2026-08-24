import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initAuth } from './auth'

// Auth first: after the Keycloak redirect the page reloads, and initAuth()
// must resume the session before anything reads sdkConfig. No-op in Mode A.
void initAuth().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
