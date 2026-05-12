/**
 * Modelo de Oferta de Produtor Rural (DemandOffer).
 *
 * Coleção raiz no Firestore:
 *   ruralProducerOffers/{offerId}
 *
 * Desnormalizada para permitir:
 *   - Queries diretas por produtor (producerUid) ou por estabelecimento (establishmentUid)
 *   - Listagem de todas as ofertas de uma demanda sem collectionGroup
 *   - Deleção/cancelamento independente do ciclo de vida da demanda
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

    /** UID do produtor que fez a oferta */
    producerUid: string;
    /** Nome de exibição do produtor (snapshot no momento da oferta) */
    producerName: string;

    /** Referência à demanda do estabelecimento */
    demandId: string;
    /** Desnormalizado da demanda — permite queries por estabelecimento sem join */
    establishmentUid: string;

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

function offersCol() {
    return db.collection('ruralProducerOffers');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listOffersByDemand(demandId: string): Promise<DemandOffer[]> {
    const snap = await offersCol()
        .where('demandId', '==', demandId)
        .orderBy('createdAt', 'asc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

export async function listOffersByProducer(producerUid: string): Promise<DemandOffer[]> {
    const snap = await offersCol()
        .where('producerUid', '==', producerUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

/** Lista apenas ofertas com status 'accepted' de um produtor (para chat-threads). */
export async function listAcceptedOffersByProducer(producerUid: string): Promise<DemandOffer[]> {
    const snap = await offersCol()
        .where('producerUid', '==', producerUid)
        .where('status', '==', 'accepted')
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

export async function listOffersByEstablishment(establishmentUid: string): Promise<DemandOffer[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

/** Lista apenas ofertas com status 'accepted' de um estabelecimento (para chat-threads). */
export async function listAcceptedOffersByEstablishment(establishmentUid: string): Promise<DemandOffer[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .where('status', '==', 'accepted')
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

/**
 * Lista todas as ofertas com status 'pending' ou 'accepted' de um estabelecimento.
 * Retorna também o nome do insumo da demanda para exibição na tela.
 */
export async function listPendingOffersByEstablishment(
    establishmentUid: string,
): Promise<(DemandOffer & { demandProductName: string })[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .where('status', 'in', ['pending', 'accepted'])
        .orderBy('createdAt', 'asc')
        .get();

    if (snap.empty) return [];

    // Busca nomes dos produtos das demandas envolvidas
    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, string>();

    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) {
            demandMap.set(did, (doc.data()?.productName as string) ?? '');
        }
    }));

    const results = snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        return {
            ...offer,
            demandProductName: demandMap.get(offer.demandId) ?? '',
        };
    });

    // pending primeiro, depois accepted; dentro de cada grupo: mais antigas primeiro
    const ORDER = { pending: 0, accepted: 1, confirmed: 2, rejected: 3, cancelled: 4 };
    results.sort((a, b) =>
        (ORDER[a.status] - ORDER[b.status]) ||
        a.createdAt.localeCompare(b.createdAt)
    );

    return results;
}

/**
 * Lista TODAS as ofertas de um estabelecimento (todos os status).
 * Retorna também o nome do insumo da demanda para exibição na tela.
 * Ordem: pending → accepted → confirmed → rejected → cancelled; dentro de cada grupo: mais recentes primeiro.
 */
export async function listAllOffersByEstablishment(
    establishmentUid: string,
): Promise<(DemandOffer & { demandProductName: string })[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();

    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, string>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) demandMap.set(did, (doc.data()?.productName as string) ?? '');
    }));

    const results = snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        return { ...offer, demandProductName: demandMap.get(offer.demandId) ?? '' };
    });

    const ORDER = { pending: 0, accepted: 1, confirmed: 2, rejected: 3, cancelled: 4 };
    results.sort((a, b) =>
        (ORDER[a.status] - ORDER[b.status]) ||
        b.createdAt.localeCompare(a.createdAt),
    );

    return results;
}

export async function findOffer(offerId: string): Promise<DemandOffer | null> {
    const doc = await offersCol().doc(offerId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as DemandOffer;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createOffer(
    demandId: string,
    establishmentUid: string,
    producerUid: string,
    producerName: string,
    data: DemandOfferInput,
): Promise<DemandOffer> {
    const now = new Date().toISOString();
    const ref = offersCol().doc();
    const offer: DemandOffer = {
        id: ref.id,
        producerUid,
        producerName,
        demandId,
        establishmentUid,
        ...data,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(offer);
    return offer;
}

export async function updateOfferStatus(
    offerId: string,
    status: OfferStatus,
): Promise<DemandOffer> {
    const now = new Date().toISOString();
    const ref = offersCol().doc(offerId);
    await ref.update({ status, updatedAt: now });
    const updated = await findOffer(offerId);
    if (!updated) throw new Error('Offer not found after update.');
    return updated;
}

export async function cancelOfferByProducer(
    offerId: string,
    producerUid: string,
): Promise<void> {
    const offer = await findOffer(offerId);
    if (!offer)                            throw new Error('Offer not found.');
    if (offer.producerUid !== producerUid) throw new Error('Forbidden.');
    if (offer.status === 'confirmed')      throw new Error('Cannot cancel a confirmed offer.');
    await updateOfferStatus(offerId, 'cancelled');
}

/**
 * Agrega métricas de engajamento de uma demanda a partir das suas ofertas.
 */
export async function getDemandOfferStats(demandId: string): Promise<{
    offerCount: number;
    quantityOffered: number;
    quantityConfirmed: number;
}> {
    const offers = await listOffersByDemand(demandId);
    const nonCancelled = offers.filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
    return {
        offerCount:        offers.length,          // total real incluindo histórico
        quantityOffered:   nonCancelled
            .filter(o => o.status === 'pending' || o.status === 'accepted')
            .reduce((sum, o) => sum + o.quantity, 0),
        quantityConfirmed: nonCancelled
            .filter(o => o.status === 'confirmed')
            .reduce((sum, o) => sum + o.quantity, 0),
    };
}
