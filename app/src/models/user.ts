import { db, admin } from '../config/firebase';
import {
  ConsumerProfile,
  RuralProducerProfile,
  EstablishmentProfile,
  UserProfile,
  buildConsumerProfile,
  buildRuralProducerProfile,
  buildEstablishmentProfile,
} from './profiles';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'consumer' | 'ruralProducer' | 'establishment';

export interface UserDocument {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  active: boolean;
}

export interface PublicProfile {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  active: boolean;
}

export interface CreateUserInput {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

// Re-export profile types for consumers of this module
export type {
  ConsumerProfile,
  RuralProducerProfile,
  EstablishmentProfile,
  UserProfile,
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_ROLES: UserRole[] = ['consumer', 'ruralProducer', 'establishment'];

const COLLECTION = 'users';

// ─── Profile builders ─────────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

/**
 * Maps each UserRole to its profile builder function.
 * To add a new role: create a profile file, export a builder, and add it here.
 */
const PROFILE_BUILDERS: Record<UserRole, (p: ProfileInput) => UserProfile> = {
  consumer: buildConsumerProfile,
  ruralProducer: buildRuralProducerProfile,
  establishment: buildEstablishmentProfile,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function sanitizeProfile(role: UserRole, profile: ProfileInput): UserProfile {
  const build = PROFILE_BUILDERS[role];
  return build ? build(profile) : {};
}

export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

export function toPublicProfile(user: UserDocument): PublicProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: user.role,
    active: user.active,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createUser({ uid, email, displayName, photoURL }: CreateUserInput): Promise<Omit<UserDocument, 'id'>> {
  const data: Omit<UserDocument, 'id'> = {
    email: email ?? null,
    displayName: displayName ?? null,
    photoURL: photoURL ?? null,
    role: 'consumer',
    createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    active: true,
  };

  await db.collection(COLLECTION).doc(uid).set(data);
  return data;
}

export async function findById(uid: string): Promise<UserDocument | null> {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as UserDocument;
}

export async function updateRole(uid: string, role: UserRole): Promise<{ role: UserRole }> {
  await db.collection(COLLECTION).doc(uid).update({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { role };
}
