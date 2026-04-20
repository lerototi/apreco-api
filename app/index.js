const { onRequest } = require("firebase-functions/v2/https");
const { beforeUserCreated } = require("firebase-functions/v2/identity");
const User = require("./models/user");
const app = require("./server");

// ─── Blocking Function: ao criar conta no Auth, cria perfil no Firestore ────
exports.beforeUserCreated = beforeUserCreated(async (event) => {
  const { uid, email, displayName, photoURL } = event.data;
  await User.createUser({ uid, email, displayName, photoURL });
  return {};
});

// ─── API HTTP ───────────────────────────────────────────────────────────────
exports.api = onRequest({ region: "southamerica-east1" }, app);

