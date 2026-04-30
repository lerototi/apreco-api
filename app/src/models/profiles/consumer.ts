/**
 * Schema do perfil do Consumer (Consumidor).
 *
 * Consumers are users who use the platform to find and acquire
 * products from rural producers and establishments.
 */

import { db } from '../../config/firebase';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ConsumerProfile {
  /** Display name */
  name: string | null;
  /** City of residence */
  city: string | null;
  /** Neighborhood */
  neighborhood: string | null;
  /** Food interests (e.g. organic, vegan, seasonal) */
  interests: string[];
}

// ─── Schema (sanitization) ────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildConsumerProfile(p: ProfileInput): ConsumerProfile {
  return {
    name: (p.name as string) || null,
    city: (p.city as string) || null,
    neighborhood: (p.neighborhood as string) || null,
    interests: Array.isArray(p.interests) ? (p.interests as string[]) : [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const COLLECTION = 'consumers';

export async function createConsumerProfile(uid: string, data: ConsumerProfile): Promise<ConsumerProfile> {
  await db.collection(COLLECTION).doc(uid).set(data);
  return data;
}

export async function findConsumerProfile(uid: string): Promise<ConsumerProfile | null> {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as ConsumerProfile;
}

export async function updateConsumerProfile(uid: string, data: ConsumerProfile): Promise<ConsumerProfile> {
  await db.collection(COLLECTION).doc(uid).set(data, { merge: true });
  return data;
}
