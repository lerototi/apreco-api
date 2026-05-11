/**
 * offerMessageController — mensagens de chat de negociação.
 *
 * Mensagens armazenadas em coleção raiz `chatMessages`, vinculadas por offerId.
 * Chat permanece disponível independente do status da oferta.
 *
 * Rotas do estabelecimento:
 *   GET  /establishment/offers/:offerId/messages         → lista msgs
 *   POST /establishment/offers/:offerId/messages         → envia msg
 *   POST /establishment/offers/:offerId/messages/read    → marca lidas
 *   GET  /establishment/chat-threads                     → lista threads ativas
 *   GET  /establishment/chat-threads/unread-count        → total não lidas
 *
 * Rotas do produtor:
 *   GET  /marketplace/offers/:offerId/messages           → lista msgs
 *   POST /marketplace/offers/:offerId/messages           → envia msg
 *   POST /marketplace/offers/:offerId/messages/read      → marca lidas
 *   GET  /marketplace/chat-threads                       → lista threads ativas
 *   GET  /marketplace/chat-threads/unread-count          → total não lidas
 */

import { Request, Response } from 'express';
import {
    listMessagesByOffer,
    createMessage,
    markAllAsRead,
    countUnreadForOffer,
    getLastMessageForOffer,
} from '../models/offerMessage';
import { findOffer, listOffersByProducer, listOffersByEstablishment } from '../models/demandOffer';
import { findDemand } from '../models/establishmentDemand';
import { findRuralProducerProfile } from '../models/profiles/ruralProducer';
import { findEstablishmentProfile } from '../models/profiles/establishment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveDisplayName(uid: string, role: 'establishment' | 'ruralProducer'): Promise<string> {
    if (role === 'establishment') {
        const profile = await findEstablishmentProfile(uid);
        return profile?.businessName?.trim() || 'Estabelecimento';
    }
    const profile = await findRuralProducerProfile(uid);
    return profile?.displayName?.trim() || 'Produtor';
}

/**
 * Valida que o estabelecimento autenticado é dono da demanda vinculada à oferta.
 * Retorna { offer, demand } ou envia resposta de erro e retorna null.
 */
async function validateEstablishmentAccess(
    req: Request, res: Response,
    offerId: string,
) {
    const uid = req.user.uid;
    const offer = await findOffer(offerId);
    if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return null; }

    const demand = await findDemand(offer.demandId);
    if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return null; }
    if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return null; }

    return { offer, demand };
}

/**
 * Valida que o produtor autenticado é dono da oferta.
 * Retorna { offer } ou envia resposta de erro e retorna null.
 */
async function validateProducerAccess(
    req: Request, res: Response,
    offerId: string,
) {
    const uid = req.user.uid;
    const offer = await findOffer(offerId);
    if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return null; }
    if (offer.producerUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return null; }
    return { offer };
}

// ─── Establishment ────────────────────────────────────────────────────────────

/**
 * GET /establishment/offers/:offerId/messages
 * Lista mensagens e marca as recebidas como lidas.
 */
export async function estGetMessages(req: Request, res: Response): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        const access = await validateEstablishmentAccess(req, res, offerId);
        if (!access) return;

        const [messages] = await Promise.all([
            listMessagesByOffer(offerId),
            markAllAsRead(offerId, req.user.uid),
        ]);
        res.json({ messages });
    } catch (e) {
        console.error('[offerMessage.estGetMessages] error:', e);
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
}

/**
 * POST /establishment/offers/:offerId/messages
 * Body: { text: string }
 */
export async function estSendMessage(req: Request, res: Response): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        const access = await validateEstablishmentAccess(req, res, offerId);
        if (!access) return;

        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        if (!text) { res.status(400).json({ error: 'text é obrigatório.' }); return; }

        const senderName = await resolveDisplayName(req.user.uid, 'establishment');
        const message = await createMessage(
            offerId,
            access.offer.demandId,
            req.user.uid,
            senderName,
            'establishment',
            text,
        );
        res.status(201).json({ message });
    } catch (e) {
        console.error('[offerMessage.estSendMessage] error:', e);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
}

/**
 * POST /establishment/offers/:offerId/messages/read
 */
export async function estMarkRead(req: Request, res: Response): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        await markAllAsRead(offerId, req.user.uid);
        res.status(204).send();
    } catch (e) {
        console.error('[offerMessage.estMarkRead] error:', e);
        res.status(500).json({ error: 'Erro ao marcar mensagens como lidas.' });
    }
}

/**
 * GET /establishment/chat-threads
 * Lista threads ativas (todas as ofertas com mensagens) do estabelecimento.
 */
