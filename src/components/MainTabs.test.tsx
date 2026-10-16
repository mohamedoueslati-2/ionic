import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { IonApp, IonPage, setupIonicReact } from '@ionic/react';
import MainTabs from './MainTabs';

vi.mock('../pages/Home', () => ({ default: () => <IonPage><h1>Home test page</h1></IonPage> }));
vi.mock('../pages/Matching', () => ({ default: () => <IonPage><h1>Matching test page</h1></IonPage> }));
vi.mock('../pages/Dashboard', () => ({ default: () => <IonPage><h1>Dashboard test page</h1></IonPage> }));
vi.mock('../pages/Profile', () => ({ default: () => <IonPage><h1>Profile test page</h1></IonPage> }));

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  setupIonicReact({ animated: false });
});
afterEach(cleanup);

function mount(role: string, path: string) {
  window.history.replaceState({}, '', path);
  return render(<IonApp><MainTabs busy={false} email="test@example.com" providerIds={[]}
    profile={{ role, status: 'ACTIVE', profileCompleted: true }} onChangePassword={async () => true}
    onSaveProfile={async () => true} onSavePhoto={async () => {}} onLogout={() => {}} /></IonApp>);
}

describe('Role tab navigation', () => {
  it.each([
    ['USER', '/', '/tabs/home', 'Home test page'],
    ['ADMIN', '/', '/tabs/dashboard', 'Dashboard test page'],
    ['USER', '/tabs/dashboard', '/tabs/home', 'Home test page'],
    ['ADMIN', '/tabs/home', '/tabs/dashboard', 'Dashboard test page'],
    ['USER', '/tabs/matching', '/tabs/matching', 'Matching test page'],
    ['ADMIN', '/tabs/profile', '/tabs/profile', 'Profile test page'],
  ])('%s at %s renders %s', async (role, path, destination, title) => {
    const view = mount(role, path);
    await waitFor(() => {
      expect(window.location.pathname).toBe(destination);
      expect(view.getByText(title)).toBeTruthy();
    });
    const tabs = Array.from(view.container.querySelectorAll('ion-tab-button')).map((tab) => tab.getAttribute('tab'));
    expect(tabs).toEqual(role === 'ADMIN' ? ['dashboard', 'profile'] : ['home', 'matching', 'profile']);
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
