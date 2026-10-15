import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Point d'entrée : React affiche App dans l'élément « root » défini dans index.html.
// StrictMode ajoute des vérifications pendant le développement.
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
