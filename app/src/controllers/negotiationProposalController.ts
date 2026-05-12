/**
 * negotiationProposalController — gerencia propostas de negociação (preço/quantidade).
 *
 * Qualquer parte (establishment ou ruralProducer) pode fazer uma proposta
 * enquanto a oferta estiver com status 'accepted'.
 * Só pode haver uma proposta 'pending' por vez — a outra parte deve responder
 * antes de uma nova proposta poder ser feita.
 *
 * Rotas do estabelecimento:
 *   POST  /establishment/offers/:offerId/proposals                     → propõe novos valores
 *   GET   /establishment/offers/:offerId/proposals                     → histórico
 *   POST  /establishment/offers/:offerId/proposals/:proposalId/respond → aceita ou recusa
 *
 * Rotas do produtor:
 *   POST  /marketplace/offers/:offerId/proposals                       → propõe novos valores
 *   GET   /marketplace/offers/:offerId/proposals                       → histórico
 *   POST  /marketplace/offers/:offerId/proposals/:proposalId/respond   → aceita ou recusa
 */

import { Request, Response } from 'express';
import {
    findProposal,
    findPendingProposalForOffer,
    listProposalsByOffer,
    createProposal,
    respondToProposal,
} from '../models/negotiationProposal';
import { findOffer, updateOfferStatus } from '../models/demandOffer';
import { findDemand } from '../models/establishmentDemand';
import { createMessage } from '../models/offerMessage';
import { findRuralProducerProfile } from '../models/profiles/ruralProducer';
import { findEstablishmentProfile } from '../models/profiles/establishment';
import { db } from '../config/firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveDisplayName(uid: string, role: 'establishment' | 'ruralProducer'): Promise<string> {
    if (role === 'establishment') {
        const p = await findEstablishmentProfile(uid);
        return p?.businessName?.trim() || 'Estabelecimento';
    }
    const p = await findRuralProducerProfile(uid);
    return p?.displayName?.trim() || 'Produtor';
}

function fmtCurrency(v: number): string {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Valida que o usuário autenticado tem acesso à oferta com o papel esperado.
 * Retorna o objeto da oferta ou encerra a resposta com erro.
 * Não verifica status — usar para leitura (GET).
 */
async function validateAccessReadOnly(
    req: Request,
    res: Response,
    offerId: string,
    role: 'establishment' | 'ruralProducer',
) {
    const offer = await findOffer(offerId);
    if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return null; }

    if (role === 'establishment' && offer.establishmentUid !== req.user.uid) {
        res.status(403).json({ error: 'Acesso negado.' }); return null;
    }
    if (role === 'ruralProducer' && offer.producerUid !== req.user.uid) {
        res.status(403).json({ error: 'Acesso negado.' }); return null;
    }
    return offer;
}

/**
 * Valida que o usuário autenticado tem acesso à oferta com o papel esperado.
 * Retorna o objeto da oferta ou encerra a resposta com erro.
 * Exige status 'accepted' — usar para criação/resposta de propostas (POST).
 */
async function validateAccess(
    req: Request,
    res: Response,
    offerId: string,
    role: 'establishment' | 'ruralProducer',
) {
    const offer = await findOffer(offerId);
    if (!offer) { res.status(404).json({ error: 'Oferta não encontrada.' }); return null; }

    if (role === 'establishment' && offer.establishmentUid !== req.user.uid) {
        res.status(403).json({ error: 'Acesso negado.' }); return null;
    }
    if (role === 'ruralProducer' && offer.producerUid !== req.user.uid) {
        res.status(403).json({ error: 'Acesso negado.' }); return null;
    }
    if (offer.status !== 'accepted') {
        res.status(409).json({ error: 'Propostas só são permitidas em ofertas com status "accepted".' });
        return null;
    }
    return offer;
}

// ─── GET histórico ────────────────────────────────────────────────────────────

async function getProposals(req: Request, res: Response, role: 'establishment' | 'ruralProducer'): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        const offer = await validateAccessReadOnly(req, res, offerId, role);
        if (!offer) return;

        const proposals = await listProposalsByOffer(offerId);
        res.json({ proposals });
    } catch (e) {
        console.error('[negotiation.getProposals] error:', e);
        res.status(500).json({ error: 'Erro ao buscar propostas.' });
    }
}

export async function estGetProposals(req: Request, res: Response): Promise<void> {
    return getProposals(req, res, 'establishment');
}

export async function producerGetProposals(req: Request, res: Response): Promise<void> {
    return getProposals(req, res, 'ruralProducer');
}

// ─── POST proposta ────────────────────────────────────────────────────────────

