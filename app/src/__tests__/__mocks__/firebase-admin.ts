/**
 * Mock manual do módulo config/firebase.
 * Intercepta todas as chamadas ao Firestore e Auth sem precisar
 * de credenciais reais ou conexão com o Firebase.
 *
 * Uso nos testes:
 *   import '../__mocks__/firebase-admin';
 *   import { mockDb, mockAuth, firestoreStore } from '../__mocks__/firebase-admin';
 */

import type { UserDocument } from '../../models/user';

// ─── Armazenamento em memória ─────────────────────────────────────────────────

export const firestoreStore: Map<string, Partial<UserDocument>> = new Map();

// ─── Mock do Firestore ────────────────────────────────────────────────────────

const makeDocRef = (collection: string, docId: string) => ({
  id: docId,
  get: jest.fn(async () => {
    const data = firestoreStore.get(`${collection}/${docId}`);
    return {
      exists: !!data,
      id: docId,
      data: () => data,
    };
  }),
  set: jest.fn(async (data: Partial<UserDocument>) => {
    firestoreStore.set(`${collection}/${docId}`, { ...data });
  }),
  update: jest.fn(async (data: Partial<UserDocument>) => {
    const existing = firestoreStore.get(`${collection}/${docId}`) ?? {};
    firestoreStore.set(`${collection}/${docId}`, { ...existing, ...data });
  }),
});

export const mockDb = {
  collection: jest.fn((col: string) => ({
    doc: jest.fn((id: string) => makeDocRef(col, id)),
  })),
};

// ─── Mock do Auth ─────────────────────────────────────────────────────────────

export const mockAuth = {
  verifyIdToken: jest.fn(),
};

// ─── Mock do admin (FieldValue, etc.) ────────────────────────────────────────

export const mockAdmin = {
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date('2024-01-01T00:00:00.000Z')),
      arrayUnion: jest.fn((...args: unknown[]) => ({ _type: 'arrayUnion', args })),
      arrayRemove: jest.fn((...args: unknown[]) => ({ _type: 'arrayRemove', args })),
      increment: jest.fn((n: number) => ({ _type: 'increment', n })),
    },
  },
  apps: [true],
  initializeApp: jest.fn(),
  credential: { applicationDefault: jest.fn() },
  auth: jest.fn(() => mockAuth),
};

// ─── Registra o mock via jest.mock ────────────────────────────────────────────
// Usa caminho relativo à raiz do projeto (resolvido pelo moduleNameMapper ou pelo Jest)

jest.mock('../../config/firebase', () => ({
  db: mockDb,
  auth: mockAuth,
  admin: mockAdmin,
}));
