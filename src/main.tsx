import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { AppProvider } from './context/AppContext'
import './styles/index.css'

// HashRouter: las rutas quedan como /CobroSync/#/app/saldos.
// GitHub Pages solo sirve archivos; si alguien recarga /CobroSync/app/saldos
// buscaría un archivo que no existe (error 404). Con "#" eso no pasa.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </StrictMode>,
)
