/**
 * Testes unitários — src/controllers/userController.ts
 *
 * Cobre:
 *  - getMe: perfil encontrado, auto-criação, erro do Firestore
 *  - updateMyRole: role válido, role inválido, erro
 *  - updateMyProfile: perfil válido, body inválido, usuário não encontrado
 *  - getById: encontrado, não encontrado, erro
 */

import { firestoreStore, db as mockDb } from '../__mocks__/firebase-module';

import { getMe, updateMyRole, updateMyProfile, getById } from '../../controllers/userController';
import {
  makeUser,
  makeAgricultor,
  makeRequest,
  makeResponse,
  makeConsumidorProfile,
  makeAgricultorProfile,
} from '../helpers/factories';

beforeEach(() => {
  firestoreStore.clear();
});

// ─── getMe ────────────────────────────────────────────────────────────────────

describe('getMe', () => {
  it('retorna o perfil do usuário autenticado', async () => {
    const user = makeUser({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest();           // req.user.uid === 'uid-test-001'
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
    expect(returned.role).toBe('consumidor');
  });

  it('retorna 500 quando o Firestore lança erro', async () => {
    // Sobrescreve o mock do doc para rejeitar
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
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro ao buscar perfil.' });
  });
});

// ─── updateMyRole ─────────────────────────────────────────────────────────────

describe('updateMyRole', () => {
  it('atualiza para role válido', async () => {
    const user = makeUser({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest({ body: { role: 'agricultor' } });
    const res = makeResponse();

    await updateMyRole(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Perfil atualizado.', role: 'agricultor' })
    );
  });

  it('retorna 400 para role inválido', async () => {
    const req = makeRequest({ body: { role: 'superadmin' } });
    const res = makeResponse();

    await updateMyRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Role inválido') })
    );
  });

  it('retorna 400 quando role está ausente no body', async () => {
    const req = makeRequest({ body: {} });
    const res = makeResponse();

    await updateMyRole(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── updateMyProfile ──────────────────────────────────────────────────────────

describe('updateMyProfile', () => {
  it('atualiza perfil com dados válidos', async () => {
    const user = makeUser({ id: 'uid-test-001', role: 'consumidor' });
    firestoreStore.set('users/uid-test-001', user);

    const newProfile = makeConsumidorProfile({ city: 'Rio de Janeiro' });
    const req = makeRequest({ body: { profile: newProfile } });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Perfil atualizado.' })
    );
  });

  it('sanitiza campos desconhecidos antes de salvar', async () => {
    const user = makeAgricultor({ id: 'uid-test-001' });
    firestoreStore.set('users/uid-test-001', user);

    const req = makeRequest({ body: { profile: { ...makeAgricultorProfile(), campoInvalido: 'hack' } } });
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
    expect(res.json).toHaveBeenCalledWith({ error: 'Dados de perfil inválidos.' });
  });

  it('retorna 404 quando usuário não existe', async () => {
    const req = makeRequest({ body: { profile: makeConsumidorProfile() } });
    const res = makeResponse();

    await updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado.' });
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
    expect(returned).not.toHaveProperty('email');
    expect(returned).not.toHaveProperty('createdAt');
  });

  it('retorna 404 quando usuário não existe', async () => {
    const req = makeRequest({ params: { id: 'uid-fantasma' } });
    const res = makeResponse();

    await getById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Usuário não encontrado.' });
  });
});
