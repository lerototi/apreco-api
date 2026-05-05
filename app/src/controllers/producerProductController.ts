import { Request, Response } from 'express';
import {
  listProducerProducts,
  findProducerProduct,
  createProducerProduct,
  updateProducerProduct,
  deleteProducerProduct,
  buildProducerProduct,
} from '../models/producerProduct';

/** GET /users/me/products */
export async function getMyProducts(req: Request, res: Response): Promise<void> {
  try {
    const products = await listProducerProducts(req.user.uid);
    res.json({ products });
  } catch (e) {
    console.error('[getMyProducts] error:', e);
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
}

/** POST /users/me/products */
export async function createMyProduct(req: Request, res: Response): Promise<void> {
  const raw = req.body as Record<string, unknown>;
  const data = buildProducerProduct(raw);

  if (!data.name) {
    res.status(400).json({ error: 'O nome do produto é obrigatório.' });
    return;
  }
  if (!data.permanent && data.seasonal && !data.publishedUntil) {
    res.status(400).json({ error: 'Produto sazonal requer data de expiração (publishedUntil).' });
    return;
  }

  try {
    const product = await createProducerProduct(req.user.uid, data);
    res.status(201).json({ product });
  } catch (e) {
    console.error('[createMyProduct] error:', e);
    res.status(500).json({ error: 'Erro ao criar produto.' });
  }
}

/** PUT /users/me/products/:productId */
export async function updateMyProduct(req: Request, res: Response): Promise<void> {
  const productId = req.params['productId'] as string;
  const raw = req.body as Record<string, unknown>;
  const data = buildProducerProduct(raw);

  try {
    const existing = await findProducerProduct(req.user.uid, productId);
    if (!existing) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }
    const product = await updateProducerProduct(req.user.uid, productId, data);
    res.json({ product });
  } catch (e) {
    console.error('[updateMyProduct] error:', e);
    res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
}

/** DELETE /users/me/products/:productId */
export async function deleteMyProduct(req: Request, res: Response): Promise<void> {
  const productId = req.params['productId'] as string;

  try {
    const existing = await findProducerProduct(req.user.uid, productId);
    if (!existing) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }
    await deleteProducerProduct(req.user.uid, productId);
    res.json({ message: 'Produto removido.' });
  } catch (e) {
    console.error('[deleteMyProduct] error:', e);
    res.status(500).json({ error: 'Erro ao remover produto.' });
  }
}
