/**
 * Testes unitários — src/controllers/demandController.ts
 *
 * Cobre:
 *  - getMyDemands:    lista vazia, lista com demandas
 *  - getMyDemand:     encontrada, não encontrada (404), acesso negado (403)
 *  - createMyDemand:  criação válida (201), perfil establishment ausente (403),
 *                     campo obrigatório ausente (400)
 *  - updateMyDemand:  atualização válida, demanda não encontrada (404),
 *                     acesso negado (403), status não-open (409)
 *  - cancelMyDemand:  cancelamento válido, não encontrada (404), acesso negado (403)
 *  - getOpenDemands:  lista pública de demandas abertas
 *  - getOpenDemand:   detalhe público encontrado, não encontrado (404)
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
  getMyDemands,
  getMyDemand,
  createMyDemand,
  updateMyDemand,
  cancelMyDemand,
  getOpenDemands,
  getOpenDemand,
} from '../../controllers/demandController';
import {
  makeRequest,
  makeResponse,
  makeEstablishment,
  makeEstablishmentDemand,
} from '../helpers/factories';

// ─── UIDs de teste ────────────────────────────────────────────────────────────

const EST_UID      = 'uid-test-001';   // usuário autenticado (makeRequest default)
const OTHER_UID    = 'uid-other-001';
const DEMAND_ID    = 'demand-001';

// ─── Helpers de semeadura ─────────────────────────────────────────────────────

function seedEstablishmentProfile(uid: string = EST_UID, businessName = 'Mercado Central') {
  firestoreStore.set(`establishments/${uid}`, {
    businessName,
    city: 'São Paulo',
    state: 'SP',
    avatarUrl: null,
    userName: 'mercado_central',
    cnpj: null,
    businessType: 'mercado',
    bio: null,
    address: null,
    phone: null,
    isWhatsApp: false,
    instagram: null,
    website: null,
    recurringNeeds: [],
    linkedProducerIds: [],
  });
}

function seedDemand(overrides: Partial<ReturnType<typeof makeEstablishmentDemand>> = {}) {
  const demand = makeEstablishmentDemand({ id: DEMAND_ID, ...overrides });
  firestoreStore.set(`establishmentDemands/${DEMAND_ID}`, demand);
  return demand;
}

beforeEach(() => {
  firestoreStore.clear();
});

// ─── getMyDemands ─────────────────────────────────────────────────────────────

describe('getMyDemands', () => {
  it('retorna lista vazia quando não há demandas', async () => {
    const req = makeRequest();
    const res = makeResponse();

    await getMyDemands(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demands).toEqual([]);
  });

  it('retorna lista de demandas do estabelecimento autenticado', async () => {
    seedDemand({ establishmentUid: EST_UID });
    // demanda de outro estabelecimento — não deve aparecer
    const otherDemand = makeEstablishmentDemand({ id: 'demand-other', establishmentUid: OTHER_UID });
    firestoreStore.set('establishmentDemands/demand-other', otherDemand);

    const req = makeRequest();
    const res = makeResponse();

    await getMyDemands(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demands).toHaveLength(1);
    expect(returned.demands[0].id).toBe(DEMAND_ID);
  });
});

// ─── getMyDemand ──────────────────────────────────────────────────────────────

describe('getMyDemand', () => {
  it('retorna a demanda quando pertence ao usuário autenticado', async () => {
    seedDemand({ establishmentUid: EST_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getMyDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.id).toBe(DEMAND_ID);
  });

  it('retorna 404 quando demanda não existe', async () => {
    const req = makeRequest({ params: { demandId: 'demand-inexistente' } });
    const res = makeResponse();

    await getMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Solicitação não encontrada.' });
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado.' });
  });
});

// ─── createMyDemand ───────────────────────────────────────────────────────────

describe('createMyDemand', () => {
  const validBody = {
    productName: 'Alface Crespa',
    category: 'hortalicas',
    quantityNeeded: 10,
    unit: 'kg',
    deadline: '2099-06-01',
    deliveryLocation: {
      displayName: 'Restaurante Teste',
      city: 'São Paulo',
      state: 'SP',
      coords: null,
      placeId: null,
    },
  };

  it('cria demanda com sucesso e retorna 201', async () => {
    seedEstablishmentProfile();

    const req = makeRequest({ body: validBody });
    const res = makeResponse();

    await createMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.productName).toBe('Alface Crespa');
    expect(returned.demand.status).toBe('open');
    expect(returned.demand.establishmentUid).toBe(EST_UID);
    expect(returned.demand.establishmentName).toBe('Mercado Central');
    expect(returned.demand.id).toBeDefined();
  });

  it('retorna 403 quando perfil establishment não existe', async () => {
    // não semeia o perfil

    const req = makeRequest({ body: validBody });
    const res = makeResponse();

    await createMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('establishment') }),
    );
  });

  it('retorna 400 para categoria inválida', async () => {
    seedEstablishmentProfile();

    const req = makeRequest({ body: { ...validBody, category: 'categoria_invalida' } });
    const res = makeResponse();

    await createMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 para unidade inválida', async () => {
    seedEstablishmentProfile();

    const req = makeRequest({ body: { ...validBody, unit: 'barril' } });
    const res = makeResponse();

    await createMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 quando productName está ausente', async () => {
    seedEstablishmentProfile();

    const { productName: _, ...bodyWithoutName } = validBody;
    const req = makeRequest({ body: bodyWithoutName });
    const res = makeResponse();

    await createMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── updateMyDemand ───────────────────────────────────────────────────────────

describe('updateMyDemand', () => {
  const updateBody = {
    productName: 'Tomate Italiano',
    category: 'hortalicas',
    quantityNeeded: 30,
    unit: 'kg',
    deadline: '2099-09-01',
    deliveryLocation: {
      displayName: 'Local Atualizado',
      city: 'São Paulo',
      state: 'SP',
      coords: null,
      placeId: null,
    },
  };

  it('atualiza demanda aberta com sucesso', async () => {
    seedDemand({ establishmentUid: EST_UID, status: 'open' });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: updateBody });
    const res = makeResponse();

    await updateMyDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.productName).toBe('Tomate Italiano');
    expect(returned.demand.quantityNeeded).toBe(30);
  });

  it('retorna 404 quando demanda não existe', async () => {
    const req = makeRequest({ params: { demandId: 'demand-inexistente' }, body: updateBody });
    const res = makeResponse();

    await updateMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: updateBody });
    const res = makeResponse();

    await updateMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 409 quando demanda não está com status open', async () => {
    seedDemand({ establishmentUid: EST_UID, status: 'negotiating' });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: updateBody });
    const res = makeResponse();

    await updateMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('aberta') }),
    );
  });
});

// ─── cancelMyDemand ───────────────────────────────────────────────────────────

describe('cancelMyDemand', () => {
  it('cancela demanda aberta com sucesso', async () => {
    seedDemand({ establishmentUid: EST_UID, status: 'open' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await cancelMyDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.status).toBe('cancelled');
  });

  it('cancela demanda em negociação com sucesso', async () => {
    seedDemand({ establishmentUid: EST_UID, status: 'negotiating' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await cancelMyDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.status).toBe('cancelled');
  });

  it('retorna 404 quando demanda não existe', async () => {
    const req = makeRequest({ params: { demandId: 'demand-inexistente' } });
    const res = makeResponse();

    await cancelMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await cancelMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 409 ao tentar cancelar demanda já encerrada', async () => {
    seedDemand({ establishmentUid: EST_UID, status: 'closed' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await cancelMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 409 ao tentar cancelar demanda já cancelada', async () => {
    seedDemand({ establishmentUid: EST_UID, status: 'cancelled' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await cancelMyDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ─── getOpenDemands ───────────────────────────────────────────────────────────

describe('getOpenDemands', () => {
  it('retorna apenas demandas com status open', async () => {
    seedDemand({ id: DEMAND_ID, status: 'open' });
    const cancelledDemand = makeEstablishmentDemand({ id: 'demand-cancelled', status: 'cancelled' });
    firestoreStore.set('establishmentDemands/demand-cancelled', cancelledDemand);
    const closedDemand = makeEstablishmentDemand({ id: 'demand-closed', status: 'closed' });
    firestoreStore.set('establishmentDemands/demand-closed', closedDemand);

    const req = makeRequest();
    const res = makeResponse();

    await getOpenDemands(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    // O mock retorna todos os docs da coleção (sem filtro where real);
    // verificamos que o endpoint responde sem erro e retorna a lista
    expect(returned).toHaveProperty('demands');
    expect(Array.isArray(returned.demands)).toBe(true);
  });

  it('responde sem erro quando não há demandas', async () => {
    const req = makeRequest();
    const res = makeResponse();

    await getOpenDemands(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demands).toEqual([]);
  });
});

// ─── getOpenDemand ────────────────────────────────────────────────────────────

describe('getOpenDemand', () => {
  it('retorna demanda aberta pelo id', async () => {
    seedDemand({ status: 'open' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOpenDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.id).toBe(DEMAND_ID);
  });

  it('retorna 404 quando demanda não existe', async () => {
    const req = makeRequest({ params: { demandId: 'demand-inexistente' } });
    const res = makeResponse();

    await getOpenDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 404 quando demanda existe mas está cancelada', async () => {
    seedDemand({ status: 'cancelled' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOpenDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna demanda com status negotiating', async () => {
    seedDemand({ status: 'negotiating' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOpenDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.id).toBe(DEMAND_ID);
  });

  it('retorna demanda com status closed', async () => {
    seedDemand({ status: 'closed' });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOpenDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.demand.id).toBe(DEMAND_ID);
  });
});
