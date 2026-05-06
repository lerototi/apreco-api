/**
 * offerController — gerencia ofertas de produtores para demandas de insumos.
 *
 * Rotas do estabelecimento (autenticado, requer perfil establishment):
 *   GET    /establishment/demands/:demandId/offers          → lista todas as ofertas
 *   GET    /establishment/demands/:demandId/offers/:offerId → detalhe de uma oferta
 *   POST   /establishment/demands/:demandId/offers/:offerId/accept  → aceita negociação
 *   POST   /establishment/demands/:demandId/offers/:offerId/reject  → recusa oferta
 *   POST   /establishment/demands/:demandId/offers/:offerId/confirm → confirma (fecha negócio)
 *
 * Rotas do produtor (autenticado, qualquer perfil):
 *   POST   /marketplace/demands/:demandId/offers            → cria oferta
 *   DELETE /marketplace/demands/:demandId/offers/:offerId   → cancela própria oferta
 *   GET    /marketplace/my-offers                           → lista próprias ofertas
 */

import { Request, Response } from 'express';
import {
    buildOfferInput,
    createOffer,
    findOffer,
    listOffersByDemand,
    listOffersByProducer,
    cancelOfferByProducer,
    updateOfferStatus,
    getDemandOfferStats,
} from '../models/demandOffer';
import { findDemand, updateDemandStatus } from '../models/establishmentDemand';
import { findRuralProducerProfile } from '../models/profiles/ruralProducer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveProducerName(uid: string): Promise<string> {
    const profile = await findRuralProducerProfile(uid);
    return profile?.displayName?.trim() || 'Produtor';
}

// ─── Rotas do estabelecimento ─────────────────────────────────────────────────

/**
 * GET /establishment/demands/:demandId/offers
 * Lista todas as ofertas de uma demanda do estabelecimento autenticado.
 * Inclui métricas de engajamento (offerCount, quantityOffered, quantityConfirmed).
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

        res.json({ offers, ...stats });
    } catch (e) {
        console.error('[offer.getOffersForDemand] error:', e);
        res.status(500).json({ error: 'Erro ao buscar ofertas.' });
    }
}

/**
 * GET /establishment/demands/:demandId/offers/:offerId
 */
export async function getOfferDetail(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const offerId  = req.params['offerId']  as string;

        const demand = await findDemand(demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        const offer = await findOffer(demandId, offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }

        res.json({ offer });
    } catch (e) {
        console.error('[offer.getOfferDetail] error:', e);
        res.status(500).json({ error: 'Erro ao buscar oferta.' });
    }
}

/**
 * POST /establishment/demands/:demandId/offers/:offerId/accept
 * Establishment aceita iniciar negociação com o produtor.
 * Demanda passa para status 'negotiating'.
 */
export async function acceptOffer(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const offerId  = req.params['offerId']  as string;

        const demand = await findDemand(demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        const offer = await findOffer(demandId, offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (offer.status !== 'pending') {
            res.status(409).json({ error: 'Apenas ofertas pendentes podem ser aceitas.' }); return;
        }

        const [updated] = await Promise.all([
            updateOfferStatus(demandId, offerId, 'accepted'),
            updateDemandStatus(demandId, 'negotiating'),
        ]);

        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.acceptOffer] error:', e);
        res.status(500).json({ error: 'Erro ao aceitar oferta.' });
    }
}

/**
 * POST /establishment/demands/:demandId/offers/:offerId/reject
 * Establishment recusa a oferta. Demanda permanece com status atual.
 */
export async function rejectOffer(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const offerId  = req.params['offerId']  as string;

        const demand = await findDemand(demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        const offer = await findOffer(demandId, offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (offer.status !== 'pending' && offer.status !== 'accepted') {
            res.status(409).json({ error: 'Esta oferta não pode ser recusada no status atual.' }); return;
        }

        const updated = await updateOfferStatus(demandId, offerId, 'rejected');
        res.json({ offer: updated });
    } catch (e) {
        console.error('[offer.rejectOffer] error:', e);
        res.status(500).json({ error: 'Erro ao recusar oferta.' });
    }
}

/**
 * POST /establishment/demands/:demandId/offers/:offerId/confirm
 * Negócio fechado: quantidade da oferta é abatida da demanda.
 * Se quantityNeeded for totalmente atendida, demanda passa para 'closed'.
 */
export async function confirmOffer(req: Request, res: Response): Promise<void> {
    try {
        const uid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const offerId  = req.params['offerId']  as string;

        const demand = await findDemand(demandId);
        if (!demand) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
        if (demand.establishmentUid !== uid) { res.status(403).json({ error: 'Acesso negado.' }); return; }

        const offer = await findOffer(demandId, offerId);
        if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (offer.status !== 'accepted') {
            res.status(409).json({ error: 'Apenas ofertas aceitas podem ser confirmadas.' }); return;
        }

        const updated = await updateOfferStatus(demandId, offerId, 'confirmed');

        // Verifica se a demanda foi completamente atendida
        const stats = await getDemandOfferStats(demandId);
        if (stats.quantityConfirmed >= demand.quantityNeeded) {
            await updateDemandStatus(demandId, 'closed');
        }

        res.json({ offer: updated, stats });
    } catch (e) {
        console.error('[offer.confirmOffer] error:', e);
        res.status(500).json({ error: 'Erro ao confirmar oferta.' });
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

        // Produtor não pode ofertar para a própria demanda (caso criasse uma)
        if (demand.establishmentUid === producerUid) {
            res.status(403).json({ error: 'Não é possível ofertar para a própria solicitação.' }); return;
        }

        const producerName = await resolveProducerName(producerUid);
        const offer = await createOffer(demandId, producerUid, producerName, input);
        res.status(201).json({ offer });
    } catch (e) {
        console.error('[offer.submitOffer] error:', e);
        res.status(500).json({ error: 'Erro ao enviar oferta.' });
    }
}

/**
 * DELETE /marketplace/demands/:demandId/offers/:offerId
 * Produtor cancela a própria oferta.
 */
export async function cancelOffer(req: Request, res: Response): Promise<void> {
    try {
        const producerUid = req.user.uid;
        const demandId = req.params['demandId'] as string;
        const offerId  = req.params['offerId']  as string;
        await cancelOfferByProducer(demandId, offerId, producerUid);
        res.status(204).send();
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'Offer not found.')               { res.status(404).json({ error: 'Oferta não encontrada.' }); return; }
        if (msg === 'Forbidden.')                     { res.status(403).json({ error: 'Acesso negado.' }); return; }
        if (msg === 'Cannot cancel a confirmed offer.') { res.status(409).json({ error: 'Não é possível cancelar uma oferta já confirmada.' }); return; }
        console.error('[offer.cancelOffer] error:', e);
        res.status(500).json({ error: 'Erro ao cancelar oferta.' });
    }
}

/**
 * GET /marketplace/my-offers
 * Produtor lista todas as suas próprias ofertas (em todas as demandas).
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
