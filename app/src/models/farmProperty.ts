/**
 * Modelo de Propriedade Rural (FarmProperty).
 *
 * Cada propriedade pertence a um produtor rural e é armazenada na subcoleção:
 *   ruralProducers/{producerUid}/properties/{propertyId}
 *
 * Um produtor pode ter uma ou mais propriedades (sítio, horta urbana, etc.).
 */

import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface FarmProperty {
  id: string;
  /** Nome da propriedade (ex: Sítio Boa Esperança) */
  name: string;
  /** Descrição das produções realizadas nesta propriedade */
  description: string | null;
  /** Coordenadas GPS */
  location: GeoPoint | null;
  /** URLs das fotos armazenadas no Firebase Storage */
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export type FarmPropertyInput = Omit<FarmProperty, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Schema ───────────────────────────────────────────────────────────────────

type RawInput = Record<string, unknown>;

export function buildFarmProperty(p: RawInput): FarmPropertyInput {
  const loc = p.location as Record<string, unknown> | null | undefined;
  return {
    name: ((p.name as string) || '').trim(),
    description: (p.description as string) || null,
    location:
      loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
        ? { latitude: loc.latitude, longitude: loc.longitude }
        : null,
    photos: Array.isArray(p.photos) ? (p.photos as string[]) : [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function propertiesCol(producerUid: string) {
  return db.collection('ruralProducers').doc(producerUid).collection('properties');
}

export async function listFarmProperties(producerUid: string): Promise<FarmProperty[]> {
  const snap = await propertiesCol(producerUid).orderBy('createdAt', 'asc').get();
  return snap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => ({ id: d.id, ...d.data() } as FarmProperty));
}

export async function findFarmProperty(producerUid: string, propertyId: string): Promise<FarmProperty | null> {
  const doc = await propertiesCol(producerUid).doc(propertyId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as FarmProperty;
}

export async function createFarmProperty(
  producerUid: string,
  data: FarmPropertyInput,
): Promise<FarmProperty> {
  const now = new Date().toISOString();
  const ref = propertiesCol(producerUid).doc();
  const property: FarmProperty = { id: ref.id, ...data, createdAt: now, updatedAt: now };
  await ref.set(property);
  return property;
}

export async function updateFarmProperty(
  producerUid: string,
  propertyId: string,
  data: Partial<FarmPropertyInput>,
): Promise<FarmProperty> {
  const now = new Date().toISOString();
  await propertiesCol(producerUid).doc(propertyId).update({ ...data, updatedAt: now });
  const updated = await findFarmProperty(producerUid, propertyId);
  if (!updated) throw new Error('Property not found after update.');
  return updated;
}

export async function deleteFarmProperty(producerUid: string, propertyId: string): Promise<void> {
  await propertiesCol(producerUid).doc(propertyId).delete();
}
