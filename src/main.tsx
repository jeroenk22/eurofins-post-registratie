import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import MobileCameraPage from './components/MobileCameraPage'
import './index.css'

const mobileParam = new URLSearchParams(window.location.search).get('mobile')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {mobileParam ? <MobileCameraPage sessionId={mobileParam} /> : <App />}
  </React.StrictMode>
)
