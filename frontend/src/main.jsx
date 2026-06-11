import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { C, FONT } from './theme.js';

document.body.style.margin = '0';
document.body.style.background = C.cream;
document.body.style.fontFamily = FONT;
document.body.style.color = C.ink;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
