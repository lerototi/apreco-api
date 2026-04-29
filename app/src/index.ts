import { onRequest } from 'firebase-functions/v2/https';
import { beforeUserCreated } from 'firebase-functions/v2/identity';
import * as User from './models/user';
import app from './server';

// ─── Blocking Function: ao criar conta no Auth, cria perfil no Firestore ────
exports.beforeUserCreated = beforeUserCreated(async (event) => {
  const user = event.data;
  if (!user) return {};
  const { uid, email, displayName, photoURL } = user;
  await User.createUser({ uid, email, displayName, photoURL });
  return {};
});

// ─── API HTTP ────────────────────────────────────────────────────────────────
exports.api = onRequest({ region: 'southamerica-east1' }, app);
