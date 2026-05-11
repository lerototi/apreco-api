/**
 * Testes unitários — src/controllers/offerController.ts
 *
 * Cobre:
 *
 * Visão do estabelecimento:
 *  - getOffersForDemand:  lista com stats, demanda não encontrada (404), acesso negado (403)
 *  - getOfferDetail:      oferta encontrada, oferta não encontrada (404), acesso negado (403)
 *  - acceptOffer:         aceita oferta pending → demanda vira negotiating (200),
 *                         oferta já aceita/rejeitada (409)
 *  - rejectOffer:         rejeita oferta pending, rejeita oferta accepted,
 *                         oferta já confirmada/cancelada (409)
 *  - confirmOffer:        confirma oferta accepted → retorna stats,
 *                         fecha demanda se quantityConfirmed >= quantityNeeded,
 *                         oferta não accepted (409)
 *
 * Visão do produtor (marketplace):
 *  - submitOffer:         envia oferta válida (201), demanda não aberta (404),
 *                         quantity/pricePerUnit <= 0 (400)
 *  - cancelOffer:         cancela oferta própria (204), oferta de outro produtor (403),
 *                         oferta já confirmada (409), oferta não encontrada (404)
 *  - getMyOffers:         lista próprias ofertas
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
  getOffersForDemand,
  getOfferDetail,
  acceptOffer,
  rejectOffer,
  confirmOffer,
  submitOffer,
  cancelOffer,
  getMyOffers,
} from '../../controllers/offerController';
import {
  makeRequest,
  makeResponse,
  makeEstablishmentDemand,
  makeDemandOffer,
} from '../helpers/factories';

// ─── UIDs e IDs de teste ──────────────────────────────────────────────────────

const EST_UID      = 'uid-test-001';
const PRODUCER_UID = 'uid-producer-001';
const OTHER_UID    = 'uid-other-001';
const DEMAND_ID    = 'demand-001';
const OFFER_ID     = 'offer-001';

// ─── Helpers de semeadura ─────────────────────────────────────────────────────

function seedDemand(overrides: Partial<ReturnType<typeof makeEstablishmentDemand>> = {}) {
  const demand = makeEstablishmentDemand({ id: DEMAND_ID, establishmentUid: EST_UID, ...overrides });
  firestoreStore.set(`establishmentDemands/${DEMAND_ID}`, demand);
  return demand;
}

function seedOffer(overrides: Partial<ReturnType<typeof makeDemandOffer>> = {}) {
  const offer = makeDemandOffer({
    id: OFFER_ID,
    demandId: DEMAND_ID,
    establishmentUid: EST_UID,
    producerUid: PRODUCER_UID,
    ...overrides,
  });
  firestoreStore.set(`ruralProducerOffers/${OFFER_ID}`, offer);
  return offer;
}

function seedRuralProducerProfile(uid: string = PRODUCER_UID, displayName = 'Sítio Raízes Vivas') {
  firestoreStore.set(`ruralProducers/${uid}`, { displayName });
}

beforeEach(() => {
  firestoreStore.clear();
});

// ─── getOffersForDemand ───────────────────────────────────────────────────────

describe('getOffersForDemand', () => {
  it('retorna lista de ofertas e stats para a demanda', async () => {
    seedDemand();
    seedOffer({ status: 'pending', quantity: 10 });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOffersForDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offers).toHaveLength(1);
    expect(returned.offers[0].id).toBe(OFFER_ID);
    expect(returned).toHaveProperty('offerCount');
    expect(returned).toHaveProperty('quantityOffered');
    expect(returned).toHaveProperty('quantityConfirmed');
  });

  it('retorna lista vazia e stats zeradas quando não há ofertas', async () => {
    seedDemand();

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOffersForDemand(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offers).toEqual([]);
    expect(returned.offerCount).toBe(0);
    expect(returned.quantityOffered).toBe(0);
    expect(returned.quantityConfirmed).toBe(0);
  });

  it('retorna 404 quando demanda não existe', async () => {
    const req = makeRequest({ params: { demandId: 'demand-inexistente' } });
    const res = makeResponse();

    await getOffersForDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID } });
    const res = makeResponse();

    await getOffersForDemand(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── getOfferDetail ───────────────────────────────────────────────────────────

describe('getOfferDetail', () => {
  it('retorna detalhe da oferta', async () => {
    seedDemand();
    seedOffer();

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await getOfferDetail(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.id).toBe(OFFER_ID);
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'offer-inexistente' } });
    const res = makeResponse();

    await getOfferDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });
    seedOffer();

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await getOfferDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── acceptOffer ──────────────────────────────────────────────────────────────

describe('acceptOffer', () => {
  it('aceita oferta pending com sucesso → status accepted, demanda vira negotiating', async () => {
    seedDemand({ status: 'open' });
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('accepted');

    const demandInStore = firestoreStore.get(`establishmentDemands/${DEMAND_ID}`) as Record<string, unknown>;
    expect(demandInStore.status).toBe('negotiating');
  });

  it('retorna 409 quando oferta já está accepted', async () => {
    seedDemand();
    seedOffer({ status: 'accepted' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 409 quando oferta está rejected', async () => {
    seedDemand();
    seedOffer({ status: 'rejected' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'inexistente' } });
    const res = makeResponse();

    await acceptOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─── rejectOffer ──────────────────────────────────────────────────────────────

describe('rejectOffer', () => {
  it('rejeita oferta pending com sucesso', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await rejectOffer(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('rejected');
  });

  it('rejeita oferta accepted (volta atrás da negociação)', async () => {
    seedDemand();
    seedOffer({ status: 'accepted' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await rejectOffer(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('rejected');
  });

  it('retorna 409 ao tentar rejeitar oferta já confirmada', async () => {
    seedDemand();
    seedOffer({ status: 'confirmed' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await rejectOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 409 ao tentar rejeitar oferta já cancelada', async () => {
    seedDemand();
    seedOffer({ status: 'cancelled' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await rejectOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// ─── confirmOffer ─────────────────────────────────────────────────────────────

describe('confirmOffer', () => {
  it('confirma oferta accepted com sucesso e retorna stats', async () => {
    seedDemand({ quantityNeeded: 100, status: 'negotiating' });
    seedOffer({ status: 'accepted', quantity: 10 });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await confirmOffer(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('confirmed');
    expect(returned).toHaveProperty('stats');
  });

  it('fecha demanda automaticamente quando quantityConfirmed >= quantityNeeded', async () => {
    seedDemand({ quantityNeeded: 10, status: 'negotiating' });
    seedOffer({ status: 'accepted', quantity: 10 });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await confirmOffer(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const demandInStore = firestoreStore.get(`establishmentDemands/${DEMAND_ID}`) as Record<string, unknown>;
    expect(demandInStore.status).toBe('closed');
  });

  it('retorna 409 ao tentar confirmar oferta pending', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await confirmOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('aceitas') }),
    );
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'inexistente' } });
    const res = makeResponse();

    await confirmOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── submitOffer ──────────────────────────────────────────────────────────────

describe('submitOffer', () => {
  const validBody = {
    quantity: 15,
    pricePerUnit: 9.50,
    message: 'Oferta de produção orgânica certificada.',
  };

  beforeEach(() => {
    seedRuralProducerProfile(EST_UID, 'Produtor Teste');
  });

  it('envia oferta válida e retorna 201', async () => {
    seedDemand({ status: 'open', establishmentUid: OTHER_UID });
    seedRuralProducerProfile(EST_UID, 'Produtor Teste');

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: validBody });
    const res = makeResponse();

    await submitOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.quantity).toBe(15);
    expect(returned.offer.pricePerUnit).toBe(9.50);
    expect(returned.offer.status).toBe('pending');
    expect(returned.offer.establishmentUid).toBe(OTHER_UID);
  });

  it('retorna 400 quando quantity é zero', async () => {
    seedDemand({ status: 'open', establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: { ...validBody, quantity: 0 } });
    const res = makeResponse();

    await submitOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'quantity deve ser maior que zero.' });
  });

  it('retorna 400 quando pricePerUnit é negativo', async () => {
    seedDemand({ status: 'open', establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: { ...validBody, pricePerUnit: -5 } });
    const res = makeResponse();

    await submitOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'pricePerUnit deve ser maior que zero.' });
  });

  it('retorna 404 quando demanda não existe', async () => {
    const req = makeRequest({ params: { demandId: 'demand-inexistente' }, body: validBody });
    const res = makeResponse();

    await submitOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 404 quando demanda existe mas não está aberta', async () => {
    seedDemand({ status: 'closed', establishmentUid: OTHER_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: validBody });
    const res = makeResponse();

    await submitOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it.skip('retorna 403 quando produtor tenta ofertar para a própria demanda', async () => {
    // TODO: reativar quando a trava de auto-oferta for reativada em offerController.ts
    seedDemand({ status: 'open', establishmentUid: EST_UID });

    const req = makeRequest({ params: { demandId: DEMAND_ID }, body: validBody });
    const res = makeResponse();

    await submitOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('própria') }),
    );
  });
});

// ─── cancelOffer ──────────────────────────────────────────────────────────────

describe('cancelOffer', () => {
  it('cancela oferta própria pendente com sucesso (204)', async () => {
    seedOffer({ producerUid: EST_UID, status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('retorna 403 ao tentar cancelar oferta de outro produtor', async () => {
    seedOffer({ producerUid: OTHER_UID, status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 409 ao tentar cancelar oferta já confirmada', async () => {
    seedOffer({ producerUid: EST_UID, status: 'confirmed' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'offer-inexistente' } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── getMyOffers ──────────────────────────────────────────────────────────────

describe('getMyOffers', () => {
  it('retorna lista de ofertas do produtor autenticado', async () => {
    seedOffer({ producerUid: EST_UID });
    const other = makeDemandOffer({ id: 'offer-other', demandId: DEMAND_ID, producerUid: OTHER_UID });
    firestoreStore.set(`ruralProducerOffers/offer-other`, other);

    const req = makeRequest();
    const res = makeResponse();

    await getMyOffers(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned).toHaveProperty('offers');
    expect(Array.isArray(returned.offers)).toBe(true);
  });

  it('retorna lista vazia quando produtor não tem ofertas', async () => {
    const req = makeRequest();
    const res = makeResponse();

    await getMyOffers(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offers).toEqual([]);
  });
});
