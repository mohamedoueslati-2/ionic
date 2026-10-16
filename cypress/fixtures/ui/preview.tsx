// Isolated browser fixture. This entry is never imported by the production app.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IonApp, setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '../../../src/theme/variables.css';
import ThemeProvider from '../../../src/components/ThemeProvider';
import { FavoritesContext } from '../../../src/hooks/useFavorites';
import type { FavoriteMovie } from '../../../src/services/favorites';
import Home from '../../../src/pages/Home';
import Favorites from '../../../src/pages/Favorites';
import Matching from '../../../src/pages/Matching';
import Profile from '../../../src/pages/Profile';
import Disabled from '../../../src/pages/Disabled';
import CompleteProfile from '../../../src/pages/CompleteProfile';

setupIonicReact({ animated: false });
const screen = new URLSearchParams(location.search).get('screen');
const sampleFavorites: FavoriteMovie[] = Array.from({ length: 12 }, (_, index) => ({ movieId: index + 1, title: `Test movie ${index + 1}`, posterPath: null, releaseDate: '2026-01-01', addedAt: null }));

function Preview() {
  const [favorites, setFavorites] = useState(screen === 'watchlist' ? sampleFavorites : []);
  return <ThemeProvider><IonApp><FavoritesContext.Provider value={{ enabled: true, favorites, loading: false, ready: true, error: '', pendingIds: new Set(), unavailable: false, retry: () => {}, toggleFavorite: async () => {}, removeFavorite: async (id) => setFavorites((previous) => previous.filter((movie) => movie.movieId !== id)) }}>
    {screen === 'watchlist' || screen === 'empty-watchlist' ? <Favorites /> : screen === 'matching' ? <Matching uid="test-only" /> : screen === 'profile' ? <Profile busy={false} email="test@example.com" providerIds={['password']} profile={{ firstName: 'Test', lastName: 'Viewer', age: 25, role: 'USER', status: 'ACTIVE', profileCompleted: true }} onChangePassword={async () => true} onSaveProfile={async () => true} onSavePhoto={async () => {}} onLogout={() => {}} /> : screen === 'disabled' ? <Disabled busy={false} onLogout={() => {}} /> : screen === 'onboarding' ? <CompleteProfile busy={false} onComplete={() => {}} onLogout={() => {}} /> : <Home />}
  </FavoritesContext.Provider></IonApp></ThemeProvider>;
}

createRoot(document.getElementById('root')!).render(<Preview />);
