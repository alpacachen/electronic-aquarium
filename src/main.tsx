import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { startLoadingCurtain } from './aquarium/loadingCurtain'
import './styles.css'

startLoadingCurtain()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
