/**
 * Modelo de Entrega (Delivery).
 *
 * Coleção raiz no Firestore:
 *   deliveries/{deliveryId}
 *
 * Criada automaticamente quando uma oferta é aceita (status → accepted).
 * A entrega une os dois lados: produtor (quem envia) e estabelecimento (quem recebe).
 *
 * Ciclo de vida:
 *   pending      → oferta aceita; produtor agenda a entrega (scheduledDeliveryAt)
 *   shipped      → produtor marcou "saí para entregar" (opcional)
 *   delivered    → estabelecimento confirmou o recebimento (encerra o ciclo)
 *   disputed     → estabelecimento abriu disputa (quantidade, qualidade, etc.)
 *   cancelled    → entrega cancelada após aceite
 */

import { db } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DeliveryStatus = 'pending' | 'shipped' | 'delivered' | 'disputed' | 'cancelled';

export interface Delivery {
    id: string;

    /** Referência à oferta que gerou a entrega */
    offerId: string;
    /** Referência à demanda original */
    demandId: string;

    /** UID do produtor (quem entrega) — desnormalizado da oferta */
    producerUid: string;
    /** Nome do produtor (snapshot) */
    producerName: string;

    /** UID do estabelecimento (quem recebe) — desnormalizado da oferta */
    establishmentUid: string;
    /** Nome do estabelecimento (snapshot no momento do aceite) */
    establishmentName: string | null;

    /** Nome do produto (snapshot da demanda) */
    productName: string;
    /** Quantidade acordada */
    quantity: number;
    /** Unidade da quantidade */
    unit: string;
    /** Preço por unidade acordado */
    pricePerUnit: number;

    status: DeliveryStatus;

    /**
     * Data e hora prevista para a entrega, informada pelo produtor ao agendar.
     * Formato ISO 8601. Obrigatório antes de abrir a tela de detalhe da entrega.
     * Não pode ser alterado após ser salvo.
     */
    scheduledDeliveryAt: string | null;
    /** Observações gerais do produtor (ex: "Estarei lá às 14h, peço confirmar") */
    shippingNote: string | null;
    /** Timestamp de quando o produtor marcou como "saí para entregar" (opcional) */
    shippedAt: string | null;

    /**
     * Preenchido pelo estabelecimento ao confirmar ou disputar.
     * Quantidade efetivamente recebida (pode diferir do acordado em caso de disputa).
     */
    receivedQuantity: number | null;
    /** Nota do estabelecimento ao confirmar/disputar */
    receptionNote: string | null;
    /** Timestamp de quando o estabelecimento confirmou ou abriu disputa */
    confirmedAt: string | null;

    createdAt: string;
    updatedAt: string;
}

// ─── Sanitização de inputs ────────────────────────────────────────────────────

type RawInput = Record<string, unknown>;

export interface ScheduleDeliveryInput {
    scheduledDeliveryAt: string;
    shippingNote: string | null;
}

export interface ShipDeliveryInput {
    scheduledDeliveryAt?: string | null;
    shippingNote?: string | null;
}

export interface ConfirmDeliveryInput {
    receivedQuantity: number;
    receptionNote: string | null;
}

export interface DisputeDeliveryInput {
    receivedQuantity: number;
    receptionNote: string;
}

export function buildScheduleInput(p: RawInput): ScheduleDeliveryInput | null {
    const scheduled =
        typeof p.scheduledDeliveryAt === 'string' && p.scheduledDeliveryAt.trim()
            ? p.scheduledDeliveryAt.trim()
            : null;
    if (!scheduled) return null;
    return {
        scheduledDeliveryAt: scheduled,
        shippingNote:
            typeof p.shippingNote === 'string' && p.shippingNote.trim()
                ? p.shippingNote.trim()
                : null,
    };
}

export function buildShipInput(p: RawInput): ShipDeliveryInput {
    return {
        scheduledDeliveryAt:
            typeof p.scheduledDeliveryAt === 'string' && p.scheduledDeliveryAt.trim()
                ? p.scheduledDeliveryAt.trim()
                : null,
        shippingNote:
            typeof p.shippingNote === 'string' && p.shippingNote.trim()
                ? p.shippingNote.trim()
                : null,
    };
}

export function buildConfirmInput(p: RawInput): ConfirmDeliveryInput | null {
    const qty = typeof p.receivedQuantity === 'number' ? p.receivedQuantity : NaN;
    if (isNaN(qty) || qty < 0) return null;
    return {
        receivedQuantity: qty,
        receptionNote:
            typeof p.receptionNote === 'string' && p.receptionNote.trim()
                ? p.receptionNote.trim()
                : null,
    };
}