async function submitProposal(
    req: Request,
    res: Response,
    proposerRole: 'establishment' | 'ruralProducer',
): Promise<void> {
    try {
        const { offerId } = req.params as { offerId: string };
        const uid = req.user.uid;

        const offer = await validateAccess(req, res, offerId, proposerRole);
        if (!offer) return;

        // Bloqueia nova proposta se já há uma pendente
        const existing = await findPendingProposalForOffer(offerId);
        if (existing) {
            res.status(409).json({
                error: 'Já existe uma proposta pendente. Aguarde a resposta antes de propor novamente.',
                pendingProposalId: existing.id,
            });
            return;
        }

        const { proposedPrice, proposedQuantity, note } = req.body ?? {};

        if (typeof proposedPrice !== 'number' || proposedPrice <= 0) {
            res.status(400).json({ error: 'proposedPrice deve ser um número positivo.' });
            return;
        }
        if (typeof proposedQuantity !== 'number' || proposedQuantity <= 0) {
            res.status(400).json({ error: 'proposedQuantity deve ser um número positivo.' });
            return;
        }

        const demand = await findDemand(offer.demandId);
        const unit = demand?.unit ?? 'un';
        const proposerName = await resolveDisplayName(uid, proposerRole);

        const proposal = await createProposal({
            offerId,
            proposerUid:       uid,
            proposerRole,
            proposerName,
            proposedPrice,
            proposedQuantity,
            unit,
            previousPrice:    offer.pricePerUnit,
            previousQuantity: offer.quantity,
            status:           'pending',
            note:             typeof note === 'string' && note.trim() ? note.trim() : null,
            createdAt:        new Date().toISOString(),
            respondedAt:      null,
        });

        // Mensagem-sistema automática no chat
        const priceChanged    = proposedPrice    !== offer.pricePerUnit;
        const quantityChanged = proposedQuantity !== offer.quantity;
        const changes: string[] = [];
        if (priceChanged)    changes.push(`preço: ${fmtCurrency(offer.pricePerUnit)} → ${fmtCurrency(proposedPrice)}`);
        if (quantityChanged) changes.push(`quantidade: ${offer.quantity} → ${proposedQuantity} ${unit}`);

        const systemText = `📋 ${proposerName} fez uma proposta: ${changes.join(', ')}.`;
        await createMessage(offerId, offer.demandId, uid, proposerName, proposerRole, systemText);

        res.status(201).json({ proposal });
    } catch (e) {
        console.error('[negotiation.submitProposal] error:', e);
        res.status(500).json({ error: 'Erro ao criar proposta.' });
    }
}

export async function estSubmitProposal(req: Request, res: Response): Promise<void> {
    return submitProposal(req, res, 'establishment');
}

export async function producerSubmitProposal(req: Request, res: Response): Promise<void> {
    return submitProposal(req, res, 'ruralProducer');
}

// ─── POST resposta (aceitar/recusar) ──────────────────────────────────────────

async function respondProposal(
    req: Request,
    res: Response,
    responderRole: 'establishment' | 'ruralProducer',
): Promise<void> {
    try {
        const { offerId, proposalId } = req.params as { offerId: string; proposalId: string };
        const uid = req.user.uid;

        const offer = await validateAccess(req, res, offerId, responderRole);
        if (!offer) return;

        const proposal = await findProposal(proposalId);
        if (!proposal || proposal.offerId !== offerId) {
            res.status(404).json({ error: 'Proposta não encontrada.' }); return;
        }
        if (proposal.status !== 'pending') {
            res.status(409).json({ error: 'Esta proposta já foi respondida.' }); return;
        }
        // Quem responde deve ser a parte oposta a quem propôs
        if (proposal.proposerRole === responderRole) {
            res.status(403).json({ error: 'Você não pode responder sua própria proposta.' }); return;
        }

        const { action } = req.body ?? {};
        if (action !== 'accept' && action !== 'reject') {
            res.status(400).json({ error: 'action deve ser "accept" ou "reject".' }); return;
        }

        const updated = await respondToProposal(proposalId, action === 'accept' ? 'accepted' : 'rejected');
        const responderName = await resolveDisplayName(uid, responderRole);

        if (action === 'accept') {
            // Atualiza os valores da oferta no Firestore
            const now = new Date().toISOString();
            await db.collection('ruralProducerOffers').doc(offerId).update({
                pricePerUnit: proposal.proposedPrice,
                quantity:     proposal.proposedQuantity,
                updatedAt:    now,
            });

            const systemText = `✅ ${responderName} aceitou a proposta. Novo preço: ${fmtCurrency(proposal.proposedPrice)}, quantidade: ${proposal.proposedQuantity} ${proposal.unit}.`;
            await createMessage(offerId, offer.demandId, uid, responderName, responderRole, systemText);
        } else {
            const systemText = `❌ ${responderName} recusou a proposta. Os valores anteriores continuam em vigor.`;
            await createMessage(offerId, offer.demandId, uid, responderName, responderRole, systemText);
        }

        res.json({ proposal: updated });
    } catch (e) {
        console.error('[negotiation.respondProposal] error:', e);
        res.status(500).json({ error: 'Erro ao responder proposta.' });
    }
}

export async function estRespondProposal(req: Request, res: Response): Promise<void> {
    return respondProposal(req, res, 'establishment');
}

export async function producerRespondProposal(req: Request, res: Response): Promise<void> {
    return respondProposal(req, res, 'ruralProducer');
}
