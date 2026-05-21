/**
 * offerController — gerencia ofertas de produtores para demandas de insumos.
 *
 * Ciclo de vida da oferta:
 *   pending     → produtor enviou, aguardando resposta do estabelecimento
 *   negotiating → estabelecimento quer negociar (negotiatingPrice/Qty/Note)
 *   accepted    → negócio fechado (estab. aceitou direto, ou produtor aceitou negociação)
 *   rejected    → recusado por qualquer parte
 *   cancelled   → produtor cancelou
 *
 * Rotas do estabelecimento (autenticado, requer perfil establishment):
 *   GET    /establishment/pending-offers                → lista pending + negotiating
 *   GET    /establishment/all-offers                    → todos os status
 *   GET    /establishment/demands/:demandId/offers      → lista ofertas de uma demanda
 *   GET    /establishment/offers/:offerId               → detalhe de uma oferta
 *   POST   /establishment/offers/:offerId/accept        → aceita diretamente (pending → accepted)
 *   POST   /establishment/offers/:offerId/negotiate     → inicia negociação (pending/negotiating → negotiating)
 *   POST   /establishment/offers/:offerId/reject        → recusa (pending/negotiating → rejected)
 *
 * Rotas do produtor (autenticado):
 *   POST   /marketplace/demands/:demandId/offers              → cria oferta
 *   DELETE /marketplace/offers/:offerId                       → cancela própria oferta
 *   GET    /marketplace/my-offers                             → lista próprias ofertas
 *   POST   /marketplace/offers/:offerId/accept-negotiation    → aceita termos do estab. (negotiating → accepted)
 *   POST   /marketplace/offers/:offerId/reject-negotiation    → recusa termos do estab. (negotiating → rejected)
 */

import { Request, Response } from 'express';
import {
    buildOfferInput,
    createOffer,
    findOffer,
    listOffersByDemand,
    listOffersByProducer,
    listPendingOffersByEstablishment,
    listAllOffersByEstablishment,
    cancelOfferByProducer,
    updateOfferStatus,
    negotiateOffer,
    acceptNegotiation,
    resubmitOffer,
    getDemandOfferStats,
} from '../models/demandOffer';
import { findDemand, updateDemandStatus } from '../models/establishmentDemand';
import { findRuralProducerProfile } from '../models/profiles/ruralProducer';
import { createSystemMessage, createMessage } from '../models/offerMessage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveProducerName(uid: string): Promise<string> {
    const profile = await findRuralProducerProfile(uid);
    return profile?.displayName?.trim() || 'Produtor';
}

// ─── Rotas do estabelecimento ─────────────────────────────────────────────────

/**
 * GET /establishment/pending-offers
 * Lista todas as ofertas pending e negotiating de todas as demandas do estabelecimento.
 */
export async function getPendingOffers(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const offers = await listPendingOffersByEstablishment(uid);
        res.json({ offers });
    } catch (e) {
        console.error('[offer.getPendingOffers] error:', e);
        res.status(500).json({ error: 'Erro ao buscar ofertas pendentes.' });
    }
}

/**
 * GET /establishment/all-offers
 * Lista TODAS as ofertas (todos os status) do estabelecimento.
 */
export async function getAllOffers(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const offers = await listAllOffersByEstablishment(uid);
        res.json({ offers });
    } catch (e) {
        console.error('[offer.getAllOffers] error:', e);
        res.status(500).json({ error: 'Erro ao buscar ofertas.' });
    }
}

/**
 * GET /establishment/demands/:demandId/offers
 * Lista todas as ofertas de uma demanda do estabelecimento autenticado.
 * Inclui métricas de engajamento (offerCount, quantityOffered, quantityAccepted).
 */
export async function getOffersForDemand(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;

        const demand = await findDemand(demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        const [offers, stats] = await Promise.all([
            listOffersByDemand(demandId),
            getDemandOfferStats(demandId),
        ]);

        const enrichedOffers = offers.map(o => ({
            ...o,
            demandUnit: demand.unit,
        }));

        res.json({ offers: enrichedOffers, ...stats });
    } catch (e) {
        console.error('[offer.getOffersForDemand] error:', e);
        res.status(500).json({ error: 'Erro ao buscar ofertas.' });
    }
}

