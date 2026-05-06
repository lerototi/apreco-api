/**
 * Modelo de Oferta de Produtor para uma Demanda (DemandOffer).
 *
 * Coleção no Firestore:
 *   establishmentDemands/{demandId}/offers/{offerId}
 *
 * Subcoleção da demanda para:
 *   - Segurança via regras Firestore (leitura vinculada à demanda pai)
 *   - Queries eficientes dentro de uma demanda
 *   - Deleção em cascata quando a demanda é cancelada
 *
 * Status da oferta:
 *   pending     → aguardando resposta do estabelecimento
 *   accepted    → estabelecimento aceitou iniciar negociação
 *   rejected    → estabelecimento recusou
 *   confirmed   → negócio fechado, quantidade abatida da demanda
 *   cancelled   → produtor cancelou a oferta
 */

import { db } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'cancelled';

export interface DemandOffer {
    id: string;
    demandId: string;

    /** UID do produtor que fez a oferta */
    producerUid: string;
    /** Nome de exibição do produtor (snapshot no momento da oferta) */
    producerName: string;

    /** Quantidade ofertada (na unidade da demanda) */
    quantity: number;
    /** Preço por unidade ofertado pelo produtor */
    pricePerUnit: number;

    /** Mensagem livre do produtor (prazo, condições, origem etc.) */
    message: string | null;

    status: OfferStatus;

    createdAt: string;
    updatedAt: string;
}

export type DemandOfferInput = Pick<DemandOffer,
    'quantity' | 'pricePerUnit' | 'message'>;

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type RawInput = Record<string, unknown>;

export function buildOfferInput(p: RawInput): DemandOfferInput {
    return {
        quantity:     typeof p.quantity     === 'number' && p.quantity > 0     ? p.quantity     : 0,
        pricePerUnit: typeof p.pricePerUnit === 'number' && p.pricePerUnit > 0 ? p.pricePerUnit : 0,
        message:      typeof p.message === 'string' && p.message.trim()        ? p.message.trim() : null,
    };
}

// ─── Coleção ──────────────────────────────────────────────────────────────────

function offersCol(demandId: string) {
    return db.collection('establishmentDemands').doc(demandId).collection('offers');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listOffersByDemand(demandId: string): Promise<DemandOffer[]> {
    const snap = await offersCol(demandId)
        .orderBy('createdAt', 'asc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

export async function listOffersByProducer(producerUid: string): Promise<DemandOffer[]> {
    const snap = await db
        .collectionGroup('offers')
        .where('producerUid', '==', producerUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

export async function findOffer(demandId: string, offerId: string): Promise<DemandOffer | null> {
    const doc = await offersCol(demandId).doc(offerId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as DemandOffer;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createOffer(
    demandId: string,
    producerUid: string,
    producerName: string,
    data: DemandOfferInput,
): Promise<DemandOffer> {
    const now = new Date().toISOString();
    const ref = offersCol(demandId).doc();
    const offer: DemandOffer = {
        id: ref.id,
        demandId,
        producerUid,
        producerName,
        ...data,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(offer);
    return offer;
}

export async function updateOfferStatus(
    demandId: string,
    offerId: string,
    status: OfferStatus,
): Promise<DemandOffer> {
    const now = new Date().toISOString();
    const ref = offersCol(demandId).doc(offerId);
    await ref.update({ status, updatedAt: now });
    const updated = await findOffer(demandId, offerId);
    if (!updated) throw new Error('Offer not found after update.');
    return updated;
}

export async function cancelOfferByProducer(
    demandId: string,
    offerId: string,
    producerUid: string,
): Promise<void> {
    const offer = await findOffer(demandId, offerId);
    if (!offer)                            throw new Error('Offer not found.');
    if (offer.producerUid !== producerUid) throw new Error('Forbidden.');
    if (offer.status === 'confirmed')      throw new Error('Cannot cancel a confirmed offer.');
    await updateOfferStatus(demandId, offerId, 'cancelled');
}

/**
 * Agrega métricas de engajamento de uma demanda a partir das suas ofertas.
 * Retorna offerCount, quantityOffered (pending+accepted) e quantityConfirmed.
 */
export async function getDemandOfferStats(demandId: string): Promise<{
    offerCount: number;
    quantityOffered: number;
    quantityConfirmed: number;
}> {
    const offers = await listOffersByDemand(demandId);
    const active = offers.filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
    return {
        offerCount:        active.length,
        quantityOffered:   active
            .filter(o => o.status === 'pending' || o.status === 'accepted')
            .reduce((sum, o) => sum + o.quantity, 0),
        quantityConfirmed: active
            .filter(o => o.status === 'confirmed')
            .reduce((sum, o) => sum + o.quantity, 0),
    };
}
