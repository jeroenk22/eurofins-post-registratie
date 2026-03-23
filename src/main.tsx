import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import MobileCameraPage from './components/MobileCameraPage'
import './index.css'

const params = new URLSearchParams(window.location.search)
const mobileParam = params.get('mobile')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {mobileParam
      ? <MobileCameraPage sessionId={mobileParam} />
      : <App />}
  </React.StrictMode>
)
