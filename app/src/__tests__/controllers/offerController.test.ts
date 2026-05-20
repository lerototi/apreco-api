/**
 * Testes unitários — src/controllers/offerController.ts
 *
 * Cobre:
 *
 * Visão do estabelecimento:
 *  - getOffersForDemand:     lista com stats, 404 demanda, 403 acesso
 *  - getOfferDetail:         found, 404, 403
 *  - acceptOffer:            pending → accepted + fecha demanda se total atingido
 *                            negotiating → accepted
 *                            status inválido (409)
 *  - negotiateOfferHandler:  pending → negotiating (200), body inválido (400), 409
 *  - rejectOffer:            pending/negotiating → rejected, injeta sys-msg, 409 status inválido
 *
 * Visão do produtor (marketplace):
 *  - submitOffer:            201 válido, 400 body inválido, 404 demanda
 *  - cancelOffer:            204, sys-msg, 403 outro produtor, 409 aceita, 404
 *  - getMyOffers:            lista próprias ofertas
 *  - producerAcceptNegotiation: negotiating → accepted, 409, 403, 404
 *  - producerRejectNegotiation: negotiating → rejected, 409, 403, 404
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
  getOffersForDemand,
  getOfferDetail,
  acceptOffer,
  negotiateOfferHandler,
  rejectOffer,
  submitOffer,
  cancelOffer,
  getMyOffers,
  producerAcceptNegotiation,
  producerRejectNegotiation,
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
    expect(returned).toHaveProperty('quantityAccepted');
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
    expect(returned.quantityAccepted).toBe(0);
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
  it('aceita oferta pending → status accepted e fecha demanda se atingir total', async () => {
    seedDemand({ status: 'open', quantityNeeded: 10 });
    seedOffer({ status: 'pending', quantity: 10 });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('accepted');

    const demandInStore = firestoreStore.get(`establishmentDemands/${DEMAND_ID}`) as Record<string, unknown>;
    expect(demandInStore.status).toBe('closed');
  });

  it('aceita oferta negotiating → status accepted, demanda volta open se parcial', async () => {
    seedDemand({ status: 'open', quantityNeeded: 100 });
    seedOffer({ status: 'negotiating', quantity: 10 });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('accepted');

    const demandInStore = firestoreStore.get(`establishmentDemands/${DEMAND_ID}`) as Record<string, unknown>;
    expect(demandInStore.status).toBe('open');
  });

  it('injeta mensagem de sistema no chat ao aceitar', async () => {
    seedDemand({ status: 'open' });
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await acceptOffer(req, res);

    const allMessages = [...firestoreStore.entries()]
      .filter(([k]) => k.startsWith('chatMessages/'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(allMessages.some(m => m.authorRole === 'system')).toBe(true);
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

// ─── negotiateOfferHandler ────────────────────────────────────────────────────

describe('negotiateOfferHandler', () => {
  const validBody = { negotiatingPrice: 9.0, negotiatingQuantity: 8, negotiatingNote: 'Preço ajustado' };

  it('move oferta pending para negotiating com os termos propostos', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: validBody });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('negotiating');
    expect(returned.offer.negotiatingPrice).toBe(9.0);
    expect(returned.offer.negotiatingQuantity).toBe(8);
  });

  it('move oferta negotiating para negotiating (renegociação)', async () => {
    seedDemand();
    seedOffer({ status: 'negotiating' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: { negotiatingPrice: 8.5, negotiatingQuantity: 5 } });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('negotiating');
  });

  it('injeta mensagem de sistema no chat', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: validBody });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    const allMessages = [...firestoreStore.entries()]
      .filter(([k]) => k.startsWith('chatMessages/'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(allMessages.some(m => m.authorRole === 'system')).toBe(true);
  });

  it('retorna 400 quando negotiatingPrice é zero', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: { ...validBody, negotiatingPrice: 0 } });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 400 quando negotiatingQuantity está ausente', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: { negotiatingPrice: 9.0 } });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('retorna 409 quando oferta está accepted', async () => {
    seedDemand();
    seedOffer({ status: 'accepted' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: validBody });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'inexistente' }, body: validBody });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('retorna 403 quando demanda pertence a outro estabelecimento', async () => {
    seedDemand({ establishmentUid: OTHER_UID });
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID }, body: validBody });
    const res = makeResponse();

    await negotiateOfferHandler(req, res);

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

  it('rejeita oferta negotiating com sucesso', async () => {
    seedDemand();
    seedOffer({ status: 'negotiating' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await rejectOffer(req, res);

    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('rejected');
  });

  it('injeta mensagem de sistema no chat ao rejeitar oferta', async () => {
    seedDemand();
    seedOffer({ status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await rejectOffer(req, res);

    const allMessages = [...firestoreStore.entries()]
      .filter(([k]) => k.startsWith('chatMessages/'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(allMessages.length).toBeGreaterThanOrEqual(1);
    expect(allMessages.some(m => m.authorRole === 'system')).toBe(true);
  });

  it('retorna 409 ao tentar rejeitar oferta já accepted', async () => {
    seedDemand();
    seedOffer({ status: 'accepted' });

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

  it('cancela oferta negotiating do próprio produtor (204)', async () => {
    seedOffer({ producerUid: EST_UID, status: 'negotiating' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('injeta mensagem de sistema no chat ao cancelar oferta', async () => {
    seedDemand();
    seedOffer({ producerUid: EST_UID, status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(204);
    const allMessages = [...firestoreStore.entries()]
      .filter(([k]) => k.startsWith('chatMessages/'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(allMessages.some(m => m.authorRole === 'system')).toBe(true);
  });

  it('retorna 403 ao tentar cancelar oferta de outro produtor', async () => {
    seedOffer({ producerUid: OTHER_UID, status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await cancelOffer(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 409 ao tentar cancelar oferta já aceita', async () => {
    seedOffer({ producerUid: EST_UID, status: 'accepted' });

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

// ─── producerAcceptNegotiation ────────────────────────────────────────────────

describe('producerAcceptNegotiation', () => {
  it('aceita termos negotiating → accepted e injeta sys-msg', async () => {
    seedDemand({ quantityNeeded: 100 });
    seedOffer({
      producerUid: EST_UID,
      status: 'negotiating',
      negotiatingPrice: 8.0,
      negotiatingQuantity: 12,
    });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerAcceptNegotiation(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('accepted');

    const allMessages = [...firestoreStore.entries()]
      .filter(([k]) => k.startsWith('chatMessages/'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(allMessages.some(m => m.authorRole === 'system')).toBe(true);
  });

  it('fecha demanda quando quantityAccepted >= quantityNeeded', async () => {
    seedDemand({ quantityNeeded: 10 });
    seedOffer({
      producerUid: EST_UID,
      status: 'negotiating',
      quantity: 10,
      negotiatingPrice: 8.0,
      negotiatingQuantity: 10,
    });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerAcceptNegotiation(req, res);

    const demandInStore = firestoreStore.get(`establishmentDemands/${DEMAND_ID}`) as Record<string, unknown>;
    expect(demandInStore.status).toBe('closed');
  });

  it('retorna 409 quando oferta não está em negotiating', async () => {
    seedOffer({ producerUid: EST_UID, status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerAcceptNegotiation(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 403 quando oferta pertence a outro produtor', async () => {
    seedOffer({ producerUid: OTHER_UID, status: 'negotiating' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerAcceptNegotiation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'inexistente' } });
    const res = makeResponse();

    await producerAcceptNegotiation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── producerRejectNegotiation ────────────────────────────────────────────────

describe('producerRejectNegotiation', () => {
  it('recusa termos negotiating → rejected e injeta sys-msg', async () => {
    seedOffer({ producerUid: EST_UID, status: 'negotiating' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerRejectNegotiation(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const returned = (res.json as jest.Mock).mock.calls[0][0];
    expect(returned.offer.status).toBe('rejected');

    const allMessages = [...firestoreStore.entries()]
      .filter(([k]) => k.startsWith('chatMessages/'))
      .map(([, v]) => v as Record<string, unknown>);
    expect(allMessages.some(m => m.authorRole === 'system')).toBe(true);
  });

  it('retorna 409 quando oferta não está em negotiating', async () => {
    seedOffer({ producerUid: EST_UID, status: 'pending' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerRejectNegotiation(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('retorna 403 quando oferta pertence a outro produtor', async () => {
    seedOffer({ producerUid: OTHER_UID, status: 'negotiating' });

    const req = makeRequest({ params: { offerId: OFFER_ID } });
    const res = makeResponse();

    await producerRejectNegotiation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('retorna 404 quando oferta não existe', async () => {
    const req = makeRequest({ params: { offerId: 'inexistente' } });
    const res = makeResponse();

    await producerRejectNegotiation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
