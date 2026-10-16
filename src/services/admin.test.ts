import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { setUserStatus } from './admin';

const state = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'admin' } as { uid: string } | null },
  transaction: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('../config/firebase', () => ({ auth: state.auth, db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(),
  doc: vi.fn((_db, ...path: string[]) => path.join('/')),
  serverTimestamp: vi.fn(() => 'timestamp'), runTransaction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  state.auth.currentUser = { uid: 'admin' };
  state.transaction.get.mockImplementation(async (path: string) => ({
    exists: () => true,
    data: () => path === 'users/admin' ? { role: 'ADMIN', status: 'ACTIVE' } : { role: 'USER', status: 'ACTIVE' },
  }));
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback(state.transaction as unknown as Parameters<typeof callback>[0]));
});

describe('Admin matching cleanup', () => {
  it('disables the user and deletes the public matching profile inside the same transaction', async () => {
    await setUserStatus('user', 'DISABLED');
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(state.transaction.update).toHaveBeenCalledWith('users/user', { status: 'DISABLED', updatedAt: 'timestamp' });
    expect(state.transaction.delete).toHaveBeenCalledWith('matchingProfiles/user');
  });

  it('reactivates without publishing a profile or changing favorites', async () => {
    await setUserStatus('user', 'ACTIVE');
    expect(state.transaction.update).toHaveBeenCalledWith('users/user', { status: 'ACTIVE', updatedAt: 'timestamp' });
    expect(state.transaction.delete).not.toHaveBeenCalled();
  });

  it.each(['USER', 'DISABLED'])('preserves admin authorization checks: %s', async (kind) => {
    state.transaction.get.mockResolvedValueOnce({ data: () => ({ role: kind === 'USER' ? 'USER' : 'ADMIN', status: kind === 'DISABLED' ? 'DISABLED' : 'ACTIVE' }) });
    await expect(setUserStatus('user', 'DISABLED')).rejects.toThrow('Unauthorized');
    expect(state.transaction.update).not.toHaveBeenCalled();
    expect(state.transaction.delete).not.toHaveBeenCalled();
  });

  it('blocks self-management and signed-out operations', async () => {
    await expect(setUserStatus('admin', 'DISABLED')).rejects.toThrow('Unauthorized');
    state.auth.currentUser = null;
    await expect(setUserStatus('user', 'DISABLED')).rejects.toThrow('Unauthorized');
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
