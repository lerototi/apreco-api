/**
 * Mock fixo do módulo src/config/firebase.
 * O jest.config.js redireciona TODOS os imports de 'config/firebase'
 * para este arquivo via moduleNameMapper.
 *
 * Os testes importam mockDb/mockAuth/firestoreStore daqui para
 * configurar e inspecionar o estado do Firestore fake.
 *
 * Suporta:
 *  - Coleções simples:       db.collection('users').doc('uid')
 *  - Subcoleções aninhadas:  db.collection('ruralProducers').doc('uid').collection('properties').doc('id')
 *  - FieldValue.serverTimestamp, arrayUnion, arrayRemove
 *  - CollectionRef.orderBy().get() para listagem
 *  - CollectionRef.doc() sem id → gera ID aleatório (para create)
 *  - DocumentRef.delete()
 *  - DocumentRef.set(data, { merge: true })
 */

import type { UserDocument } from '../../models/user';

// ─── Armazenamento em memória ─────────────────────────────────────────────────

/**
 * Chave: caminho completo (ex: "users/uid-001", "ruralProducers/uid/properties/prop-001")
 * Valor: qualquer objeto de documento
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const firestoreStore: Map<string, any> = new Map();

// ─── FieldValue fake ──────────────────────────────────────────────────────────

const serverTimestamp = () => new Date('2024-01-01T00:00:00.000Z');
const arrayUnion = (...items: unknown[]) => ({ __arrayUnion: items });
const arrayRemove = (...items: unknown[]) => ({ __arrayRemove: items });
const increment = (n: number) => ({ __increment: n });

// ─── Mock do admin ────────────────────────────────────────────────────────────

export const admin = {
  firestore: {
    FieldValue: { serverTimestamp, arrayUnion, arrayRemove, increment },
  },
};

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Aplica markers de arrayUnion / arrayRemove durante update/set-merge */
function applyArrayMarkers(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === 'object') {
      if ('__arrayUnion' in (value as object)) {
        const items = (value as { __arrayUnion: unknown[] }).__arrayUnion;
        const current = Array.isArray(merged[key]) ? (merged[key] as unknown[]) : [];
        merged[key] = [...new Set([...current, ...items])];
        continue;
      }
      if ('__arrayRemove' in (value as object)) {
        const items = (value as { __arrayRemove: unknown[] }).__arrayRemove;
        const current = Array.isArray(merged[key]) ? (merged[key] as unknown[]) : [];
        merged[key] = current.filter((x) => !items.includes(x));
        continue;
      }
      if ('__increment' in (value as object)) {
        const n = (value as { __increment: number }).__increment;
        const current = typeof merged[key] === 'number' ? (merged[key] as number) : 0;
        merged[key] = current + n;
        continue;
      }
    }
    merged[key] = value;
  }
  return merged;
}

/** Cria um DocumentRef fake para um caminho completo */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDocRef(fullPath: string, docId: string): any {
  return {
    id: docId,
    _fullPath: fullPath,

    get: jest.fn(async () => {
      const data = firestoreStore.get(fullPath);
      return { exists: !!data, id: docId, data: () => data };
    }),

    set: jest.fn(async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      if (options?.merge) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existing: any = firestoreStore.get(fullPath) ?? {};
        firestoreStore.set(fullPath, applyArrayMarkers(existing, data));
      } else {
        firestoreStore.set(fullPath, { ...data });
      }
    }),

    update: jest.fn(async (data: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing: any = firestoreStore.get(fullPath) ?? {};
      firestoreStore.set(fullPath, applyArrayMarkers(existing, data));
    }),

    delete: jest.fn(async () => {
      firestoreStore.delete(fullPath);
    }),

    /** Permite encadear subcoleções: docRef.collection('sub') */
    collection: jest.fn((subCol: string) => makeCollectionRef(`${fullPath}/${subCol}`)),
  };
}

