import { Request, Response } from 'express';
import {
  listProducerInputs,
  findProducerInput,
  createProducerInput,
  updateProducerInput,
  deleteProducerInput,
  buildProducerInput,
} from '../models/producerInput';

/** GET /users/me/inputs */
export async function getMyInputs(req: Request, res: Response): Promise<void> {
  try {
    const inputs = await listProducerInputs(req.user.uid);
    res.json({ inputs });
  } catch (e) {
    console.error('[getMyInputs] error:', e);
    res.status(500).json({ error: 'Erro ao buscar insumos.' });
  }
}

/** POST /users/me/inputs */
export async function createMyInput(req: Request, res: Response): Promise<void> {
  const raw = req.body as Record<string, unknown>;
  const data = buildProducerInput(raw);

  if (!data.name) {
    res.status(400).json({ error: 'O nome do insumo é obrigatório.' });
    return;
  }
  if (!data.permanent && data.seasonal && !data.publishedUntil) {
    res.status(400).json({ error: 'Insumo sazonal requer data de expiração (publishedUntil).' });
    return;
  }

  try {
    const input = await createProducerInput(req.user.uid, data);
    res.status(201).json({ input });
  } catch (e) {
    console.error('[createMyInput] error:', e);
    res.status(500).json({ error: 'Erro ao criar insumo.' });
  }
}

/** PUT /users/me/inputs/:inputId */
export async function updateMyInput(req: Request, res: Response): Promise<void> {
  const inputId = req.params['inputId'] as string;
  const raw = req.body as Record<string, unknown>;
  const data = buildProducerInput(raw);

  try {
    const existing = await findProducerInput(req.user.uid, inputId);
    if (!existing) {
      res.status(404).json({ error: 'Insumo não encontrado.' });
      return;
    }
    const updated = await updateProducerInput(req.user.uid, inputId, data);
    res.json({ input: updated });
  } catch (e) {
    console.error('[updateMyInput] error:', e);
    res.status(500).json({ error: 'Erro ao atualizar insumo.' });
  }
}

/** DELETE /users/me/inputs/:inputId */
export async function deleteMyInput(req: Request, res: Response): Promise<void> {
  const inputId = req.params['inputId'] as string;

  try {
    const existing = await findProducerInput(req.user.uid, inputId);
    if (!existing) {
      res.status(404).json({ error: 'Insumo não encontrado.' });
      return;
    }
    await deleteProducerInput(req.user.uid, inputId);
    res.json({ message: 'Insumo removido.' });
  } catch (e) {
    console.error('[deleteMyInput] error:', e);
    res.status(500).json({ error: 'Erro ao remover insumo.' });
  }
}
