/**
 * favoritesController — gerencia favoritos do consumidor autenticado.
 *
 * GET    /users/me/favorites              → lista favoritos
 * POST   /users/me/favorites/:productId   → adiciona favorito
 * DELETE /users/me/favorites/:productId   → remove favorito
 */

import { Request, Response } from 'express';
import { listFavorites, addFavorite, removeFavorite } from '../models/favorite';

/** GET /users/me/favorites */
export async function getFavorites(req: Request, res: Response): Promise<void> {
  try {
    const uid = req.user.uid;
    const favorites = await listFavorites(uid);
    res.json({ favorites });
  } catch (e) {
    console.error('[favorites.getFavorites] error:', e);
    res.status(500).json({ error: 'Erro ao buscar favoritos.' });
  }
}

/** POST /users/me/favorites/:productId */
export async function addToFavorites(req: Request, res: Response): Promise<void> {
  try {
    const uid = req.user.uid;
    const productId = req.params.productId as string;
    const { producerUid } = req.body as { producerUid: string };

    if (!producerUid) {
      res.status(400).json({ error: 'producerUid é obrigatório.' });
      return;
    }

    const item = await addFavorite(uid, productId, producerUid);
    res.status(201).json({ favorite: item });
  } catch (e) {
    console.error('[favorites.addToFavorites] error:', e);
    res.status(500).json({ error: 'Erro ao adicionar favorito.' });
  }
}

/** DELETE /users/me/favorites/:productId */
export async function removeFromFavorites(req: Request, res: Response): Promise<void> {
  try {
    const uid = req.user.uid;
    const productId = req.params.productId as string;
    await removeFavorite(uid, productId);
    res.status(204).send();
  } catch (e) {
    console.error('[favorites.removeFromFavorites] error:', e);
    res.status(500).json({ error: 'Erro ao remover favorito.' });
  }
}
