import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { IonApp, IonPage, setupIonicReact } from '@ionic/react';
import MainTabs from './MainTabs';
import { subscribeFavorites } from '../services/favorites';
import type { UserProfile } from '../types/auth';

vi.mock('../pages/Home', () => ({ default: () => <IonPage><h1>Home test page</h1></IonPage> }));
vi.mock('../pages/Favorites', () => ({ default: () => <IonPage><h1>Favorites test page</h1></IonPage> }));
vi.mock('../services/favorites', () => ({ subscribeFavorites: vi.fn(() => vi.fn()) }));
vi.mock('../config/firebase', () => ({ auth: { currentUser: { uid: 'user-1' } } }));
vi.mock('../pages/Matching', () => ({ default: () => <IonPage><h1>Matching test page</h1></IonPage> }));
vi.mock('../pages/Dashboard', () => ({ default: () => <IonPage><h1>Dashboard test page</h1></IonPage> }));
vi.mock('../pages/Profile', () => ({ default: () => <IonPage><h1>Profile test page</h1></IonPage> }));

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setupIonicReact({ animated: false });
});
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function mount(role: string, path: string, overrides: Partial<UserProfile> = {}) {
  window.history.replaceState({}, '', path);
  return render(<IonApp><MainTabs uid="user-1" busy={false} email="test@example.com" providerIds={[]}
    profile={{ role, status: 'ACTIVE', profileCompleted: true, ...overrides }} onChangePassword={async () => true}
    onSaveProfile={async () => true} onSavePhoto={async () => {}} onLogout={() => {}} /></IonApp>);
}

describe('Role tab navigation', () => {
  it.each([
    ['USER', '/', '/tabs/home', 'Home test page'],
    ['ADMIN', '/', '/tabs/dashboard', 'Dashboard test page'],
    ['USER', '/tabs/dashboard', '/tabs/home', 'Home test page'],
    ['ADMIN', '/tabs/home', '/tabs/dashboard', 'Dashboard test page'],
    ['USER', '/tabs/matching', '/tabs/matching', 'Matching test page'],
    ['USER', '/tabs/favorites', '/tabs/favorites', 'Favorites test page'],
    ['ADMIN', '/tabs/favorites', '/tabs/dashboard', 'Dashboard test page'],
    ['ADMIN', '/tabs/matching', '/tabs/dashboard', 'Dashboard test page'],
    ['ADMIN', '/tabs/profile', '/tabs/profile', 'Profile test page'],
  ])('%s at %s renders %s', async (role, path, destination, title) => {
    const view = mount(role, path);
    await waitFor(() => {
      expect(window.location.pathname).toBe(destination);
      expect(view.getByText(title)).toBeTruthy();
    });
    const tabs = Array.from(view.container.querySelectorAll('ion-tab-button')).map((tab) => tab.getAttribute('tab'));
    expect(tabs).toEqual(role === 'ADMIN' ? ['dashboard', 'profile'] : ['home', 'favorites', 'matching', 'profile']);
    if (role === 'ADMIN') expect(subscribeFavorites).not.toHaveBeenCalled();
  });

  it('can open Favorites from Home and return', async () => {
    const view = mount('USER', '/tabs/home');
    const favoritesTab = view.container.querySelector('ion-tab-button[tab="favorites"]')!;
    await waitFor(() => expect(favoritesTab.classList.contains('hydrated')).toBe(true));
    fireEvent.click(favoritesTab);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/tabs/favorites');
      expect(view.getByText('Favorites test page')).toBeTruthy();
    });
    fireEvent.click(view.container.querySelector('ion-tab-button[tab="home"]')!);
    await waitFor(() => expect(window.location.pathname).toBe('/tabs/home'));
  });

  it.each([{ status: 'DISABLED' }, { profileCompleted: false }])('blocks Favorites for an ineligible USER profile: %j', async (profile) => {
    const view = mount('USER', '/tabs/favorites', profile);
    await waitFor(() => expect(window.location.pathname).toBe('/tabs/home'));
    expect(view.queryByText('Favorites test page')).toBeNull();
    expect(view.container.querySelector('ion-tab-button[tab="favorites"]')).toBeNull();
    expect(view.container.querySelector('ion-tab-button[tab="matching"]')).toBeNull();
    expect(subscribeFavorites).not.toHaveBeenCalled();
  });
  it.each([{ status: 'DISABLED' }, { profileCompleted: false }])('blocks Matching for an ineligible USER profile: %j', async (profile) => {
    const view = mount('USER', '/tabs/matching', profile);
    await waitFor(() => expect(window.location.pathname).toBe('/tabs/home'));
    expect(view.queryByText('Matching test page')).toBeNull();
    expect(subscribeFavorites).not.toHaveBeenCalled();
  });
  it.each(['USER', 'ADMIN'])('%s can switch to Profile and return', async (role) => {
    const home = role === 'ADMIN' ? 'dashboard' : 'home';
    const view = mount(role, `/tabs/${home}`);
    const profileTab = view.container.querySelector('ion-tab-button[tab="profile"]')!;
    await waitFor(() => expect(profileTab.classList.contains('hydrated')).toBe(true));
    fireEvent.click(profileTab);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/tabs/profile');
      expect(view.getByText('Profile test page')).toBeTruthy();
    });
    fireEvent.click(view.container.querySelector(`ion-tab-button[tab="${home}"]`)!);
    await waitFor(() => expect(window.location.pathname).toBe(`/tabs/${home}`));
  });

});
