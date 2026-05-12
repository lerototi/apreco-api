/**
 * Testes unitários — src/controllers/offerMessageController.ts
 *
 * Cobre:
 *  estGetMessages         — lista mensagens (200), oferta não encontrada (404), acesso negado (403)
 *  estSendMessage         — envia mensagem (201), texto vazio (400),
 *                           409 para negociação encerrada (rejected/confirmed/cancelled)
 *  estMarkRead            — marca lidas (204)
 *  estGetChatThreads      — lista threads do estabelecimento
 *  estUnreadCount         — retorna total de não lidas
 *
 *  producerGetMessages    — lista mensagens (200), acesso de outro produtor (403)
 *  producerSendMessage    — envia mensagem (201), texto vazio (400),
 *                           409 para negociação encerrada (rejected/confirmed/cancelled)
 *  producerMarkRead       — marca lidas (204)
 *  producerGetChatThreads — lista threads do produtor
 *  producerUnreadCount    — retorna total de não lidas
 */

import { firestoreStore } from '../__mocks__/firebase-module';
import {
    estGetMessages,
    estSendMessage,
    estMarkRead,
    estGetChatThreads,
    estUnreadCount,
    producerGetMessages,
    producerSendMessage,
    producerMarkRead,
    producerGetChatThreads,
    producerUnreadCount,
} from '../../controllers/offerMessageController';
import {
    makeRequest,
    makeResponse,
    makeEstablishmentDemand,
    makeDemandOffer,
    makeChatMessage,
} from '../helpers/factories';

// ─── UIDs e IDs ───────────────────────────────────────────────────────────────

const EST_UID      = 'uid-test-001';
const PRODUCER_UID = 'uid-producer-001';
const OTHER_UID    = 'uid-other-001';
const DEMAND_ID    = 'demand-001';
const OFFER_ID     = 'offer-001';

// ─── Helpers de seed ──────────────────────────────────────────────────────────

function seedDemand(overrides = {}) {
    const d = makeEstablishmentDemand({ id: DEMAND_ID, establishmentUid: EST_UID, ...overrides });
    firestoreStore.set(`establishmentDemands/${DEMAND_ID}`, d);
    return d;
}

function seedOffer(overrides = {}) {
    const o = makeDemandOffer({
        id: OFFER_ID,
        demandId: DEMAND_ID,
        establishmentUid: EST_UID,
        producerUid: PRODUCER_UID,
        status: 'accepted',
        ...overrides,
    });
    firestoreStore.set(`ruralProducerOffers/${OFFER_ID}`, o);
    return o;
}

function seedMessage(id: string, text: string, senderUid: string, authorRole: string, read = false) {
    firestoreStore.set(`chatMessages/${id}`, makeChatMessage({
        id,
        offerId: OFFER_ID,
        demandId: DEMAND_ID,
        senderUid,
        authorRole: authorRole as any,
        text,
        read,
    }));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    firestoreStore.clear();
    jest.mock('../../models/profiles/establishment', () => ({
        findEstablishmentProfile: jest.fn().mockResolvedValue({ businessName: 'Mercado Central' }),
    }));
    jest.mock('../../models/profiles/ruralProducer', () => ({
        findRuralProducerProfile: jest.fn().mockResolvedValue({ displayName: 'João Produtor' }),
    }));
});

// ─── estGetMessages ───────────────────────────────────────────────────────────

