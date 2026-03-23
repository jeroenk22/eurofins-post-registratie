import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import MobileCameraPage from './components/MobileCameraPage'
import './index.css'

const params = new URLSearchParams(window.location.search)
const mobileParam = params.get('mobile')
const entriesParam = params.get('entries')
const initialEntries = entriesParam
  ? (() => { try { return JSON.parse(decodeURIComponent(entriesParam)) } catch { return undefined } })()
  : undefined

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {mobileParam
      ? <MobileCameraPage sessionId={mobileParam} initialEntries={initialEntries} />
      : <App />}
  </React.StrictMode>
)
