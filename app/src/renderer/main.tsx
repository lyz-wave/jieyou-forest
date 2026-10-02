import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { createMobileForestApi } from './mobileApi'
import './styles.css'

if (typeof window !== 'undefined' && !window.forest) {
  window.forest = createMobileForestApi()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
