import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './globals.css';
import './index.css';
import './styles/astra-orbit.css';
import { installSpotlight } from './lib/spotlight';

installSpotlight();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
