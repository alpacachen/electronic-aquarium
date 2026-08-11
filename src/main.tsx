import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createI18n } from './i18n'
import './styles.css'

const i18n = createI18n()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App i18n={i18n} />
  </StrictMode>,
)