export function buildDisputeInput(p: RawInput): DisputeDeliveryInput | null {
    const qty = typeof p.receivedQuantity === 'number' ? p.receivedQuantity : NaN;
    const note =
        typeof p.receptionNote === 'string' && p.receptionNote.trim()
            ? p.receptionNote.trim()
            : null;
    if (isNaN(qty) || qty < 0) return null;
    if (!note) return null;
    return { receivedQuantity: qty, receptionNote: note };
}

// ─── Coleção ──────────────────────────────────────────────────────────────────

function deliveriesCol() {
    return db.collection('deliveries');
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function findDelivery(deliveryId: string): Promise<Delivery | null> {
    const doc = await deliveriesCol().doc(deliveryId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Delivery;
}

export async function findDeliveryByOffer(offerId: string): Promise<Delivery | null> {
    const snap = await deliveriesCol()
        .where('offerId', '==', offerId)
        .limit(1)
        .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as Delivery;
}

export async function listDeliveriesByProducer(producerUid: string): Promise<Delivery[]> {
    const snap = await deliveriesCol()
        .where('producerUid', '==', producerUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Delivery));
}

export async function listDeliveriesByEstablishment(establishmentUid: string): Promise<Delivery[]> {
    const snap = await deliveriesCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Delivery));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateDeliveryParams {
    offerId: string;
    demandId: string;
    producerUid: string;
    producerName: string;
    establishmentUid: string;
    establishmentName: string | null;
    productName: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
}

export async function createDelivery(params: CreateDeliveryParams): Promise<Delivery> {
    const now = new Date().toISOString();
    const ref = deliveriesCol().doc();
    const delivery: Delivery = {
        id: ref.id,
        ...params,
        status: 'pending',
        scheduledDeliveryAt: null,
        shippingNote: null,
        shippedAt: null,
        receivedQuantity: null,
        receptionNote: null,
        confirmedAt: null,
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(delivery);
    return delivery;
}

/**
 * Produtor agenda a entrega: salva scheduledDeliveryAt e shippingNote.
 * Status permanece 'pending'. Só pode ser feito uma vez (campo fixo após salvo).
 */
export async function scheduleDelivery(
    deliveryId: string,
    input: ScheduleDeliveryInput,
): Promise<Delivery> {
    const now = new Date().toISOString();
    await deliveriesCol().doc(deliveryId).update({
        scheduledDeliveryAt: input.scheduledDeliveryAt,
        shippingNote:        input.shippingNote,
        updatedAt:           now,
    });
    const updated = await findDelivery(deliveryId);
    if (!updated) throw new Error('Delivery not found after update.');
    return updated;
}

/**
 * Produtor marca a entrega como "saí para entregar" (pending → shipped). Opcional.
 */
export async function markDeliveryShipped(
    deliveryId: string,
    input: ShipDeliveryInput,
): Promise<Delivery> {
    const now = new Date().toISOString();
    await deliveriesCol().doc(deliveryId).update({
        status:              'shipped',
        scheduledDeliveryAt: input.scheduledDeliveryAt ?? null,
        shippingNote:        input.shippingNote ?? null,
        shippedAt:           now,
        updatedAt:           now,
    });
    const updated = await findDelivery(deliveryId);
    if (!updated) throw new Error('Delivery not found after update.');
    return updated;
}

/**
 * Estabelecimento confirma o recebimento (shipped → delivered).
 */
export async function confirmDelivery(
    deliveryId: string,
    input: ConfirmDeliveryInput,
): Promise<Delivery> {
    const now = new Date().toISOString();
    await deliveriesCol().doc(deliveryId).update({
        status:           'delivered',
        receivedQuantity: input.receivedQuantity,
        receptionNote:    input.receptionNote,
        confirmedAt:      now,
        updatedAt:        now,
    });
    const updated = await findDelivery(deliveryId);
    if (!updated) throw new Error('Delivery not found after update.');
    return updated;
}

/**
 * Estabelecimento abre disputa (shipped → disputed).
 */
export async function disputeDelivery(
    deliveryId: string,
    input: DisputeDeliveryInput,
): Promise<Delivery> {
    const now = new Date().toISOString();
    await deliveriesCol().doc(deliveryId).update({
        status:           'disputed',
        receivedQuantity: input.receivedQuantity,
        receptionNote:    input.receptionNote,
        confirmedAt:      now,
        updatedAt:        now,
    });
    const updated = await findDelivery(deliveryId);
    if (!updated) throw new Error('Delivery not found after update.');
    return updated;
}

/**
 * Cancela a entrega. Permitido enquanto status for pending ou disputed.
 * Pode ser invocado por qualquer das partes (controle de autorização no controller).
 */
export async function cancelDelivery(deliveryId: string): Promise<Delivery> {
    const now = new Date().toISOString();
    await deliveriesCol().doc(deliveryId).update({
        status:    'cancelled',
        updatedAt: now,
    });
    const updated = await findDelivery(deliveryId);
    if (!updated) throw new Error('Delivery not found after update.');
    return updated;
}
