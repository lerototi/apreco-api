import { db, admin } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'consumidor' | 'agricultor' | 'estabelecimento';

export interface ConsumidorProfile {
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  interests: string[];
}

export interface AgricultorProfile {
  phone: string | null;
  farmName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  products: string[];
  deliveryOptions: string[];
  organic: boolean;
  certifications: string[];
}

export interface EstabelecimentoProfile {
  phone: string | null;
  businessName: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  businessType: string | null;
  recurringNeeds: string[];
}

export type UserProfile = ConsumidorProfile | AgricultorProfile | EstabelecimentoProfile | Record<string, unknown>;

export interface UserDocument {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  active: boolean;
  profile: UserProfile;
}

export interface PublicProfile {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  profile: UserProfile;
  active: boolean;
}

export interface CreateUserInput {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_ROLES: UserRole[] = ['consumidor', 'agricultor', 'estabelecimento'];

const COLLECTION = 'users';

// ─── Profile schemas ──────────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

const PROFILE_SCHEMAS: Record<UserRole, (p: ProfileInput) => UserProfile> = {
  consumidor: (p): ConsumidorProfile => ({
    phone: (p.phone as string) || null,
    address: (p.address as string) || null,
    city: (p.city as string) || null,
    state: (p.state as string) || null,
    bio: (p.bio as string) || null,
    interests: Array.isArray(p.interests) ? (p.interests as string[]) : [],
  }),

  agricultor: (p): AgricultorProfile => ({
    phone: (p.phone as string) || null,
    farmName: (p.farmName as string) || null,
    address: (p.address as string) || null,
    city: (p.city as string) || null,
    state: (p.state as string) || null,
    bio: (p.bio as string) || null,
    products: Array.isArray(p.products) ? (p.products as string[]) : [],
    deliveryOptions: Array.isArray(p.deliveryOptions) ? (p.deliveryOptions as string[]) : [],
    organic: typeof p.organic === 'boolean' ? p.organic : false,
    certifications: Array.isArray(p.certifications) ? (p.certifications as string[]) : [],
  }),

  estabelecimento: (p): EstabelecimentoProfile => ({
    phone: (p.phone as string) || null,
    businessName: (p.businessName as string) || null,
    cnpj: (p.cnpj as string) || null,
    address: (p.address as string) || null,
    city: (p.city as string) || null,
    state: (p.state as string) || null,
    bio: (p.bio as string) || null,
    businessType: (p.businessType as string) || null,
    recurringNeeds: Array.isArray(p.recurringNeeds) ? (p.recurringNeeds as string[]) : [],
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function sanitizeProfile(role: UserRole, profile: ProfileInput): UserProfile {
  const schema = PROFILE_SCHEMAS[role];
  return schema ? schema(profile) : {};
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
    profile: user.profile,
    active: user.active,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createUser({ uid, email, displayName, photoURL }: CreateUserInput): Promise<Omit<UserDocument, 'id'>> {
  const data: Omit<UserDocument, 'id'> = {
    email: email ?? null,
    displayName: displayName ?? null,
    photoURL: photoURL ?? null,
    role: 'consumidor',
    createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
    active: true,
    profile: {},
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

export async function updateProfile(uid: string, profileData: UserProfile): Promise<{ profile: UserProfile }> {
  await db.collection(COLLECTION).doc(uid).update({
    profile: profileData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { profile: profileData };
}
