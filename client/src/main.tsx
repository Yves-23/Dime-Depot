import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Keep service worker alive on iOS
if ('serviceWorker' in navigator) {
  setInterval(() => {
    navigator.serviceWorker.ready.then(reg => {
      if (reg.active) {
        const channel = new MessageChannel()
        reg.active.postMessage('keepAlive', [channel.port2])
      }
    })
  }, 20000) // ping every 20 seconds
}