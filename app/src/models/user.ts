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
  /** Primary / legacy single role — kept for backwards compatibility. */
  role: UserRole;
  /** All roles this user has active profiles for. Always includes `role`. */
  roles: UserRole[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  active: boolean;
}

export interface PublicProfile {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  roles: UserRole[];
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
    roles: user.roles ?? [user.role],
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
    roles: ['consumer'],
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
  const data = doc.data()!;
  // Back-compat: if doc was created before multi-role, synthesise roles from role
  if (!data.roles) {
    data.roles = [data.role];
  }
  return { id: doc.id, ...data } as UserDocument;
}

/**
 * Adds a role to the user's roles array (idempotent).
 * Also updates the legacy `role` field to the new role so existing
 * single-role code paths continue to work.
 */
export async function addRole(uid: string, role: UserRole): Promise<{ roles: UserRole[] }> {
  await db.collection(COLLECTION).doc(uid).update({
    role,
    roles: admin.firestore.FieldValue.arrayUnion(role),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const updated = await findById(uid);
  return { roles: updated?.roles ?? [role] };
}

/**
 * @deprecated Use addRole instead.
 * Kept for internal back-compat — replaces the entire roles array with a single role.
 */
export async function updateRole(uid: string, role: UserRole): Promise<{ roles: UserRole[] }> {
  return addRole(uid, role);
}