describe('estGetMessages', () => {
    it('200 — retorna lista de mensagens', async () => {
        seedDemand();
        seedOffer();
        seedMessage('msg-001', 'Olá!', PRODUCER_UID, 'ruralProducer', false);

        const req = makeRequest({ user: { uid: EST_UID }, params: { offerId: OFFER_ID } });
        const res = makeResponse();
        await estGetMessages(req as any, res as any);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ messages: expect.any(Array) }),
        );
        const { messages } = (res.json as jest.Mock).mock.calls[0][0];
        expect(messages).toHaveLength(1);
        expect(messages[0].text).toBe('Olá!');
    });

    it('404 — oferta não encontrada', async () => {
        const req = makeRequest({ user: { uid: EST_UID }, params: { offerId: 'nope' } });
        const res = makeResponse();
        await estGetMessages(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('403 — estabelecimento não é dono da demanda', async () => {
        seedDemand({ establishmentUid: OTHER_UID });
        seedOffer({ establishmentUid: OTHER_UID });
        const req = makeRequest({ user: { uid: EST_UID }, params: { offerId: OFFER_ID } });
        const res = makeResponse();
        await estGetMessages(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

// ─── estSendMessage ───────────────────────────────────────────────────────────

describe('estSendMessage', () => {
    it('201 — envia mensagem', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({
            user: { uid: EST_UID },
            params: { offerId: OFFER_ID },
            body: { text: 'Confirma entrega quinta?' },
        });
        const res = makeResponse();
        await estSendMessage(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(201);
        const { message } = (res.json as jest.Mock).mock.calls[0][0];
        expect(message.text).toBe('Confirma entrega quinta?');
        expect(message.authorRole).toBe('establishment');
        expect(message.senderUid).toBe(EST_UID);
    });

    it('400 — texto vazio', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({
            user: { uid: EST_UID },
            params: { offerId: OFFER_ID },
            body: { text: '   ' },
        });
        const res = makeResponse();
        await estSendMessage(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('400 — sem campo text', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({
            user: { uid: EST_UID },
            params: { offerId: OFFER_ID },
            body: {},
        });
        const res = makeResponse();
        await estSendMessage(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it.each(['rejected', 'confirmed', 'cancelled'])(
        '409 — estabelecimento não pode enviar msg para oferta %s',
        async (closedStatus) => {
            seedDemand();
            seedOffer({ status: closedStatus as any });
            const req = makeRequest({
                user: { uid: EST_UID },
                params: { offerId: OFFER_ID },
                body: { text: 'Ainda dá?' },
            });
            const res = makeResponse();
            await estSendMessage(req as any, res as any);
            expect(res.status).toHaveBeenCalledWith(409);
        },
    );
});

// ─── estMarkRead ──────────────────────────────────────────────────────────────

describe('estMarkRead', () => {
    it('204 — marca mensagens como lidas', async () => {
        seedDemand();
        seedOffer();
        seedMessage('msg-001', 'Oi', PRODUCER_UID, 'ruralProducer', false);
        const req = makeRequest({ user: { uid: EST_UID }, params: { offerId: OFFER_ID } });
        const res = makeResponse();
        await estMarkRead(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(204);
        expect(res.send).toHaveBeenCalled();
    });
});

// ─── estGetChatThreads ────────────────────────────────────────────────────────

describe('estGetChatThreads', () => {
    it('retorna lista de threads com lastMessage e unreadCount', async () => {
        seedDemand();
        seedOffer();
        seedMessage('msg-001', 'Posso entregar sexta', PRODUCER_UID, 'ruralProducer', false);

        const req = makeRequest({ user: { uid: EST_UID }, params: {} });
        const res = makeResponse();
        await estGetChatThreads(req as any, res as any);

        expect(res.json).toHaveBeenCalled();
        const { threads } = (res.json as jest.Mock).mock.calls[0][0];
        expect(threads).toHaveLength(1);
        expect(threads[0].offerId).toBe(OFFER_ID);
        expect(threads[0].lastMessage).toBe('Posso entregar sexta');
        expect(threads[0].unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('retorna lista vazia se não há ofertas', async () => {
        const req = makeRequest({ user: { uid: EST_UID }, params: {} });
        const res = makeResponse();
        await estGetChatThreads(req as any, res as any);
        const { threads } = (res.json as jest.Mock).mock.calls[0][0];
        expect(threads).toHaveLength(0);
    });
});

// ─── estUnreadCount ───────────────────────────────────────────────────────────

describe('estUnreadCount', () => {
    it('retorna 0 se não há mensagens', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({ user: { uid: EST_UID }, params: {} });
        const res = makeResponse();
        await estUnreadCount(req as any, res as any);
        const { unreadCount } = (res.json as jest.Mock).mock.calls[0][0];
        expect(unreadCount).toBe(0);
    });

    it('conta mensagens não lidas pelo estabelecimento', async () => {
        seedDemand();
        seedOffer();
        seedMessage('msg-001', 'Oi', PRODUCER_UID, 'ruralProducer', false); // não lida pelo EST
        seedMessage('msg-002', 'Ok', EST_UID, 'establishment', false);       // própria — não conta (senderUid == uid)
        const req = makeRequest({ user: { uid: EST_UID }, params: {} });
        const res = makeResponse();
        await estUnreadCount(req as any, res as any);
        const { unreadCount } = (res.json as jest.Mock).mock.calls[0][0];
        expect(unreadCount).toBe(1);
    });
});

// ─── producerGetMessages ──────────────────────────────────────────────────────

describe('producerGetMessages', () => {
    it('200 — produtor lê mensagens da própria oferta', async () => {
        seedDemand();
        seedOffer();
        seedMessage('msg-001', 'Olá produtor', EST_UID, 'establishment', false);

        const req = makeRequest({ user: { uid: PRODUCER_UID }, params: { offerId: OFFER_ID } });
        const res = makeResponse();
        await producerGetMessages(req as any, res as any);

        expect(res.json).toHaveBeenCalled();
        const { messages } = (res.json as jest.Mock).mock.calls[0][0];
        expect(messages).toHaveLength(1);
    });

    it('403 — produtor tenta ler oferta de outro', async () => {
        seedDemand();
        seedOffer({ producerUid: OTHER_UID });
        const req = makeRequest({ user: { uid: PRODUCER_UID }, params: { offerId: OFFER_ID } });
        const res = makeResponse();
        await producerGetMessages(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

// ─── producerSendMessage ──────────────────────────────────────────────────────

describe('producerSendMessage', () => {
    it('201 — envia mensagem como produtor', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({
            user: { uid: PRODUCER_UID },
            params: { offerId: OFFER_ID },
            body: { text: 'Entrego na quinta de manhã' },
        });
        const res = makeResponse();
        await producerSendMessage(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(201);
        const { message } = (res.json as jest.Mock).mock.calls[0][0];
        expect(message.authorRole).toBe('ruralProducer');
    });

    it('400 — texto ausente', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({
            user: { uid: PRODUCER_UID },
            params: { offerId: OFFER_ID },
            body: {},
        });
        const res = makeResponse();
        await producerSendMessage(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it.each(['rejected', 'confirmed', 'cancelled'])(
        '409 — produtor não pode enviar msg para oferta %s',
        async (closedStatus) => {
            seedDemand();
            seedOffer({ status: closedStatus as any });
            const req = makeRequest({
                user: { uid: PRODUCER_UID },
                params: { offerId: OFFER_ID },
                body: { text: 'Posso mesmo?' },
            });
            const res = makeResponse();
            await producerSendMessage(req as any, res as any);
            expect(res.status).toHaveBeenCalledWith(409);
        },
    );
});

// ─── producerMarkRead ─────────────────────────────────────────────────────────

describe('producerMarkRead', () => {
    it('204 — marca lidas com sucesso', async () => {
        seedDemand();
        seedOffer();
        const req = makeRequest({ user: { uid: PRODUCER_UID }, params: { offerId: OFFER_ID } });
        const res = makeResponse();
        await producerMarkRead(req as any, res as any);
        expect(res.status).toHaveBeenCalledWith(204);
    });
});

// ─── producerGetChatThreads ───────────────────────────────────────────────────

describe('producerGetChatThreads', () => {
    it('retorna threads ativas do produtor', async () => {
        seedDemand();
        seedOffer();

        const req = makeRequest({ user: { uid: PRODUCER_UID }, params: {} });
        const res = makeResponse();
        await producerGetChatThreads(req as any, res as any);

        expect(res.json).toHaveBeenCalled();
        const { threads } = (res.json as jest.Mock).mock.calls[0][0];
        expect(threads).toHaveLength(1);
        expect(threads[0].offerId).toBe(OFFER_ID);
        expect(threads[0].otherPartyRole).toBe('establishment');
    });

    it('retorna lista vazia se produtor não tem ofertas', async () => {
        const req = makeRequest({ user: { uid: PRODUCER_UID }, params: {} });
        const res = makeResponse();
        await producerGetChatThreads(req as any, res as any);
        const { threads } = (res.json as jest.Mock).mock.calls[0][0];
        expect(threads).toHaveLength(0);
    });
});

// ─── producerUnreadCount ──────────────────────────────────────────────────────

describe('producerUnreadCount', () => {
    it('conta mensagens não lidas pelo produtor', async () => {
        seedDemand();
        seedOffer();
        seedMessage('msg-001', 'Confirma?', EST_UID, 'establishment', false); // não lida pelo produtor
        const req = makeRequest({ user: { uid: PRODUCER_UID }, params: {} });
        const res = makeResponse();
        await producerUnreadCount(req as any, res as any);
        const { unreadCount } = (res.json as jest.Mock).mock.calls[0][0];
        expect(unreadCount).toBe(1);
    });
});