/**
 * GET /establishment/offers/:offerId
 */
export async function getOfferDetail(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }

        const demand = await findDemand(offer.demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        res.json({ offer });
    } catch (e) {
        console.error('[offer.getOfferDetail] error:', e);
        res.status(500).json({ error: 'Erro ao buscar oferta.' });
    }
}

/**
 * POST /establishment/offers/:offerId/accept
 * Estabelecimento aceita a oferta diretamente → pending/negotiating → accepted.
 * Quantidade aceita é abatida da demanda; demanda fecha se atingir o total.
 */
export async function acceptOffer(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }

        const demand = await findDemand(offer.demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        if (offer.status !== 'pending' && offer.status !== 'negotiating') {
            res.status(409).json({ error: 'Apenas ofertas pending ou negotiating podem ser aceitas.' }); return;
        }

        const updated = await updateOfferStatus(offerId, 'accepted');

        // Fecha negócio: abate quantidade e verifica se demanda foi totalmente atendida
        const stats = await getDemandOfferStats(offer.demandId);
        const fullyFulfilled = stats.quantityAccepted >= demand.quantityNeeded;
        if (fullyFulfilled) {
            await updateDemandStatus(offer.demandId, 'closed');
        } else {
            await updateDemandStatus(offer.demandId, 'open');
        }

        await createSystemMessage(
            offerId,
            offer.demandId,
            '✅ Negócio confirmado! O acordo foi fechado e a quantidade registrada como atendida.',
            [`${uid}:establishment`],
        ).catch(() => {});

        res.json({ offer: updated, stats });
    } catch (e) {
        console.error('[offer.acceptOffer] error:', e);
        res.status(500).json({ error: 'Erro ao aceitar oferta.' });
    }
}

/**
 * POST /establishment/offers/:offerId/negotiate
 * Estabelecimento propõe novos termos (preço e/ou quantidade).
 * Requer body: { negotiatingPrice, negotiatingQuantity, negotiatingNote? }
 * pending/negotiating → negotiating
 */
export async function negotiateOfferHandler(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const offerId = req.params['offerId'] as string;
        const body = req.body as Record<string, unknown>;

        const negotiatingPrice    = typeof body.negotiatingPrice    === 'number' ? body.negotiatingPrice    : NaN;
        const negotiatingQuantity = typeof body.negotiatingQuantity === 'number' ? body.negotiatingQuantity : NaN;
        const negotiatingNote     = typeof body.negotiatingNote     === 'string' && body.negotiatingNote.trim()
            ? body.negotiatingNote.trim()
            : null;

        if (isNaN(negotiatingPrice) || negotiatingPrice <= 0) {
            res.status(400).json({ error: 'negotiatingPrice deve ser maior que zero.' }); return;
        }
        if (isNaN(negotiatingQuantity) || negotiatingQuantity <= 0) {
            res.status(400).json({ error: 'negotiatingQuantity deve ser maior que zero.' }); return;
        }

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }

        const demand = await findDemand(offer.demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        if (offer.status !== 'pending' && offer.status !== 'negotiating') {
            res.status(409).json({ error: 'Apenas ofertas pending ou negotiating podem entrar em negociação.' }); return;
        }

        const updated = await negotiateOffer(offerId, negotiatingPrice, negotiatingQuantity, negotiatingNote);

        const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const noteText = negotiatingNote ? `\nObservação: "${negotiatingNote}"` : '';
        await createSystemMessage(
            offerId,
            offer.demandId,
            `🔄 O estabelecimento propôs novos termos:\n` +
            `Preço: ${fmtBRL(negotiatingPrice)} / ${demand.unit}\n` +
            `Quantidade: ${negotiatingQuantity.toLocaleString('pt-BR')} ${demand.unit}` +
            noteText,
            [`${uid}:establishment`],
        ).catch(() => {});

        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.negotiateOfferHandler] error:', e);
        res.status(500).json({ error: 'Erro ao propor negociação.' });
    }
}

