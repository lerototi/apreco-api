/**
 * Mock fixo do módulo src/config/firebase.
 * O jest.config.js redireciona TODOS os imports de 'config/firebase'
 * para este arquivo via moduleNameMapper.
 *
 * Os testes importam mockDb/mockAuth/firestoreStore daqui para
 * configurar e inspecionar o estado do Firestore fake.
 */

import type { UserDocument } from '../../models/user';

// ─── Armazenamento em memória ─────────────────────────────────────────────────

export const firestoreStore: Map<string, Partial<UserDocument>> = new Map();

// ─── FieldValue fake ──────────────────────────────────────────────────────────

const serverTimestamp = () => new Date('2024-01-01T00:00:00.000Z');

/**
 * arrayUnion marker — o makeDocRef.update resolve isso manualmente
 * aplicando o merge real nos arrays do store.
 */
const arrayUnion = (...items: unknown[]) => ({ __arrayUnion: items });

// ─── Mock do admin ────────────────────────────────────────────────────────────

export const admin = {
  firestore: {
    FieldValue: { serverTimestamp, arrayUnion },
  },
};

// ─── Helpers internos ─────────────────────────────────────────────────────────

const makeDocRef = (collection: string, docId: string) => ({
  id: docId,
  get: jest.fn(async () => {
    const data = firestoreStore.get(`${collection}/${docId}`);
    return { exists: !!data, id: docId, data: () => data };
  }),
  set: jest.fn(async (data: Partial<UserDocument>) => {
    firestoreStore.set(`${collection}/${docId}`, { ...data });
  }),
  update: jest.fn(async (data: Record<string, unknown>) => {
    const existing = (firestoreStore.get(`${collection}/${docId}`) ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && '__arrayUnion' in (value as object)) {
        const items = (value as { __arrayUnion: unknown[] }).__arrayUnion;
        const current = Array.isArray(merged[key]) ? (merged[key] as unknown[]) : [];
        merged[key] = [...new Set([...current, ...items])];
      } else {
        merged[key] = value;
      }
    }
    firestoreStore.set(`${collection}/${docId}`, merged as Partial<UserDocument>);
  }),
});

// ─── Mock do db (Firestore) ───────────────────────────────────────────────────

export const db = {
  collection: jest.fn((col: string) => ({
    doc: jest.fn((id: string) => makeDocRef(col, id)),
  })),
};

// ─── Mock do auth ─────────────────────────────────────────────────────────────

export const auth = {
  verifyIdToken: jest.fn(),
};
