/**
 * Testes unitários — src/controllers/establishmentController.ts
 *
 * Cobre:
 *  - linkProducerToEstablishment:
 *      usuário sem role establishment (403)
 *      produtor não encontrado / sem role ruralProducer (404)
 *      vinculação bem-sucedida
 *      erro do Firestore (500)
 *
 *  - unlinkProducerFromEstablishment:
 *      usuário sem role establishment (403)
 *      desvinculação bem-sucedida
 *      erro do Firestore (500)
 *
 *  - getLinkedProducers:
 *      usuário sem role establishment (403)
 *      lista vazia quando não há produtores vinculados
 *      lista com produtores vinculados (com perfil)
 *      erro do Firestore (500)
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
  linkProducerToEstablishment,
  unlinkProducerFromEstablishment,
  getLinkedProducers,
} from '../../controllers/establishmentController';
import {
  makeRequest,
  makeResponse,
  makeEstablishment,
  makeRuralProducer,
  makeEstablishmentProfile,
  makeRuralProducerProfile,
} from '../helpers/factories';

/**
 * O makeRequest() usa uid-test-001 como usuário autenticado.
 * Portanto o "establishment" autenticado nos testes tem UID uid-test-001.
 */
const EST_UID = 'uid-test-001';
const PROD_UID = 'uid-ruralproducer-001';

/** Helpers para semear o store */
const seedUser = (doc: Record<string, unknown>) =>
  firestoreStore.set(`users/${doc.id as string}`, doc as Record<string, unknown>);

const seedEstablishmentProfile = (uid: string, extra: Record<string, unknown> = {}) =>
  firestoreStore.set(`establishments/${uid}`, {
    ...makeEstablishmentProfile(),
    linkedProducerIds: [],
    ...extra,
  } as Record<string, unknown>);

const seedRuralProducerProfile = (uid: string) =>
  firestoreStore.set(`ruralProducers/${uid}`, makeRuralProducerProfile() as unknown as Record<string, unknown>);

beforeEach(() => {
  firestoreStore.clear();
});

// ─── linkProducerToEstablishment ──────────────────────────────────────────────

describe('linkProducerToEstablishment', () => {
  it('retorna 403 quando usuário não tem role establishment', async () => {
    const consumer = { ...makeEstablishment({ id: EST_UID, roles: ['consumer'], role: 'consumer' }) };
    seedUser(consumer as unknown as Record<string, unknown>);

    const req = makeRequest({ params: { producerUid: PROD_UID } });
    const res = makeResponse();

    await linkProducerToEstablishment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'User does not have the establishment role.' });
  });

  it('retorna 404 quando produtor não existe', async () => {
    const est = makeEstablishment({ id: EST_UID });
    seedUser(est as unknown as Record<string, unknown>);

    const req = makeRequest({ params: { producerUid: 'uid-inexistente' } });
    const res = makeResponse();

    await linkProducerToEstablishment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Rural producer not found.' });
  });

  it('retorna 404 quando usuário existe mas não tem role ruralProducer', async () => {
    const est = makeEstablishment({ id: EST_UID });
    const consumer = { ...makeEstablishment({ id: PROD_UID, roles: ['consumer'], role: 'consumer' }) };
    seedUser(est as unknown as Record<string, unknown>);
    seedUser(consumer as unknown as Record<string, unknown>);

    const req = makeRequest({ params: { producerUid: PROD_UID } });
    const res = makeResponse();

    await linkProducerToEstablishment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('vincula produtor com sucesso e retorna mensagem', async () => {
    const est = makeEstablishment({ id: EST_UID });
    const producer = makeRuralProducer({ id: PROD_UID });
    seedUser(est as unknown as Record<string, unknown>);
    seedUser(producer as unknown as Record<string, unknown>);
    seedEstablishmentProfile(EST_UID);

    const req = makeRequest({ params: { producerUid: PROD_UID } });
    const res = makeResponse();

    await linkProducerToEstablishment(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Producer linked successfully.',
      producerUid: PROD_UID,
    });

    // Verifica que o ID foi adicionado ao store
    const estProfile = firestoreStore.get(`establishments/${EST_UID}`) as Record<string, unknown>;
    expect((estProfile.linkedProducerIds as string[])).toContain(PROD_UID);
  });
});

// ─── unlinkProducerFromEstablishment ──────────────────────────────────────────

describe('unlinkProducerFromEstablishment', () => {
  it('retorna 403 quando usuário não tem role establishment', async () => {
    const consumer = { ...makeEstablishment({ id: EST_UID, roles: ['consumer'], role: 'consumer' }) };
    seedUser(consumer as unknown as Record<string, unknown>);

    const req = makeRequest({ params: { producerUid: PROD_UID } });
    const res = makeResponse();

    await unlinkProducerFromEstablishment(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('desvincula produtor com sucesso', async () => {
    const est = makeEstablishment({ id: EST_UID });
    seedUser(est as unknown as Record<string, unknown>);
    seedEstablishmentProfile(EST_UID, { linkedProducerIds: [PROD_UID] });

    const req = makeRequest({ params: { producerUid: PROD_UID } });
    const res = makeResponse();

    await unlinkProducerFromEstablishment(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: 'Producer unlinked successfully.',
      producerUid: PROD_UID,
    });

    // Verifica que o ID foi removido do store
    const estProfile = firestoreStore.get(`establishments/${EST_UID}`) as Record<string, unknown>;
    expect((estProfile.linkedProducerIds as string[])).not.toContain(PROD_UID);
  });
});

// ─── getLinkedProducers ───────────────────────────────────────────────────────

describe('getLinkedProducers', () => {
  it('retorna 403 quando usuário não tem role establishment', async () => {
    const consumer = { ...makeEstablishment({ id: EST_UID, roles: ['consumer'], role: 'consumer' }) };
    seedUser(consumer as unknown as Record<string, unknown>);

    const req = makeRequest();
    const res = makeResponse();

    await getLinkedProducers(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna lista vazia quando não há produtores vinculados', async () => {
    const est = makeEstablishment({ id: EST_UID });
    seedUser(est as unknown as Record<string, unknown>);
    seedEstablishmentProfile(EST_UID, { linkedProducerIds: [] });

    const req = makeRequest();
    const res = makeResponse();

    await getLinkedProducers(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.producers).toEqual([]);
  });

  it('retorna lista vazia quando perfil do estabelecimento não existe ainda', async () => {
    const est = makeEstablishment({ id: EST_UID });
    seedUser(est as unknown as Record<string, unknown>);
    // sem seedEstablishmentProfile → doc não existe

    const req = makeRequest();
    const res = makeResponse();

    await getLinkedProducers(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.producers).toEqual([]);
  });

  it('retorna lista com produtores vinculados e seus perfis', async () => {
    const est = makeEstablishment({ id: EST_UID });
    const producer = makeRuralProducer({ id: PROD_UID });
    seedUser(est as unknown as Record<string, unknown>);
    seedUser(producer as unknown as Record<string, unknown>);
    seedEstablishmentProfile(EST_UID, { linkedProducerIds: [PROD_UID] });
    seedRuralProducerProfile(PROD_UID);

    const req = makeRequest();
    const res = makeResponse();

    await getLinkedProducers(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.producers).toHaveLength(1);
    expect(returned.producers[0].uid).toBe(PROD_UID);
    expect(returned.producers[0].displayName).toBe(producer.displayName);
    expect(returned.producers[0].profile).not.toBeNull();
  });
});