/**
 * POST /establishment/offers/:offerId/reject
 * Estabelecimento recusa a oferta (pending/negotiating → rejected).
 */
export async function rejectOffer(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }

        const demand = await findDemand(offer.demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        if (offer.status !== 'pending' && offer.status !== 'negotiating') {
            res.status(409).json({ error: 'Esta oferta não pode ser recusada no status atual.' }); return;
        }

        const updated = await updateOfferStatus(offerId, 'rejected');

        await createSystemMessage(
            offerId,
            offer.demandId,
            '❌ Esta oferta foi recusada pelo estabelecimento. O histórico desta negociação permanece disponível para consulta.',
            [`${uid}:establishment`],
        ).catch(() => {});

        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.rejectOffer] error:', e);
        res.status(500).json({ error: 'Erro ao recusar oferta.' });
    }
}

// ─── Rotas do produtor (marketplace) ─────────────────────────────────────────

/**
 * POST /marketplace/demands/:demandId/offers
 * Produtor submete uma oferta para uma demanda aberta.
 */
export async function submitOffer(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const input = buildOfferInput(req.body as Record<string, unknown>);

        if (input.quantity <= 0) {
            res.status(400).json({ error: 'quantity deve ser maior que zero.' }); return;
        }
        if (input.pricePerUnit <= 0) {
            res.status(400).json({ error: 'pricePerUnit deve ser maior que zero.' }); return;
        }

        const demand = await findDemand(demandId);
        if (!demand || demand.status !== 'open') {
            res.status(404).json({ error: 'Solicitação não encontrada ou não está aberta.' }); return;
        }

        // TODO: reativar antes de ir para produção — impede auto-oferta.
        // if (demand.establishmentUid === producerUid) {
        //     res.status(403).json({ error: 'Não é possível ofertar para a própria solicitação.' }); return;
        // }

        const producerName = await resolveProducerName(producerUid);
        const offer = await createOffer(demandId, demand.establishmentUid, producerUid, producerName, input);

        const isByTotal = demand.unit === 'g' || demand.unit === 'mL';
        const totalValue = isByTotal
            ? input.pricePerUnit
            : input.pricePerUnit * input.quantity;
        const fmtBRL = (v: number) =>
            v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const priceLabel = isByTotal
            ? `Valor total: ${fmtBRL(totalValue)}`
            : `${fmtBRL(input.pricePerUnit)} / ${demand.unit} · Total: ${fmtBRL(totalValue)}`;

        const introText =
            `📦 Nova oferta enviada por ${producerName}\n` +
            `Produto: ${demand.productName}\n` +
            `Quantidade: ${input.quantity.toLocaleString('pt-BR')} ${demand.unit}\n` +
            `${priceLabel}`;

        await createSystemMessage(offer.id, demandId, introText, [`${producerUid}:ruralProducer`]).catch(() => {});

        if (input.message) {
            await createMessage(
                offer.id,
                demandId,
                producerUid,
                producerName,
                'ruralProducer',
                input.message,
            ).catch(() => {});
        }

        res.status(201).json({ offer });
    } catch (e) {
        console.error('[offer.submitOffer] error:', e);
        res.status(500).json({ error: 'Erro ao enviar oferta.' });
    }
}

/**
 * DELETE /marketplace/offers/:offerId
 * Produtor cancela a própria oferta (pending/negotiating → cancelled).
 */
export async function cancelOffer(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offerBefore = await findOffer(offerId);

        await cancelOfferByProducer(offerId, producerUid);

        if (offerBefore) {
            await createSystemMessage(
                offerId,
                offerBefore.demandId,
                '🚫 O produtor cancelou esta oferta. O histórico desta negociação permanece disponível para consulta.',
                [`${producerUid}:ruralProducer`],
            ).catch(() => {});
        }

        res.status(204).send();
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'Offer not found.')                    { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (msg === 'Forbidden.')                          { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (msg === 'Cannot cancel an accepted offer.')    { res.status(409).json({ error: 'Não é possível cancelar uma oferta já aceita.' }); return; }
        console.error('[offer.cancelOffer] error:', e);
        res.status(500).json({ error: 'Erro ao cancelar oferta.' });
    }
}

