// ============================================================
// MemoryCare — Sync Service (abstraction)
// This hackathon build has no backend. "Demo sync" only marks local records
// as reviewed; it never transmits data or provides cross-device sharing.
// ============================================================

import type { GameSession } from '@/types';
import { storageService } from './storageService';

export interface SyncResult {
  synced: number;
  pendingBefore: number;
}

/** Count sessions not yet marked as synced. */
export async function pendingCount(): Promise<number> {
  const sessions = await storageService.getSessions();
  return sessions.filter((s) => !s.synced).length;
}

/**
 * Model a local demo synchronization pass. A production implementation must
 * authenticate and send encrypted, consented data to a real API.
 */
export async function syncNow(): Promise<SyncResult> {
  const sessions = await storageService.getSessions();
  const pending = sessions.filter((s) => !s.synced);
  for (const s of pending) {
    const updated: GameSession = { ...s, synced: true };
    await storageService.putSession(updated);
  }
  return { synced: pending.length, pendingBefore: pending.length };
}
