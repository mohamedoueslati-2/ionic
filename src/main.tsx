import React from 'react';
import { createRoot } from 'react-dom/client';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import App from './App';

// Enregistre les composants PWA qui permettent d'afficher la caméra dans le navigateur.
defineCustomElements(window);

// Point d'entrée : React affiche App dans l'élément « root » défini dans index.html.
// StrictMode ajoute des vérifications pendant le développement.
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
