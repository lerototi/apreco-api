/**
 * Testes unitários — src/controllers/deliveryController.ts
 *
 * Cobre:
 *
 * Produtor:
 *  - producerGetDeliveries:    lista próprias entregas
 *  - producerGetDelivery:      found, 404, 403 outro produtor
 *  - producerScheduleDelivery: pending → scheduled (200), 404, 403, 409 status, 409 já agendado, 400 sem data
 *  - producerShipDelivery:     pending → shipped (200), 404, 403, 409 status inválido
 *  - producerCancelDelivery:   pending → cancelled (200), 403, 409 status inválido
 *
 * Estabelecimento:
 *  - estGetDeliveries:         lista entregas do estabelecimento
 *  - estGetDelivery:           found, 404, 403
 *  - estConfirmDelivery:       pending|shipped → delivered (200), 400 body inválido, 404, 403, 409
 *  - estDisputeDelivery:       pending|shipped → disputed (200), 400 sem motivo, 409
 *  - estCancelDelivery:        disputed → cancelled (200), 409 status inválido
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
  producerGetDeliveries,
  producerGetDelivery,
  producerScheduleDelivery,
  producerShipDelivery,
  producerCancelDelivery,
  estGetDeliveries,
  estGetDelivery,
  estConfirmDelivery,
  estDisputeDelivery,
  estCancelDelivery,
} from '../../controllers/deliveryController';
import { makeRequest, makeResponse, makeDelivery } from '../helpers/factories';

// ─── UIDs e IDs de teste ──────────────────────────────────────────────────────

const PRODUCER_UID   = 'uid-producer-001';
const EST_UID        = 'uid-test-001';
const OTHER_UID      = 'uid-other-001';
const DELIVERY_ID    = 'delivery-001';
const OFFER_ID       = 'offer-001';
const DEMAND_ID      = 'demand-001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedDelivery(overrides: Partial<ReturnType<typeof makeDelivery>> = {}) {
  const delivery = makeDelivery({
    id: DELIVERY_ID,
    offerId: OFFER_ID,
    demandId: DEMAND_ID,
    producerUid: PRODUCER_UID,
    establishmentUid: EST_UID,
    ...overrides,
  });
  firestoreStore.set(`deliveries/${DELIVERY_ID}`, delivery);
  return delivery;
}

beforeEach(() => {
  firestoreStore.clear();
});

// ─── producerGetDeliveries ────────────────────────────────────────────────────

describe('producerGetDeliveries', () => {
  it('retorna lista de entregas do produtor', async () => {
    seedDelivery();
    const req = makeRequest({ user: { uid: PRODUCER_UID } });
    const res = makeResponse();

    await producerGetDeliveries(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deliveries).toHaveLength(1);
    expect(body.deliveries[0].id).toBe(DELIVERY_ID);
  });

  it('retorna lista vazia se produtor não tem entregas', async () => {
    const req = makeRequest({ user: { uid: PRODUCER_UID } });
    const res = makeResponse();

    await producerGetDeliveries(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deliveries).toHaveLength(0);
  });
});

// ─── producerGetDelivery ──────────────────────────────────────────────────────

describe('producerGetDelivery', () => {
  it('retorna detalhes da entrega para o produtor dono', async () => {
    seedDelivery();
    const req = makeRequest({ user: { uid: PRODUCER_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await producerGetDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.id).toBe(DELIVERY_ID);
  });

  it('retorna 404 quando entrega não existe', async () => {
    const req = makeRequest({ user: { uid: PRODUCER_UID }, params: { deliveryId: 'nao-existe' } });
    const res = makeResponse();

    await producerGetDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
  });

  it('retorna 403 quando produtor não é dono da entrega', async () => {
    seedDelivery();
    const req = makeRequest({ user: { uid: OTHER_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await producerGetDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });
});

// ─── producerScheduleDelivery ──────────────────────────────────────────────────

describe('producerScheduleDelivery', () => {
  it('agenda a entrega com data e hora', async () => {
    seedDelivery({ status: 'pending', scheduledDeliveryAt: null });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { scheduledDeliveryAt: '2024-06-10T14:00:00.000Z' },
    });
    const res = makeResponse();

    await producerScheduleDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.scheduledDeliveryAt).toBe('2024-06-10T14:00:00.000Z');
  });

  it('retorna 404 quando entrega não existe', async () => {
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: 'nao-existe' },
      body: { scheduledDeliveryAt: '2024-06-10T14:00:00.000Z' },
    });
    const res = makeResponse();

    await producerScheduleDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
  });

  it('retorna 403 quando produtor não é dono', async () => {
    seedDelivery({ status: 'pending', scheduledDeliveryAt: null });
    const req = makeRequest({
      user: { uid: OTHER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { scheduledDeliveryAt: '2024-06-10T14:00:00.000Z' },
    });
    const res = makeResponse();

    await producerScheduleDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });

  it('retorna 409 quando status não é pending', async () => {
    seedDelivery({ status: 'shipped', scheduledDeliveryAt: null });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { scheduledDeliveryAt: '2024-06-10T14:00:00.000Z' },
    });
    const res = makeResponse();

    await producerScheduleDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });

  it('retorna 409 quando entrega já foi agendada', async () => {
    seedDelivery({ status: 'pending', scheduledDeliveryAt: '2024-06-08T09:00:00.000Z' });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { scheduledDeliveryAt: '2024-06-10T14:00:00.000Z' },
    });
    const res = makeResponse();

    await producerScheduleDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });

  it('retorna 400 quando scheduledDeliveryAt está ausente', async () => {
    seedDelivery({ status: 'pending', scheduledDeliveryAt: null });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: {},
    });
    const res = makeResponse();

    await producerScheduleDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);
  });
});

// ─── producerShipDelivery ─────────────────────────────────────────────────────

describe('producerShipDelivery', () => {
  it('marca entrega como enviada com nota', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { shippingNote: 'Enviando com caminhão.' },
    });
    const res = makeResponse();

    await producerShipDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('shipped');
    expect(body.delivery.shippingNote).toBe('Enviando com caminhão.');
    expect(body.delivery.shippedAt).toBeTruthy();
  });

  it('marca entrega como enviada sem nota opcional', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: {},
    });
    const res = makeResponse();

    await producerShipDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('shipped');
    expect(body.delivery.shippingNote).toBeNull();
  });

  it('retorna 404 quando entrega não existe', async () => {
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: 'nao-existe' },
      body: {},
    });
    const res = makeResponse();

    await producerShipDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
  });

  it('retorna 403 quando produtor não é dono', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({
      user: { uid: OTHER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: {},
    });
    const res = makeResponse();

    await producerShipDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });

  it('retorna 409 quando status não é pending', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: {},
    });
    const res = makeResponse();

    await producerShipDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });
});

// ─── producerCancelDelivery ───────────────────────────────────────────────────

describe('producerCancelDelivery', () => {
  it('cancela entrega pendente', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({
      user: { uid: PRODUCER_UID },
      params: { deliveryId: DELIVERY_ID },
    });
    const res = makeResponse();

    await producerCancelDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('cancelled');
  });

  it('retorna 403 quando produtor não é dono', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({ user: { uid: OTHER_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await producerCancelDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });

  it('retorna 409 quando status não é pending', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({ user: { uid: PRODUCER_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await producerCancelDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });
});

// ─── estGetDeliveries ─────────────────────────────────────────────────────────

describe('estGetDeliveries', () => {
  it('retorna lista de entregas do estabelecimento', async () => {
    seedDelivery();
    const req = makeRequest({ user: { uid: EST_UID } });
    const res = makeResponse();

    await estGetDeliveries(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deliveries).toHaveLength(1);
    expect(body.deliveries[0].id).toBe(DELIVERY_ID);
  });

  it('retorna lista vazia se sem entregas', async () => {
    const req = makeRequest({ user: { uid: EST_UID } });
    const res = makeResponse();

    await estGetDeliveries(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.deliveries).toHaveLength(0);
  });
});

// ─── estGetDelivery ───────────────────────────────────────────────────────────

describe('estGetDelivery', () => {
  it('retorna detalhes para o estabelecimento dono', async () => {
    seedDelivery();
    const req = makeRequest({ user: { uid: EST_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await estGetDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.id).toBe(DELIVERY_ID);
  });

  it('retorna 404 quando entrega não existe', async () => {
    const req = makeRequest({ user: { uid: EST_UID }, params: { deliveryId: 'nao-existe' } });
    const res = makeResponse();

    await estGetDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(404);
  });

  it('retorna 403 quando estabelecimento não é dono', async () => {
    seedDelivery();
    const req = makeRequest({ user: { uid: OTHER_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await estGetDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });
});

// ─── estConfirmDelivery ───────────────────────────────────────────────────────

describe('estConfirmDelivery', () => {
  it('confirma recebimento com quantidade e nota', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 18, receptionNote: 'Chegou bem embalado.' },
    });
    const res = makeResponse();

    await estConfirmDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('delivered');
    expect(body.delivery.receivedQuantity).toBe(18);
    expect(body.delivery.receptionNote).toBe('Chegou bem embalado.');
    expect(body.delivery.confirmedAt).toBeTruthy();
  });

  it('confirma com receivedQuantity zero (entrega vazia)', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 0 },
    });
    const res = makeResponse();

    await estConfirmDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('delivered');
  });

  it('retorna 400 quando receivedQuantity é inválido', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: -5 },
    });
    const res = makeResponse();

    await estConfirmDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);
  });

  it('confirma recebimento a partir de pending (sem ship)', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 20 },
    });
    const res = makeResponse();

    await estConfirmDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('delivered');
  });

  it('retorna 409 quando status não é pending nem shipped', async () => {
    seedDelivery({ status: 'delivered' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 20 },
    });
    const res = makeResponse();

    await estConfirmDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });

  it('retorna 403 quando estabelecimento não é dono', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: OTHER_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 20 },
    });
    const res = makeResponse();

    await estConfirmDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });
});

// ─── estDisputeDelivery ───────────────────────────────────────────────────────

describe('estDisputeDelivery', () => {
  it('abre disputa com quantidade e motivo', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 5, receptionNote: 'Chegou apenas 5 kg dos 20 acordados.' },
    });
    const res = makeResponse();

    await estDisputeDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('disputed');
    expect(body.delivery.receivedQuantity).toBe(5);
    expect(body.delivery.receptionNote).toBe('Chegou apenas 5 kg dos 20 acordados.');
  });

  it('retorna 400 quando receptionNote está ausente', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 5 },
    });
    const res = makeResponse();

    await estDisputeDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(400);
  });

  it('abre disputa a partir de pending (sem ship)', async () => {
    seedDelivery({ status: 'pending' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 5, receptionNote: 'Produto com qualidade ruim.' },
    });
    const res = makeResponse();

    await estDisputeDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('disputed');
  });

  it('retorna 409 quando status não é pending nem shipped', async () => {
    seedDelivery({ status: 'delivered' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
      body: { receivedQuantity: 5, receptionNote: 'Motivo.' },
    });
    const res = makeResponse();

    await estDisputeDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });
});

// ─── estCancelDelivery ────────────────────────────────────────────────────────

describe('estCancelDelivery', () => {
  it('cancela entrega em disputa', async () => {
    seedDelivery({ status: 'disputed' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
    });
    const res = makeResponse();

    await estCancelDelivery(req, res);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.delivery.status).toBe('cancelled');
  });

  it('retorna 409 quando status não é disputed', async () => {
    seedDelivery({ status: 'shipped' });
    const req = makeRequest({
      user: { uid: EST_UID },
      params: { deliveryId: DELIVERY_ID },
    });
    const res = makeResponse();

    await estCancelDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(409);
  });

  it('retorna 403 quando estabelecimento não é dono', async () => {
    seedDelivery({ status: 'disputed' });
    const req = makeRequest({ user: { uid: OTHER_UID }, params: { deliveryId: DELIVERY_ID } });
    const res = makeResponse();

    await estCancelDelivery(req, res);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(403);
  });
});
