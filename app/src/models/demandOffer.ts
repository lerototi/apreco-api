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
 * Ciclo de vida da oferta:
 *   pending     → produtor enviou, aguardando resposta do estabelecimento
 *   negotiating → estabelecimento quer negociar (termos em negotiatingPrice/Qty/Note)
 *   accepted    → negócio fechado (estab. aceitou diretamente, ou produtor aceitou negociação)
 *   rejected    → recusado por qualquer parte (produtor pode submeter nova oferta)
 *   cancelled   → produtor cancelou antes de qualquer desfecho
 */

import { db } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type OfferStatus = 'pending' | 'negotiating' | 'accepted' | 'rejected' | 'cancelled';

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

    /**
     * Termos propostos pelo estabelecimento ao iniciar negociação.
     * Presentes apenas quando status === 'negotiating'.
     * Ao aceitar (negotiating → accepted), esses valores sobrescrevem
     * pricePerUnit e quantity como os termos oficiais do acordo.
     */
    negotiatingPrice?: number | null;
    negotiatingQuantity?: number | null;
    negotiatingNote?: string | null;
    negotiatingAt?: string | null;

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

export async function listOffersByProducer(producerUid: string): Promise<(DemandOffer & { demandUnit: string; demandProductName: string; demandMaxPricePerUnit: number | null })[]> {
    const snap = await offersCol()
        .where('producerUid', '==', producerUid)
        .orderBy('createdAt', 'desc')
        .get();

    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, { unit: string; productName: string; maxPricePerUnit: number | null }>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) {
            const data = doc.data()!;
            demandMap.set(did, {
                unit:             (data.unit            as string)         ?? 'unidade',
                productName:      (data.productName     as string)         ?? '',
                maxPricePerUnit:  (data.maxPricePerUnit as number | null)  ?? null,
            });
        }
    }));

    return snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        const info = demandMap.get(offer.demandId);
        return {
            ...offer,
            demandUnit:            info?.unit            ?? 'unidade',
            demandProductName:     info?.productName     ?? '',
            demandMaxPricePerUnit: info?.maxPricePerUnit ?? null,
        };
    });
}

/**
 * Lista todas as ofertas de um produtor que possuem histórico de chat relevante.
 * Inclui todos os status para que threads com mensagens não desapareçam após o desfecho.
 */
export async function listOffersWithChatByProducer(
    producerUid: string,
): Promise<(DemandOffer & { demandUnit: string })[]> {
    const snap = await offersCol()
        .where('producerUid', '==', producerUid)
        .orderBy('createdAt', 'desc')
        .get();
    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, string>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) demandMap.set(did, (doc.data()?.unit as string) ?? 'unidade');
    }));

    return snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        return { ...offer, demandUnit: demandMap.get(offer.demandId) ?? 'unidade' };
    });
}

/**
 * Lista ofertas ativas (pending + negotiating) de um produtor para chat-threads.
 */
export async function listActiveOffersByProducer(
    producerUid: string,
): Promise<(DemandOffer & { demandUnit: string })[]> {
    const snap = await offersCol()
        .where('producerUid', '==', producerUid)
        .where('status', 'in', ['pending', 'negotiating'])
        .orderBy('createdAt', 'desc')
        .get();
    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, string>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) demandMap.set(did, (doc.data()?.unit as string) ?? 'unidade');
    }));

    return snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        return { ...offer, demandUnit: demandMap.get(offer.demandId) ?? 'unidade' };
    });
}

export async function listOffersByEstablishment(establishmentUid: string): Promise<DemandOffer[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DemandOffer));
}

/**
 * Lista ofertas ativas (pending + negotiating) de um estabelecimento para chat-threads.
 */
export async function listActiveOffersByEstablishment(
    establishmentUid: string,
): Promise<(DemandOffer & { demandUnit: string })[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .where('status', 'in', ['pending', 'negotiating'])
        .orderBy('createdAt', 'desc')
        .get();
    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, string>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) demandMap.set(did, (doc.data()?.unit as string) ?? 'unidade');
    }));

    return snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        return { ...offer, demandUnit: demandMap.get(offer.demandId) ?? 'unidade' };
    });
}

/**
 * Lista todas as ofertas com histórico de chat de um estabelecimento.
 */
export async function listOffersWithChatByEstablishment(
    establishmentUid: string,
): Promise<(DemandOffer & { demandUnit: string })[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();
    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, string>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) demandMap.set(did, (doc.data()?.unit as string) ?? 'unidade');
    }));

    return snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        return { ...offer, demandUnit: demandMap.get(offer.demandId) ?? 'unidade' };
    });
}

/**
 * Lista todas as ofertas com status 'pending' ou 'negotiating' de um estabelecimento.
 * Retorna também o nome do produto da demanda para exibição na tela.
 */
export async function listPendingOffersByEstablishment(
    establishmentUid: string,
): Promise<(DemandOffer & { demandProductName: string; demandUnit: string })[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .where('status', 'in', ['pending', 'negotiating'])
        .orderBy('createdAt', 'asc')
        .get();

    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, { name: string; unit: string }>();

    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) {
            demandMap.set(did, {
                name: (doc.data()?.productName as string) ?? '',
                unit: (doc.data()?.unit as string) ?? 'unidade',
            });
        }
    }));

    const results = snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        const demandInfo = demandMap.get(offer.demandId);
        return {
            ...offer,
            demandProductName: demandInfo?.name ?? '',
            demandUnit:        demandInfo?.unit ?? 'unidade',
        };
    });

    // pending primeiro, depois negotiating; dentro de cada grupo: mais antigas primeiro
    const ORDER: Record<string, number> = { pending: 0, negotiating: 1, accepted: 2, rejected: 3, cancelled: 4 };
    results.sort((a, b) =>
        (ORDER[a.status] - ORDER[b.status]) ||
        a.createdAt.localeCompare(b.createdAt)
    );

    return results;
}

