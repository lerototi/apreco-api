/**
 * Schema do perfil do Establishment.
 *
 * Establishments are businesses (restaurants, markets, bakeries, etc.) that
 * use the platform to find suppliers and rural producers.
 */

import { db } from '../../config/firebase';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface EstablishmentProfile {
  /** Telefone de contato */
  phone: string | null;
  /** Razão social ou nome fantasia */
  businessName: string | null;
  /** CNPJ (formato: XX.XXX.XXX/XXXX-XX) */
  cnpj: string | null;
  /** Endereço completo */
  address: string | null;
  /** Cidade */
  city: string | null;
  /** Estado (sigla, ex: SP) */
  state: string | null;
  /** Descrição do estabelecimento */
  bio: string | null;
  /** Tipo do negócio (ex: restaurante, mercado, padaria) */
  businessType: string | null;
  /** Necessidades recorrentes de insumos (ex: verduras, frutas, ovos) */
  recurringNeeds: string[];
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildEstablishmentProfile(p: ProfileInput): EstablishmentProfile {
  return {
    phone: (p.phone as string) || null,
    businessName: (p.businessName as string) || null,
    cnpj: (p.cnpj as string) || null,
    address: (p.address as string) || null,
    city: (p.city as string) || null,
    state: (p.state as string) || null,
    bio: (p.bio as string) || null,
    businessType: (p.businessType as string) || null,
    recurringNeeds: Array.isArray(p.recurringNeeds) ? (p.recurringNeeds as string[]) : [],
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
