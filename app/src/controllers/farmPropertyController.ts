import { Request, Response } from 'express';
import {
  listFarmProperties,
  findFarmProperty,
  createFarmProperty,
  updateFarmProperty,
  deleteFarmProperty,
  buildFarmProperty,
} from '../models/farmProperty';

/** GET /users/me/properties */
export async function getMyProperties(req: Request, res: Response): Promise<void> {
  try {
    const properties = await listFarmProperties(req.user.uid);
    res.json({ properties });
  } catch (e) {
    console.error('[getMyProperties] error:', e);
    res.status(500).json({ error: 'Error fetching properties.' });
  }
}

/** POST /users/me/properties */
export async function createMyProperty(req: Request, res: Response): Promise<void> {
  const raw = req.body as Record<string, unknown>;

  const data = buildFarmProperty(raw);
  if (!data.name) {
    res.status(400).json({ error: 'O nome da propriedade é obrigatório.' });
    return;
  }

  try {
    const property = await createFarmProperty(req.user.uid, data);
    res.status(201).json({ property });
  } catch (e) {
    console.error('[createMyProperty] error:', e);
    res.status(500).json({ error: 'Error creating property.' });
  }
}

/** PUT /users/me/properties/:propertyId */
export async function updateMyProperty(req: Request, res: Response): Promise<void> {
  const propertyId = req.params['propertyId'] as string;
  const raw = req.body as Record<string, unknown>;

  const data = buildFarmProperty(raw);

  try {
    const existing = await findFarmProperty(req.user.uid, propertyId);
    if (!existing) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }
    const property = await updateFarmProperty(req.user.uid, propertyId, data);
    res.json({ property });
  } catch (e) {
    console.error('[updateMyProperty] error:', e);
    res.status(500).json({ error: 'Error updating property.' });
  }
}

/** DELETE /users/me/properties/:propertyId */
export async function deleteMyProperty(req: Request, res: Response): Promise<void> {
  const propertyId = req.params['propertyId'] as string;

  try {
    const existing = await findFarmProperty(req.user.uid, propertyId);
    if (!existing) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }
    await deleteFarmProperty(req.user.uid, propertyId);
    res.json({ message: 'Property deleted.' });
  } catch (e) {
    console.error('[deleteMyProperty] error:', e);
    res.status(500).json({ error: 'Error deleting property.' });
  }
}