/**
 * Lista TODAS as ofertas de um estabelecimento (todos os status).
 * Ordem: pending → negotiating → accepted → rejected → cancelled; dentro de cada grupo: mais recentes primeiro.
 */
export async function listAllOffersByEstablishment(
    establishmentUid: string,
): Promise<(DemandOffer & { demandProductName: string; demandUnit: string })[]> {
    const snap = await offersCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();

    if (snap.empty) return [];

    const demandIds = [...new Set(snap.docs.map(d => d.data().demandId as string))];
    const demandMap = new Map<string, { name: string; unit: string }>();
    await Promise.all(demandIds.map(async (did) => {
        const doc = await db.collection('establishmentDemands').doc(did).get();
        if (doc.exists) demandMap.set(did, {
            name: (doc.data()?.productName as string) ?? '',
            unit: (doc.data()?.unit as string) ?? 'unidade',
        });
    }));

    const results = snap.docs.map(d => {
        const offer = { id: d.id, ...d.data() } as DemandOffer;
        const demandInfo = demandMap.get(offer.demandId);
        return {
            ...offer,
            demandProductName: demandInfo?.name ?? '',
            demandUnit:        demandInfo?.unit ?? 'unidade',
        };
    });

    const ORDER: Record<string, number> = { pending: 0, negotiating: 1, accepted: 2, rejected: 3, cancelled: 4 };
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

/**
 * Move a oferta para 'negotiating' e armazena os termos propostos pelo estabelecimento.
 * Os valores originais do produtor (pricePerUnit, quantity) são preservados.
 */
export async function negotiateOffer(
    offerId: string,
    negotiatingPrice: number,
    negotiatingQuantity: number,
    negotiatingNote: string | null,
): Promise<DemandOffer> {
    const now = new Date().toISOString();
    await offersCol().doc(offerId).update({
        status:             'negotiating',
        negotiatingPrice,
        negotiatingQuantity,
        negotiatingNote:    negotiatingNote ?? null,
        negotiatingAt:      now,
        updatedAt:          now,
    });
    const updated = await findOffer(offerId);
    if (!updated) throw new Error('Offer not found after update.');
    return updated;
}

/**
 * Produtor aceita os termos de negociação do estabelecimento.
 * Os valores propostos (negotiatingPrice, negotiatingQuantity) sobrescrevem
 * pricePerUnit e quantity como termos oficiais do acordo.
 */
export async function acceptNegotiation(offerId: string): Promise<DemandOffer> {
    const offer = await findOffer(offerId);
    if (!offer) throw new Error('Offer not found.');
    if (offer.status !== 'negotiating') throw new Error('Offer is not in negotiating status.');

    const now = new Date().toISOString();
    await offersCol().doc(offerId).update({
        status:       'accepted',
        pricePerUnit: offer.negotiatingPrice  ?? offer.pricePerUnit,
        quantity:     offer.negotiatingQuantity ?? offer.quantity,
        updatedAt:    now,
    });
    const updated = await findOffer(offerId);
    if (!updated) throw new Error('Offer not found after update.');
    return updated;
}

/**
 * Produtor resubmete uma oferta rejeitada com novos termos.
 * Reseta para 'pending', atualiza pricePerUnit/quantity/message
 * e limpa todos os campos de negociação anteriores.
 */
export async function resubmitOffer(
    offerId: string,
    data: DemandOfferInput,
): Promise<DemandOffer> {
    const now = new Date().toISOString();
    await offersCol().doc(offerId).update({
        status:              'pending',
        pricePerUnit:        data.pricePerUnit,
        quantity:            data.quantity,
        message:             data.message ?? null,
        negotiatingPrice:    null,
        negotiatingQuantity: null,
        negotiatingNote:     null,
        negotiatingAt:       null,
        updatedAt:           now,
    });
    const updated = await findOffer(offerId);
    if (!updated) throw new Error('Offer not found after resubmit.');
    return updated;
}

export async function cancelOfferByProducer(
    offerId: string,
    producerUid: string,
): Promise<void> {
    const offer = await findOffer(offerId);
    if (!offer)                            throw new Error('Offer not found.');
    if (offer.producerUid !== producerUid) throw new Error('Forbidden.');
    if (offer.status === 'accepted')       throw new Error('Cannot cancel an accepted offer.');
    await updateOfferStatus(offerId, 'cancelled');
}

/**
 * Agrega métricas de engajamento de uma demanda a partir das suas ofertas.
 */
export async function getDemandOfferStats(demandId: string): Promise<{
    offerCount: number;
    quantityOffered: number;
    quantityAccepted: number;
}> {
    const offers = await listOffersByDemand(demandId);
    const nonCancelled = offers.filter(o => o.status !== 'rejected' && o.status !== 'cancelled');
    return {
        offerCount:        offers.length,
        quantityOffered:   nonCancelled
            .filter(o => o.status === 'pending' || o.status === 'negotiating')
            .reduce((sum, o) => sum + o.quantity, 0),
        quantityAccepted:  nonCancelled
            .filter(o => o.status === 'accepted')
            .reduce((sum, o) => sum + o.quantity, 0),
    };
}
