import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HostReadyPage } from './pages/HostReadyPage'
import './styles/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><HostReadyPage /></StrictMode>,
)