export async function estGetChatThreads(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const allOffers = await listOffersByEstablishment(uid);

        const threads = await Promise.all(
            allOffers.map(async (offer) => {
                const demand = await findDemand(offer.demandId);
                const lastMsg = await getLastMessageForOffer(offer.id);
                const unread = await countUnreadForOffer(offer.id, uid);

                return {
                    offerId:           offer.id,
                    demandId:          offer.demandId,
                    demandProductName: demand?.productName ?? '',
                    otherPartyName:    offer.producerName,
                    otherPartyRole:    'ruralProducer' as const,
                    lastMessage:       lastMsg?.text ?? null,
                    lastMessageAt:     lastMsg?.createdAt ?? null,
                    unreadCount:       unread,
                    offerStatus:       offer.status,
                    offerPricePerUnit: offer.pricePerUnit,
                    offerQuantity:     offer.quantity,
                    offerUnit:         demand?.unit ?? 'un',
                };
            })
        );

        // Ordena: threads com mensagens primeiro, depois por data da última mensagem
        threads.sort((a, b) => {
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return b.lastMessageAt.localeCompare(a.lastMessageAt);
        });

        res.json({ threads });
    } catch (e) {
        console.error('[offerMessage.estGetChatThreads] error:', e);
        res.status(500).json({ error: 'Erro ao buscar conversas.' });
    }
}

/**
 * GET /establishment/chat-threads/unread-count
 */
export async function estUnreadCount(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const allOffers = await listOffersByEstablishment(uid);

        let total = 0;
        await Promise.all(
            allOffers.map(async (offer) => {
                const count = await countUnreadForOffer(offer.id, uid);
                total += count;
            })
        );

        res.json({ unreadCount: total });
    } catch (e) {
        console.error('[offerMessage.estUnreadCount] error:', e);
        res.status(500).json({ error: 'Erro ao contar mensagens não lidas.' });
    }
}

// ─── Producer (marketplace) ───────────────────────────────────────────────────

/**
 * GET /marketplace/offers/:offerId/messages
 */
export async function producerGetMessages(req: Request, res: Response): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        const access = await validateProducerAccess(req, res, offerId);
        if (!access) return;

        const [messages] = await Promise.all([
            listMessagesByOffer(offerId),
            markAllAsRead(offerId, req.user.uid),
        ]);
        res.json({ messages });
    } catch (e) {
        console.error('[offerMessage.producerGetMessages] error:', e);
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
}

/**
 * POST /marketplace/offers/:offerId/messages
 * Body: { text: string }
 */
export async function producerSendMessage(req: Request, res: Response): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        const access = await validateProducerAccess(req, res, offerId);
        if (!access) return;

        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        if (!text) { res.status(400).json({ error: 'text é obrigatório.' }); return; }

        const senderName = await resolveDisplayName(req.user.uid, 'ruralProducer');
        const message = await createMessage(
            offerId,
            access.offer.demandId,
            req.user.uid,
            senderName,
            'ruralProducer',
            text,
        );
        res.status(201).json({ message });
    } catch (e) {
        console.error('[offerMessage.producerSendMessage] error:', e);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
}

/**
 * POST /marketplace/offers/:offerId/messages/read
 */
export async function producerMarkRead(req: Request, res: Response): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        await markAllAsRead(offerId, req.user.uid);
        res.status(204).send();
    } catch (e) {
        console.error('[offerMessage.producerMarkRead] error:', e);
        res.status(500).json({ error: 'Erro ao marcar mensagens como lidas.' });
    }
}

/**
 * GET /marketplace/chat-threads
 * Lista threads ativas do produtor autenticado.
 */
export async function producerGetChatThreads(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const allOffers = await listOffersByProducer(uid);

        const threads = await Promise.all(
            allOffers.map(async (offer) => {
                const demand = await findDemand(offer.demandId);
                const lastMsg = await getLastMessageForOffer(offer.id);
                const unread = await countUnreadForOffer(offer.id, uid);

                const estProfile = await findEstablishmentProfile(offer.establishmentUid);
                const estName = estProfile?.businessName?.trim()
                    || demand?.establishmentName
                    || 'Estabelecimento';

                return {
                    offerId:           offer.id,
                    demandId:          offer.demandId,
                    demandProductName: demand?.productName ?? '',
                    otherPartyName:    estName,
                    otherPartyRole:    'establishment' as const,
                    lastMessage:       lastMsg?.text ?? null,
                    lastMessageAt:     lastMsg?.createdAt ?? null,
                    unreadCount:       unread,
                    offerStatus:       offer.status,
                    offerPricePerUnit: offer.pricePerUnit,
                    offerQuantity:     offer.quantity,
                    offerUnit:         demand?.unit ?? 'un',
                };
            })
        );

        threads.sort((a, b) => {
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return b.lastMessageAt.localeCompare(a.lastMessageAt);
        });

        res.json({ threads });
    } catch (e) {
        console.error('[offerMessage.producerGetChatThreads] error:', e);
        res.status(500).json({ error: 'Erro ao buscar conversas.' });
    }
}

/**
 * GET /marketplace/chat-threads/unread-count
 */
export async function producerUnreadCount(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const allOffers = await listOffersByProducer(uid);

        let total = 0;
        await Promise.all(
            allOffers.map(async (offer) => {
                const count = await countUnreadForOffer(offer.id, uid);
                total += count;
            })
        );

        res.json({ unreadCount: total });
    } catch (e) {
        console.error('[offerMessage.producerUnreadCount] error:', e);
        res.status(500).json({ error: 'Erro ao contar mensagens não lidas.' });
    }
}
