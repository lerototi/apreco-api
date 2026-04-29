/**
 * Testes unitários — src/middleware/auth.ts
 *
 * Cobre:
 *  - Ausência do header Authorization → 401
 *  - Header malformado (sem "Bearer ") → 401
 *  - Token inválido (verifyIdToken rejeita) → 401
 *  - Token válido → chama next() e popula req.user
 */

import { auth as mockAuth } from '../__mocks__/firebase-module';

import { authenticate } from '../../middleware/auth';
import { makeDecodedToken, makeRequest, makeResponse } from '../helpers/factories';

const mockNext = jest.fn();

beforeEach(() => {
  mockNext.mockClear();
});

// ─── Header ausente ───────────────────────────────────────────────────────────

describe('authenticate — header ausente ou malformado', () => {
  it('retorna 401 quando Authorization está ausente', async () => {
    const req = makeRequest({ headers: {} });
    const res = makeResponse();

    await authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token não fornecido.' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('retorna 401 quando header não começa com "Bearer "', async () => {
    const req = makeRequest({ headers: { authorization: 'Basic abc123' } });
    const res = makeResponse();

    await authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('retorna 401 quando header é Bearer sem token', async () => {
    const req = makeRequest({ headers: { authorization: 'Bearer ' } });
    const res = makeResponse();

    // verifyIdToken vai rejeitar string vazia
    mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('Token inválido'));

    await authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

// ─── Token inválido ───────────────────────────────────────────────────────────

describe('authenticate — token inválido', () => {
  it('retorna 401 quando verifyIdToken rejeita', async () => {
    mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('auth/id-token-expired'));

    const req = makeRequest({ headers: { authorization: 'Bearer token-expirado' } });
    const res = makeResponse();

    await authenticate(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido.' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});

// ─── Token válido ─────────────────────────────────────────────────────────────

describe('authenticate — token válido', () => {
  it('chama next() e popula req.user', async () => {
    const decoded = makeDecodedToken({ uid: 'uid-autenticado' });
    mockAuth.verifyIdToken.mockResolvedValueOnce(decoded);

    const req = makeRequest({ headers: { authorization: 'Bearer token-valido' } });
    const res = makeResponse();

    await authenticate(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(decoded);
    expect(req.user.uid).toBe('uid-autenticado');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('não chama res.json() em caso de sucesso', async () => {
    const decoded = makeDecodedToken();
    mockAuth.verifyIdToken.mockResolvedValueOnce(decoded);

    const req = makeRequest({ headers: { authorization: 'Bearer token-ok' } });
    const res = makeResponse();

    await authenticate(req, res, mockNext);

    expect(res.json).not.toHaveBeenCalled();
  });
});
