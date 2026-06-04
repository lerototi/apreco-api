/**
 * Schema do perfil do Establishment.
 *
 * Establishments are businesses (restaurants, markets, bakeries, etc.) that
 * use the platform to find suppliers and rural producers.
 *
 * Bridge fields (instagram, website, avatarUrl, userName) allow the
 * establishment to be discovered by rural producers and vice-versa.
 */

import { db } from '../../config/firebase';

// ─── Interface ────────────────────────────────────────────────────────────────

interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface EstablishmentProfile {
  /** URL do avatar / logo do estabelecimento */
  avatarUrl: string | null;
  /** @handle único para o estabelecimento na plataforma */
  userName: string | null;
  /** Razão social ou nome fantasia */
  businessName: string | null;
  /** CNPJ (formato: XX.XXX.XXX/XXXX-XX) */
  cnpj: string | null;
  /** Tipo do negócio (ex: restaurante, mercado, padaria) */
  businessType: string | null;
  /** Descrição do estabelecimento */
  bio: string | null;
  /** Localização geográfica do estabelecimento */
  location: GeoPoint | null;
  /** Telefone de contato */
  phone: string | null;
  /** Se o telefone é WhatsApp */
  isWhatsApp: boolean;
  /** Instagram do estabelecimento */
  instagram: string | null;
  /** Website do estabelecimento */
  website: string | null;
  /** Necessidades recorrentes de insumos (ex: verduras, frutas, ovos) */
  recurringNeeds: string[];
  /**
   * IDs dos produtores rurais que fornecem para este estabelecimento.
   * Ponte bidirecional: produtor também pode se vincular ao estabelecimento.
   */
  linkedProducerIds: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseGeoPoint(value: unknown): GeoPoint | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as any).latitude === 'number' &&
    typeof (value as any).longitude === 'number'
  ) {
    return {
      latitude: (value as any).latitude,
      longitude: (value as any).longitude,
    };
  }
  return null;
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildEstablishmentProfile(p: ProfileInput): EstablishmentProfile {
  return {
    avatarUrl: (p.avatarUrl as string) || null,
    userName: (p.userName as string) || null,
    businessName: (p.businessName as string) || null,
    cnpj: (p.cnpj as string) || null,
    businessType: (p.businessType as string) || null,
    bio: (p.bio as string) || null,
    location: parseGeoPoint(p.location),
    phone: (p.phone as string) || null,
    isWhatsApp: typeof p.isWhatsApp === 'boolean' ? p.isWhatsApp : false,
    instagram: (p.instagram as string) || null,
    website: (p.website as string) || null,
    recurringNeeds: Array.isArray(p.recurringNeeds) ? (p.recurringNeeds as string[]) : [],
    linkedProducerIds: Array.isArray(p.linkedProducerIds) ? (p.linkedProducerIds as string[]) : [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const COLLECTION = 'establishments';

export async function createEstablishmentProfile(uid: string, data: EstablishmentProfile): Promise<EstablishmentProfile> {
  await db.collection(COLLECTION).doc(uid).set(data);
  return data;
}

export async function findEstablishmentProfile(uid: string): Promise<EstablishmentProfile | null> {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as EstablishmentProfile;
}

export async function updateEstablishmentProfile(uid: string, data: EstablishmentProfile): Promise<EstablishmentProfile> {
  await db.collection(COLLECTION).doc(uid).set(data, { merge: true });
  return data;
}

// ─── Ponte produtor ────────────────────────────────────────────────────────────

/**
 * Vincula um produtor rural a este estabelecimento (idempotente).
 */
export async function linkProducer(establishmentUid: string, producerUid: string): Promise<void> {
  await db.collection(COLLECTION).doc(establishmentUid).set(
    { linkedProducerIds: admin_arrayUnion(producerUid) },
    { merge: true },
  );
}

/**
 * Desvincula um produtor rural deste estabelecimento.
 */
export async function unlinkProducer(establishmentUid: string, producerUid: string): Promise<void> {
  await db.collection(COLLECTION).doc(establishmentUid).set(
    { linkedProducerIds: admin_arrayRemove(producerUid) },
    { merge: true },
  );
}

// Importações tardias para evitar dependência circular com config/firebase
import { admin } from '../../config/firebase';
function admin_arrayUnion(value: string) {
  return admin.firestore.FieldValue.arrayUnion(value);
}
function admin_arrayRemove(value: string) {
  return admin.firestore.FieldValue.arrayRemove(value);
}