/** Cria um CollectionRef fake para um caminho de coleção */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeCollectionRef(colPath: string, whereFilters: Array<{ field: string; op: string; value: unknown }> = []): any {
  // Apply in-memory where filters to get filtered docs
  function getFilteredDocs() {
    const prefix = `${colPath}/`;
    return [...firestoreStore.entries()]
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .filter(([, data]) =>
        whereFilters.every(({ field, op, value }) => {
          const fieldVal = (data as Record<string, unknown>)[field];
          if (op === '==') return fieldVal === value;
          if (op === '!=') return fieldVal !== value;
          if (op === 'in') return Array.isArray(value) && value.includes(fieldVal);
          if (op === 'not-in') return Array.isArray(value) && !value.includes(fieldVal);
          if (op === '>') return (fieldVal as number) > (value as number);
          if (op === '>=') return (fieldVal as number) >= (value as number);
          if (op === '<') return (fieldVal as number) < (value as number);
          if (op === '<=') return (fieldVal as number) <= (value as number);
          return true;
        }),
      )
      .map(([key, data]) => {
        const docId = key.slice(prefix.length);
        return { id: docId, data: () => data, exists: true, ref: makeDocRef(key, docId) };
      });
  }

  return {
    /**
     * doc(id?) → DocumentRef
     * Se id não fornecido, gera um ID aleatório (comportamento do Firestore real)
     */
    doc: jest.fn((id?: string) => {
      const docId = id ?? `auto-${Math.random().toString(36).slice(2, 10)}`;
      return makeDocRef(`${colPath}/${docId}`, docId);
    }),

    /** where — retorna um novo CollectionRef com o filtro acumulado */
    where: jest.fn((field: string, op: string, value: unknown) =>
      makeCollectionRef(colPath, [...whereFilters, { field, op, value }]),
    ),

    /** orderBy — retorna o mesmo CollectionRef (fluent, sem ordenação real no mock) */
    orderBy: jest.fn(() => makeCollectionRef(colPath, whereFilters)),

    /** limit — retorna um CollectionRef com limitação de resultados */
    limit: jest.fn((n: number) => {
      const limited = makeCollectionRef(colPath, whereFilters);
      const originalGet = limited.get;
      limited.get = jest.fn(async () => {
        const result = await originalGet();
        return { docs: result.docs.slice(0, n), empty: result.docs.slice(0, n).length === 0 };
      });
      return limited;
    }),

    /** get — retorna docs filtrados */
    get: jest.fn(async () => {
      const docs = getFilteredDocs();
      return { docs, empty: docs.length === 0 };
    }),
  };
}

// ─── Mock do db (Firestore) ───────────────────────────────────────────────────

export const db = {
  collection: jest.fn((col: string) => makeCollectionRef(col)),
  /** batch — simula escritas em lote (aplica ao store em memória) */
  batch: jest.fn(() => {
    const ops: Array<() => void> = [];
    return {
      set: jest.fn((ref: any, data: Record<string, unknown>, options?: { merge?: boolean }) => {
        ops.push(() => {
          if (options?.merge) {
            const existing: any = firestoreStore.get(ref._fullPath ?? ref.id) ?? {};
            firestoreStore.set(ref._fullPath ?? ref.id, applyArrayMarkers(existing, data));
          } else {
            firestoreStore.set(ref._fullPath ?? ref.id, { ...data });
          }
        });
      }),
      update: jest.fn((ref: any, data: Record<string, unknown>) => {
        ops.push(() => {
          const existing: any = firestoreStore.get(ref._fullPath ?? ref.id) ?? {};
          firestoreStore.set(ref._fullPath ?? ref.id, applyArrayMarkers(existing, data));
        });
      }),
      delete: jest.fn((ref: any) => {
        ops.push(() => firestoreStore.delete(ref._fullPath ?? ref.id));
      }),
      commit: jest.fn(async () => { ops.forEach(fn => fn()); }),
    };
  }),
  /** collectionGroup — busca subcoleções em qualquer profundidade */
  collectionGroup: jest.fn((subColName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: Array<{ field: string; op: string; value: unknown }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function makeGroupRef(activeFilters: typeof filters): any {
      function getGroupDocs() {
        return [...firestoreStore.entries()]
          .filter(([key]) => {
            const parts = key.split('/');
            return parts[parts.length - 2] === subColName;
          })
          .filter(([, data]) =>
            activeFilters.every(({ field, op, value }) => {
              const fieldVal = (data as Record<string, unknown>)[field];
              if (op === '==') return fieldVal === value;
              if (op === '!=') return fieldVal !== value;
              if (op === 'in') return Array.isArray(value) && value.includes(fieldVal);
              return true;
            }),
          )
          .map(([key, data]) => {
            const parts = key.split('/');
            const docId = parts[parts.length - 1];
            return { id: docId, data: () => data, exists: true };
          });
      }
      return {
        where: jest.fn((field: string, op: string, value: unknown) =>
          makeGroupRef([...activeFilters, { field, op, value }]),
        ),
        orderBy: jest.fn(() => makeGroupRef(activeFilters)),
        get: jest.fn(async () => {
          const docs = getGroupDocs();
          return { docs, empty: docs.length === 0 };
        }),
      };
    }
    return makeGroupRef(filters);
  }),
};

// ─── Mock do auth ─────────────────────────────────────────────────────────────

export const auth = {
  verifyIdToken: jest.fn(),
};
