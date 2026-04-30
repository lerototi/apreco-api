/**
 * Schema do perfil do Consumidor.
 *
 * Consumidores são usuários que utilizam a plataforma para encontrar e adquirir
 * produtos de produtores rurais e estabelecimentos.
 */

import { db } from '../../config/firebase';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ConsumidorProfile {
  /** Nome de exibição do consumidor */
  name: string | null;
  /** Cidade de residência */
  city: string | null;
  /** Bairro de residência */
  neighborhood: string | null;
  /** Interesses alimentares (ex: orgânicos, veganos, sazonais) */
  interests: string[];
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildConsumidorProfile(p: ProfileInput): ConsumidorProfile {
  return {
    name: (p.name as string) || null,
    city: (p.city as string) || null,
    neighborhood: (p.neighborhood as string) || null,
    interests: Array.isArray(p.interests) ? (p.interests as string[]) : [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const COLLECTION = 'consumidores';

export async function createConsumidorProfile(uid: string, data: ConsumidorProfile): Promise<ConsumidorProfile> {
  await db.collection(COLLECTION).doc(uid).set(data);
  return data;
}

export async function findConsumidorProfile(uid: string): Promise<ConsumidorProfile | null> {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as ConsumidorProfile;
}

export async function updateConsumidorProfile(uid: string, data: ConsumidorProfile): Promise<ConsumidorProfile> {
  await db.collection(COLLECTION).doc(uid).set(data, { merge: true });
  return data;
}
