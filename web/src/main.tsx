import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { uiOverrides, validateOverrides } from './ui/overrides';
import { applyTheme } from './ui/tokens';

validateOverrides();
applyTheme(uiOverrides.theme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
