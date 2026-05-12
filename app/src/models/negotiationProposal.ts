/**
 * Modelo de Proposta de Negociação (NegotiationProposal).
 *
 * Coleção raiz no Firestore:
 *   negotiationProposals/{proposalId}
 *
 * Cada proposta representa uma contraproposta de preço e/ou quantidade feita
 * durante a negociação de uma oferta. O histórico completo das propostas
 * (aceitas, recusadas, expiradas) é preservado para rastreabilidade.
 *
 * Status:
 *   pending  → aguardando resposta da outra parte
 *   accepted → outra parte aceitou; oferta é atualizada com novos valores
 *   rejected → outra parte recusou; negociação continua aberta
 */

import { db } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface NegotiationProposal {
    id: string;

    /** Oferta à qual esta proposta pertence */
    offerId: string;

    /** UID de quem fez a proposta */
    proposerUid: string;
    /** Role de quem fez a proposta */
    proposerRole: 'establishment' | 'ruralProducer';
    /** Nome de exibição do proponente */
    proposerName: string;

    /** Novo preço por unidade proposto */
    proposedPrice: number;
    /** Nova quantidade proposta */
    proposedQuantity: number;
    /** Unidade (espelhada da demanda, apenas informativo) */
    unit: string;

    /** Preço anterior (snapshot para histórico) */
    previousPrice: number;
    /** Quantidade anterior (snapshot para histórico) */
    previousQuantity: number;

    status: ProposalStatus;

    /** Mensagem opcional do proponente */
    note: string | null;

    createdAt: string;
    respondedAt: string | null;
}

// ─── Coleção ──────────────────────────────────────────────────────────────────

function proposalsCol() {
    return db.collection('negotiationProposals');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listProposalsByOffer(offerId: string): Promise<NegotiationProposal[]> {
    const snap = await proposalsCol()
        .where('offerId', '==', offerId)
        .orderBy('createdAt', 'asc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as NegotiationProposal));
}

export async function findPendingProposalForOffer(offerId: string): Promise<NegotiationProposal | null> {
    const snap = await proposalsCol()
        .where('offerId', '==', offerId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as NegotiationProposal;
}

export async function findProposal(proposalId: string): Promise<NegotiationProposal | null> {
    const doc = await proposalsCol().doc(proposalId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as NegotiationProposal;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createProposal(data: Omit<NegotiationProposal, 'id'>): Promise<NegotiationProposal> {
    const ref = proposalsCol().doc();
    const proposal: NegotiationProposal = { id: ref.id, ...data };
    await ref.set(proposal);
    return proposal;
}

export async function respondToProposal(
    proposalId: string,
    status: 'accepted' | 'rejected',
): Promise<NegotiationProposal> {
    const now = new Date().toISOString();
    await proposalsCol().doc(proposalId).update({ status, respondedAt: now });
    const updated = await findProposal(proposalId);
    if (!updated) throw new Error('Proposal not found after update.');
    return updated;
}
