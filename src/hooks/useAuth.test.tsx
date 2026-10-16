import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { useAuth } from './useAuth';

vi.mock('../config/firebase', () => ({ auth: { currentUser: null }, db: {} }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: vi.fn(() => vi.fn()) }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn((_db, ...path: string[]) => path.join('/')), onSnapshot: vi.fn(() => vi.fn()) }));

beforeEach(() => { vi.clearAllMocks(); Object.assign(auth, { currentUser: null }); });
afterEach(cleanup);

function changeAccount(uid: string | null) {
  const user = uid ? { uid, email: `${uid}@example.com`, providerData: [] } as unknown as User : null;
  Object.assign(auth, { currentUser: user });
  const callback = vi.mocked(onAuthStateChanged).mock.calls[0][1] as (user: User | null) => void;
  act(() => callback(user));
}
function snapshot(index: number, data: Record<string, unknown> | undefined, fromCache = false, hasPendingWrites = false) {
  const callback = vi.mocked(onSnapshot).mock.calls[index][2] as unknown as (snapshot: unknown) => void;
  act(() => callback({ data: () => data, metadata: { fromCache, hasPendingWrites } }));
}

describe('Authenticated profile lifecycle', () => {
  it('waits for profile creation and observes completion, edits and reactivation', () => {
    const view = renderHook(useAuth);
    changeAccount('a');
    expect(view.result.current.loading).toBe(true);
    snapshot(0, undefined);
    expect(view.result.current.profile).toBeNull();
    snapshot(0, { profileCompleted: false });
    expect(view.result.current.profile?.profileCompleted).toBe(false);
    snapshot(0, { profileCompleted: true, role: 'USER', status: 'ACTIVE', firstName: 'Ada' });
    expect(view.result.current.profile?.firstName).toBe('Ada');
    snapshot(0, { profileCompleted: true, role: 'USER', status: 'DISABLED' });
    expect(view.result.current.profile?.status).toBe('DISABLED');
    snapshot(0, { profileCompleted: true, role: 'USER', status: 'ACTIVE' });
    expect(view.result.current.profile?.status).toBe('ACTIVE');
  });

  it('ignores queued snapshots and errors from old accounts after switching', () => {
    const view = renderHook(useAuth);
    changeAccount('a');
    snapshot(0, { firstName: 'Account A' });
    changeAccount('b');
    expect(view.result.current.profile).toBeNull();
    expect(view.result.current.loading).toBe(true);
    snapshot(0, { firstName: 'Late A' });
    const fail = vi.mocked(onSnapshot).mock.calls[0][3] as unknown as (error: Error) => void;
    act(() => fail(new Error('Old account error')));
    expect(view.result.current.error).toBe('');
    snapshot(1, { firstName: 'Account B' });
    expect(view.result.current.profile?.firstName).toBe('Account B');
    expect(view.result.current.account.email).toBe('b@example.com');
  });

  it('clears profile on logout and ignores callbacks after unmount', () => {
    const view = renderHook(useAuth);
    changeAccount('a');
    snapshot(0, { firstName: 'Account A' });
    changeAccount(null);
    snapshot(0, { firstName: 'Late A' });
    expect(view.result.current.profile).toBeNull();
    expect(view.result.current.loading).toBe(false);
    view.unmount();
    changeAccount('b');
    expect(onSnapshot).toHaveBeenCalledOnce();
  });

  it('waits for successful server profile creation and confirmation of later profile edits', () => {
    const view = renderHook(useAuth);
    changeAccount('a');
    snapshot(0, { profileCompleted: true, firstName: 'Local' }, true, true);
    expect(view.result.current.loading).toBe(true);
    expect(view.result.current.profile).toBeNull();
    snapshot(0, { profileCompleted: true, firstName: 'Confirmed' });
    expect(view.result.current.loading).toBe(false);
    expect(view.result.current.profile?.firstName).toBe('Confirmed');
    snapshot(0, { profileCompleted: true, firstName: 'Pending edit' }, false, true);
    expect(view.result.current.profile?.firstName).toBe('Confirmed');
    snapshot(0, { profileCompleted: true, firstName: 'Saved edit' });
    expect(view.result.current.profile?.firstName).toBe('Saved edit');
  });
});
