/**
 * establishmentController — ações específicas do perfil de estabelecimento.
 *
 * Endpoints:
 *  POST   /users/me/establishment/producers/:producerUid   — vincula produtor
 *  DELETE /users/me/establishment/producers/:producerUid   — desvincula produtor
 *  GET    /users/me/establishment/producers                — lista produtores vinculados
 */

import { Request, Response } from 'express';
import {
  findEstablishmentProfile,
  linkProducer,
  unlinkProducer,
} from '../models/profiles/establishment';
import { findRuralProducerProfile } from '../models/profiles/ruralProducer';
import * as User from '../models/user';

/**
 * POST /users/me/establishment/producers/:producerUid
 * Vincula um produtor rural ao estabelecimento do usuário autenticado.
 */
export async function linkProducerToEstablishment(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user.uid);
  if (!user || !user.roles.includes('establishment')) {
    res.status(403).json({ error: 'User does not have the establishment role.' });
    return;
  }

  const producerUid = Array.isArray(req.params.producerUid) ? req.params.producerUid[0] : req.params.producerUid;
  if (!producerUid) {
    res.status(400).json({ error: 'producerUid is required.' });
    return;
  }

  try {
    // Verifica se o produtor existe e tem o role ruralProducer
    const producer = await User.findById(producerUid);
    if (!producer || !producer.roles.includes('ruralProducer')) {
      res.status(404).json({ error: 'Rural producer not found.' });
      return;
    }

    await linkProducer(req.user.uid, producerUid);
    res.json({ message: 'Producer linked successfully.', producerUid });
  } catch (e) {
    console.error('[linkProducerToEstablishment] error:', e);
    res.status(500).json({ error: 'Error linking producer.' });
  }
}

/**
 * DELETE /users/me/establishment/producers/:producerUid
 * Desvincula um produtor rural do estabelecimento.
 */
export async function unlinkProducerFromEstablishment(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user.uid);
  if (!user || !user.roles.includes('establishment')) {
    res.status(403).json({ error: 'User does not have the establishment role.' });
    return;
  }

  const producerUid = Array.isArray(req.params.producerUid) ? req.params.producerUid[0] : req.params.producerUid;
  if (!producerUid) {
    res.status(400).json({ error: 'producerUid is required.' });
    return;
  }

  try {
    await unlinkProducer(req.user.uid, producerUid);
    res.json({ message: 'Producer unlinked successfully.', producerUid });
  } catch (e) {
    console.error('[unlinkProducerFromEstablishment] error:', e);
    res.status(500).json({ error: 'Error unlinking producer.' });
  }
}

/**
 * GET /users/me/establishment/producers
 * Lista os produtores rurais vinculados ao estabelecimento, com seus perfis.
 */
export async function getLinkedProducers(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user.uid);
  if (!user || !user.roles.includes('establishment')) {
    res.status(403).json({ error: 'User does not have the establishment role.' });
    return;
  }

  try {
    const profile = await findEstablishmentProfile(req.user.uid);
    const producerIds: string[] = profile?.linkedProducerIds ?? [];

    const producers = await Promise.all(
      producerIds.map(async (uid) => {
        const account = await User.findById(uid);
        const producerProfile = await findRuralProducerProfile(uid);
        return {
          uid,
          displayName: account?.displayName ?? null,
          photoURL: account?.photoURL ?? null,
          profile: producerProfile ?? null,
        };
      }),
    );

    res.json({ producers });
  } catch (e) {
    console.error('[getLinkedProducers] error:', e);
    res.status(500).json({ error: 'Error fetching linked producers.' });
  }
}
