const { db, admin } = require("../config/firebase");

const VALID_ROLES = ["consumidor", "agricultor", "estabelecimento"];

const PROFILE_SCHEMAS = {
  consumidor: (p) => ({
    phone: p.phone || null,
    address: p.address || null,
    city: p.city || null,
    state: p.state || null,
    bio: p.bio || null,
    interests: Array.isArray(p.interests) ? p.interests : [],
  }),

  agricultor: (p) => ({
    phone: p.phone || null,
    farmName: p.farmName || null,
    address: p.address || null,
    city: p.city || null,
    state: p.state || null,
    bio: p.bio || null,
    products: Array.isArray(p.products) ? p.products : [],
    deliveryOptions: Array.isArray(p.deliveryOptions)
      ? p.deliveryOptions
      : [],
    organic: typeof p.organic === "boolean" ? p.organic : false,
    certifications: Array.isArray(p.certifications)
      ? p.certifications
      : [],
  }),

  estabelecimento: (p) => ({
    phone: p.phone || null,
    businessName: p.businessName || null,
    cnpj: p.cnpj || null,
    address: p.address || null,
    city: p.city || null,
    state: p.state || null,
    bio: p.bio || null,
    businessType: p.businessType || null,
    recurringNeeds: Array.isArray(p.recurringNeeds)
      ? p.recurringNeeds
      : [],
  }),
};

const COLLECTION = "users";

function sanitizeProfile(role, profile) {
  const schema = PROFILE_SCHEMAS[role];
  return schema ? schema(profile) : {};
}

function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

async function createUser({ uid, email, displayName, photoURL }) {
  const data = {
    email: email || null,
    displayName: displayName || null,
    photoURL: photoURL || null,
    role: "consumidor",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    active: true,
    profile: {},
  };

  await db.collection(COLLECTION).doc(uid).set(data);
  return data;
}

async function findById(uid) {
  const doc = await db.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function updateRole(uid, role) {
  const ref = db.collection(COLLECTION).doc(uid);
  await ref.update({
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { role };
}

async function updateProfile(uid, profileData) {
  const ref = db.collection(COLLECTION).doc(uid);
  await ref.update({
    profile: profileData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { profile: profileData };
}

function toPublicProfile(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: user.role,
    profile: user.profile,
    active: user.active,
  };
}

module.exports = {
  VALID_ROLES,
  sanitizeProfile,
  isValidRole,
  createUser,
  findById,
  updateRole,
  updateProfile,
  toPublicProfile,
};
