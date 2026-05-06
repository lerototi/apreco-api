/**
 * Modelo de Favoritos do consumidor.
 *
 * Subcoleção no Firestore:
 *   users/{uid}/favorites/{productId}
 *
 * O documento armazena um snapshot leve do produto (producerUid + snapshot)
 * para permitir exibição offline e sem re-fetch, mas o campo canônico
 * é o productId (= doc.id).
 */

import { db } from '../config/firebase';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface FavoriteItem {
  /** ID do produto (= doc.id na subcoleção) */
  productId: string;
  /** UID do produtor dono do produto */
  producerUid: string;
  /** ISO timestamp de quando o favorito foi adicionado */
  savedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function favoritesCol(uid: string) {
  return db.collection('users').doc(uid).collection('favorites');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listFavorites(uid: string): Promise<FavoriteItem[]> {
  const snap = await favoritesCol(uid).orderBy('savedAt', 'desc').get();
  return snap.docs.map(d => ({ productId: d.id, ...d.data() } as FavoriteItem));
}

export async function addFavorite(
  uid: string,
  productId: string,
  producerUid: string,
): Promise<FavoriteItem> {
  const item: FavoriteItem = {
    productId,
    producerUid,
    savedAt: new Date().toISOString(),
  };
  await favoritesCol(uid).doc(productId).set(item);
  return item;
}

export async function removeFavorite(uid: string, productId: string): Promise<void> {
  await favoritesCol(uid).doc(productId).delete();
}

export async function isFavorite(uid: string, productId: string): Promise<boolean> {
  const doc = await favoritesCol(uid).doc(productId).get();
  return doc.exists;
}
