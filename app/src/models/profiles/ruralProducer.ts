import { db } from '../../config/firebase';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RuralProducerProfile {
  /** URL do avatar do perfil (por enquanto URL externa; futuramente upload) */
  avatarUrl: string | null;
  /** Nome de usuário público único (ex: joao_horta) — equivalente ao @username do Instagram */
  userName: string | null;
  /** Nome de exibição do perfil (ex: João da Horta) */
  displayName: string | null;
  /** Descrição livre sobre o produtor e sua produção */
  bio: string | null;
  /** Telefone de contato (formato: +55XXXXXXXXXXX) */
  phone: string | null;
  /** Indica se o número de telefone também é WhatsApp */
  isWhatsApp: boolean;
  /** Instagram handle (sem @) */
  instagram: string | null;
  /** Site ou loja online */
  website: string | null;
  /** Indica se a produção é orgânica/agroecológica */
  organic: boolean;
  /** Certificações obtidas (ex: IBD, Ecocert, SisOrg) */
  certifications: string[];
  /** Opções de entrega disponíveis (ex: retirada, entrega a domicílio, feira) */
  deliveryOptions: string[];
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildRuralProducerProfile(p: ProfileInput): RuralProducerProfile {
  return {
    avatarUrl: (p.avatarUrl as string) || null,
    userName: (p.userName as string) || null,
    displayName: (p.displayName as string) || null,
    bio: (p.bio as string) || null,
    phone: (p.phone as string) || null,
    isWhatsApp: typeof p.isWhatsApp === 'boolean' ? p.isWhatsApp : false,
    instagram: (p.instagram as string) || null,
    website: (p.website as string) || null,
    organic: typeof p.organic === 'boolean' ? p.organic : false,
    certifications: Array.isArray(p.certifications) ? (p.certifications as string[]) : [],
    deliveryOptions: Array.isArray(p.deliveryOptions) ? (p.deliveryOptions as string[]) : [],
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

const COLLECTION = 'ruralProducers';

export async function createRuralProducerProfile(uid: string, data: RuralProducerProfile): Promise<RuralProducerProfile> {
  await db.collection(COLLECTION).doc(uid).set(data);
  return data;
}

export async function findRuralProducerProfile(uid: string): Promise<RuralProducerProfile | null> {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as RuralProducerProfile;
}

export async function updateRuralProducerProfile(uid: string, data: RuralProducerProfile): Promise<RuralProducerProfile> {
  await db.collection(COLLECTION).doc(uid).set(data, { merge: true });
  return data;
}

/**
 * Lista todos os perfis de produtor rural (marketplace público).
 * Retorna uid + campos do perfil.
 */
export async function listAllProducers(): Promise<(RuralProducerProfile & { uid: string })[]> {
  const snap = await db.collection(COLLECTION).get();
  return snap.docs.map(d => ({ uid: d.id, ...(d.data() as RuralProducerProfile) }));
}
