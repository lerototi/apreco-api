import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'apreco-app-br';
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
    storageBucket,
  });
}

console.log('[firebase] projectId:', projectId);
console.log('[firebase] storageBucket:', storageBucket);
console.log('[firebase] GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);

const db = admin.firestore();
db.settings({ databaseId: '(default)' });

const auth = admin.auth();
const storage: admin.storage.Storage = admin.storage();

export { admin, db, auth, storage, storageBucket };
