/**
 * marketplaceController — endpoints públicos do marketplace.
 *
 * GET /marketplace/products  → lista todos os produtos ativos de todos os produtores
 * GET /marketplace/producers → lista todos os perfis de produtores
 */

import { Request, Response } from 'express';
import { listAllActiveProducts } from '../models/producerProduct';
import { listAllProducers } from '../models/profiles/ruralProducer';

/** GET /marketplace/products */
export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const products = await listAllActiveProducts();
    res.json({ products });
  } catch (e) {
    console.error('[marketplace.getProducts] error:', e);
    res.status(500).json({ error: 'Erro ao buscar produtos.' });
  }
}

/** GET /marketplace/producers */
export async function getProducers(req: Request, res: Response): Promise<void> {
  try {
    const producers = await listAllProducers();
    res.json({ producers });
  } catch (e) {
    console.error('[marketplace.getProducers] error:', e);
    res.status(500).json({ error: 'Erro ao buscar produtores.' });
  }
}
