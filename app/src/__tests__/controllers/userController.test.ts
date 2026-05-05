/**
 * Testes unitários — src/controllers/userController.ts
 *
 * Cobre:
 *  - getMe: perfil encontrado, auto-criação, erro do Firestore
 *  - addMyRole: role válido, role inválido, idempotência
 *  - updateMyProfile: perfil válido, role via query param, body inválido, usuário não encontrado
 *  - getById: encontrado, não encontrado, erro
 */

import { firestoreStore, db as mockDb } from '../__mocks__/firebase-module';

import { getMe, addMyRole, updateMyProfile, getById } from '../../controllers/userController';
import {
  makeUser,
  makeRuralProducer,
  makeMultiRoleUser,
  makeRequest,
  makeResponse,
  makeConsumerProfile,
  makeRuralProducerProfile,
} from '../helpers/factories';

beforeEach(() => {
  firestoreStore.clear();
});

// ─── getMe ────────────────────────────────────────────────────────────────────

describe('getMe', () => {
  it('retorna o perfil do usuário autenticado', async () => {
    const user = makeUser({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest();
    const res = makeResponse();

    await getMe(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'uid-test-001' }));
    expect(res.status).not.toHaveBeenCalled();
  });

  it('auto-cria perfil quando não existe e retorna o novo usuário', async () => {
    const req = makeRequest();
    const res = makeResponse();

    await getMe(req, res);

    expect(res.json).toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned).not.toBeNull();
    expect(returned.role).toBe('consumer');
    expect(returned.roles).toEqual(['consumer']);
  });

  it('retorna 500 quando o Firestore lança erro', async () => {
    const { db: mockDb } = await import('../__mocks__/firebase-module');
    mockDb.collection.mockReturnValueOnce({
      doc: jest.fn(() => ({
        get: jest.fn().mockRejectedValueOnce(new Error('Firestore offline')),
      })),
    } as any);

    const req = makeRequest();
    const res = makeResponse();

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Error fetching profile.' });
  });
});

// ─── addMyRole ────────────────────────────────────────────────────────────────

describe('addMyRole', () => {
  it('adiciona role válido ao array de roles', async () => {
    const user = makeUser({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest({ body: { role: 'ruralProducer' } });
    const res = makeResponse();

    await addMyRole(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Role added.' })
    );
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.roles).toContain('ruralProducer');
    expect(returned.roles).toContain('consumer');
  });

  it('é idempotente — não duplica role já existente', async () => {
    const user = makeUser({ id: 'uid-test-001', roles: ['consumer', 'ruralProducer'] });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest({ body: { role: 'ruralProducer' } });
    const res = makeResponse();

    await addMyRole(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    const count = returned.roles.filter((r: string) => r === 'ruralProducer').length;
    expect(count).toBe(1);
  });

  it('retorna 400 para role inválido', async () => {
    const req = makeRequest({ body: { role: 'superadmin' } });
    const res = makeResponse();

    await addMyRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Invalid role') })
    );
  });

  it('retorna 400 quando role está ausente no body', async () => {
    const req = makeRequest({ body: {} });
    const res = makeResponse();

    await addMyRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── updateMyProfile ──────────────────────────────────────────────────────────

describe('updateMyProfile', () => {
  it('atualiza perfil consumer com role implícito (fallback)', async () => {
    const user = makeUser({ id: 'uid-test-001', role: 'consumer' });
    firestoreStore.set('users/uid-test-001', user);

    const newProfile = makeConsumerProfile({ city: 'Rio de Janeiro' });
    const req = makeRequest({ body: { profile: newProfile } });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Profile updated.', role: 'consumer' })
    );
  });

  it('atualiza perfil ruralProducer via query param ?role=ruralProducer', async () => {
    const user = makeMultiRoleUser({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest({
      body: { profile: makeRuralProducerProfile({ userName: 'ze_horta' }) },
      query: { role: 'ruralProducer' },
    });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Profile updated.', role: 'ruralProducer' })
    );
  });

  it('sanitiza campos desconhecidos antes de salvar', async () => {
    const user = makeRuralProducer({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest({
      body: { profile: { ...makeRuralProducerProfile(), campoInvalido: 'hack' } },
      query: { role: 'ruralProducer' },
    });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.json).toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.profile).not.toHaveProperty('campoInvalido');
  });

  it('retorna 400 quando profile não é objeto', async () => {
    const req = makeRequest({ body: { profile: 'string-invalida' } });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid profile data.' });
  });

  it('retorna 404 quando usuário não existe', async () => {
    const req = makeRequest({ body: { profile: makeConsumerProfile() } });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found.' });
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe('getById', () => {
  it('retorna o perfil público quando usuário existe', async () => {
    const user = makeUser({ id: 'uid-publico' });
    firestoreStore.set('users/uid-publico', user);

    const req = makeRequest({ params: { id: 'uid-publico' } });
    const res = makeResponse();

    await getById(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.id).toBe('uid-publico');
    expect(returned.roles).toEqual(['consumer']);
    expect(returned).not.toHaveProperty('email');
    expect(returned).not.toHaveProperty('createdAt');
  });

  it('retorna 404 quando usuário não existe', async () => {
    const req = makeRequest({ params: { id: 'uid-fantasma' } });
    const res = makeResponse();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found.' });
  });
});