/**
 * GET /marketplace/my-offers
 * Produtor lista todas as suas próprias ofertas.
 */
export async function getMyOffers(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const offers = await listOffersByProducer(producerUid);
        res.json({ offers });
    } catch (e) {
        console.error('[offer.getMyOffers] error:', e);
        res.status(500).json({ error: 'Erro ao buscar suas ofertas.' });
    }
}

/**
 * POST /marketplace/offers/:offerId/accept-negotiation
 * Produtor aceita os termos propostos pelo estabelecimento (negotiating → accepted).
 */
export async function producerAcceptNegotiation(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (offer.producerUid !== producerUid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        if (offer.status !== 'negotiating') {
            res.status(409).json({ error: 'Apenas ofertas em negociação podem ter os termos aceitos.' }); return;
        }

        const updated = await acceptNegotiation(offerId);

        // Fecha negócio: abate quantidade e verifica se demanda foi totalmente atendida
        const demand = await findDemand(offer.demandId);
        if (demand) {
            const stats = await getDemandOfferStats(offer.demandId);
            const fullyFulfilled = stats.quantityAccepted >= demand.quantityNeeded;
            if (fullyFulfilled) {
                await updateDemandStatus(offer.demandId, 'closed');
            } else {
                await updateDemandStatus(offer.demandId, 'open');
            }
        }

        await createSystemMessage(
            offerId,
            offer.demandId,
            '✅ O produtor aceitou os termos propostos! O acordo foi fechado.',
            [`${producerUid}:ruralProducer`],
        ).catch(() => {});

        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.producerAcceptNegotiation] error:', e);
        res.status(500).json({ error: 'Erro ao aceitar os termos.' });
    }
}

/**
 * POST /marketplace/offers/:offerId/reject-negotiation
 * Produtor recusa os termos propostos pelo estabelecimento (negotiating → rejected).
 */
export async function producerRejectNegotiation(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (offer.producerUid !== producerUid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        if (offer.status !== 'negotiating') {
            res.status(409).json({ error: 'Apenas ofertas em negociação podem ter os termos recusados.' }); return;
        }

        const updated = await updateOfferStatus(offerId, 'rejected');

        await createSystemMessage(
            offerId,
            offer.demandId,
            '❌ O produtor recusou os termos propostos. Se desejar, pode enviar uma nova oferta usando o botão "Negociar".',
            [`${producerUid}:ruralProducer`],
        ).catch(() => {});

        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.producerRejectNegotiation] error:', e);
        res.status(500).json({ error: 'Erro ao recusar os termos.' });
    }
}

/**
 * POST /marketplace/offers/:offerId/resubmit
 * Produtor reenvia uma oferta rejeitada com novos termos (rejected → pending).
 */
export async function producerResubmitOffer(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const offerId = req.params['offerId'] as string;

        const offer = await findOffer(offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (offer.producerUid !== producerUid) { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (offer.status !== 'rejected') {
            res.status(409).json({ error: 'Apenas ofertas recusadas podem ser reenviadas.' }); return;
        }

        const input = buildOfferInput(req.body as Record<string, unknown>);
        if (input.quantity <= 0 || input.pricePerUnit <= 0) {
            res.status(400).json({ error: 'Quantidade e preço devem ser maiores que zero.' }); return;
        }

        const updated = await resubmitOffer(offerId, input);

        await createSystemMessage(
            offerId,
            offer.demandId,
            `🔄 O produtor enviou uma nova proposta: ${input.quantity} × R$ ${input.pricePerUnit.toFixed(2)}. Aguardando resposta do estabelecimento.`,
            [`${producerUid}:ruralProducer`],
        ).catch(() => {});

        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.producerResubmitOffer] error:', e);
        res.status(500).json({ error: 'Erro ao reenviar a oferta.' });
    }
}
