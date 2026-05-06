/**
 * Modelo de Demanda de Estabelecimento (EstablishmentDemand).
 *
 * Coleção raiz no Firestore:
 *   establishmentDemands/{demandId}
 *
 * Escolha de coleção raiz (não subcoleção) para permitir:
 *   - Listagem pública de demandas abertas via marketplace
 *   - Filtros cruzados por status, categoria e localização sem collectionGroup
 *
 * Status:
 *   open        → publicada, aceitando ofertas
 *   negotiating → oferta aceita, combinando entrega (futuro)
 *   closed      → negócio encerrado
 *   cancelled   → cancelada pelo estabelecimento
 */

import { db } from '../config/firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DemandStatus = 'open' | 'negotiating' | 'closed' | 'cancelled';

export type DemandCategory =
    | 'hortalicas'
    | 'frutas'
    | 'graos'
    | 'laticinios'
    | 'carnes'
    | 'pescados'
    | 'processados'
    | 'extratos'
    | 'ervas'
    | 'bebidas'
    | 'outros';

export type DemandUnit = 'kg' | 'g' | 'ton' | 'L' | 'mL' | 'unidade' | 'caixa' | 'saco' | 'fardo';

/**
 * Local de entrega.
 * Campos coords e placeId são null no MVP — preenchidos em versões futuras
 * com GPS nativo (expo-location) e Google Places, respectivamente.
 */
export interface DeliveryLocation {
    displayName: string;
    city: string;
    state: string;
    coords: { latitude: number; longitude: number } | null;
    placeId: string | null;
}

export interface EstablishmentDemand {
    id: string;
    establishmentUid: string;
    establishmentName: string;
    productName: string;
    category: DemandCategory;
    quantityNeeded: number;
    unit: DemandUnit;
    /** Preço máximo por unidade — null se não informado */
    maxPricePerUnit: number | null;
    /**
     * true  → necessidade contínua; sem prazo; visível indefinidamente
     * false → compra pontual; some do marketplace após `deadline`
     */
    isRecurring: boolean;
    /** ISO date YYYY-MM-DD — obrigatório apenas quando isRecurring = false */
    deadline: string | null;
    deliveryLocation: DeliveryLocation;
    notes: string | null;
    status: DemandStatus;
    createdAt: string;
    updatedAt: string;
}

export type EstablishmentDemandInput = Omit<EstablishmentDemand,
    'id' | 'establishmentUid' | 'establishmentName' | 'status' | 'createdAt' | 'updatedAt'>;

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type RawInput = Record<string, unknown>;

const VALID_CATEGORIES: DemandCategory[] = [
    'hortalicas', 'frutas', 'graos', 'laticinios', 'carnes',
    'pescados', 'processados', 'extratos', 'ervas', 'bebidas', 'outros',
];

const VALID_UNITS: DemandUnit[] = ['kg', 'g', 'ton', 'L', 'mL', 'unidade', 'caixa', 'saco', 'fardo'];

export { VALID_CATEGORIES, VALID_UNITS };

const VALID_STATUSES: DemandStatus[] = ['open', 'negotiating', 'closed', 'cancelled'];

export function buildDemandInput(p: RawInput): EstablishmentDemandInput {
    const category: DemandCategory =
        VALID_CATEGORIES.includes(p.category as DemandCategory)
            ? (p.category as DemandCategory)
            : 'outros';

    const unit: DemandUnit =
        VALID_UNITS.includes(p.unit as DemandUnit)
            ? (p.unit as DemandUnit)
            : 'kg';

    const rawLoc = (p.deliveryLocation ?? {}) as RawInput;
    const deliveryLocation: DeliveryLocation = {
        displayName: ((rawLoc.displayName as string) || '').trim(),
        city:        ((rawLoc.city        as string) || '').trim(),
        state:       ((rawLoc.state       as string) || '').toUpperCase().slice(0, 2),
        coords:      null,
        placeId:     typeof rawLoc.placeId === 'string' ? rawLoc.placeId : null,
    };

    const isRecurring = p.isRecurring === true;

    return {
        productName:     ((p.productName as string) || '').trim(),
        category,
        quantityNeeded:  typeof p.quantityNeeded === 'number' && p.quantityNeeded > 0
                            ? p.quantityNeeded : 0,
        unit,
        maxPricePerUnit: typeof p.maxPricePerUnit === 'number' ? p.maxPricePerUnit : null,
        isRecurring,
        deadline:        isRecurring ? null : (typeof p.deadline === 'string' ? p.deadline : null),
        deliveryLocation,
        notes:           typeof p.notes === 'string' && p.notes.trim() ? p.notes.trim() : null,
    };
}

// ─── Coleção ──────────────────────────────────────────────────────────────────

function demandsCol() {
    return db.collection('establishmentDemands');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listDemandsByEstablishment(
    establishmentUid: string,
): Promise<EstablishmentDemand[]> {
    const snap = await demandsCol()
        .where('establishmentUid', '==', establishmentUid)
        .orderBy('createdAt', 'desc')
        .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EstablishmentDemand));
}

export async function listOpenDemands(): Promise<EstablishmentDemand[]> {
    // Recorrentes não têm deadline — buscadas separadamente e mescladas no topo
    const [recurringSnap, pontualSnap] = await Promise.all([
        demandsCol()
            .where('status', '==', 'open')
            .where('isRecurring', '==', true)
            .orderBy('createdAt', 'desc')
            .get(),
        demandsCol()
            .where('status', '==', 'open')
            .where('isRecurring', '==', false)
            .orderBy('deadline', 'asc')
            .get(),
    ]);
    const recurring = recurringSnap.docs.map(d => ({ id: d.id, ...d.data() } as EstablishmentDemand));
    const pontual   = pontualSnap.docs.map(d => ({ id: d.id, ...d.data() } as EstablishmentDemand));
    return [...recurring, ...pontual];
}

export async function findDemand(demandId: string): Promise<EstablishmentDemand | null> {
    const doc = await demandsCol().doc(demandId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as EstablishmentDemand;
}

export async function createDemand(
    establishmentUid: string,
    establishmentName: string,
    data: EstablishmentDemandInput,
): Promise<EstablishmentDemand> {
    const now = new Date().toISOString();
    const ref = demandsCol().doc();
    const demand: EstablishmentDemand = {
        id: ref.id,
        establishmentUid,
        establishmentName,
        ...data,
        status: 'open',
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(demand);
    return demand;
}

export async function updateDemand(
    establishmentUid: string,
    demandId: string,
    data: Partial<EstablishmentDemandInput>,
): Promise<EstablishmentDemand> {
    const now = new Date().toISOString();
    const ref = demandsCol().doc(demandId);

    // Garante que apenas o dono pode atualizar (verificado também no controller)
    const existing = await findDemand(demandId);
    if (!existing) throw new Error('Demand not found.');
    if (existing.establishmentUid !== establishmentUid) throw new Error('Forbidden.');
    if (existing.status !== 'open') throw new Error('Only open demands can be edited.');

    await ref.update({ ...data, updatedAt: now });
    const updated = await findDemand(demandId);
    if (!updated) throw new Error('Demand not found after update.');
    return updated;
}

export async function cancelDemand(
    establishmentUid: string,
    demandId: string,
): Promise<void> {
    const existing = await findDemand(demandId);
    if (!existing) throw new Error('Demand not found.');
    if (existing.establishmentUid !== establishmentUid) throw new Error('Forbidden.');
    if (existing.status === 'closed' || existing.status === 'cancelled') throw new Error('Cannot cancel a closed demand.');

    await demandsCol().doc(demandId).update({
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
    });
}

export async function updateDemandStatus(
    demandId: string,
    status: DemandStatus,
): Promise<void> {
    if (!VALID_STATUSES.includes(status)) throw new Error('Invalid status.');
    await demandsCol().doc(demandId).update({ status, updatedAt: new Date().toISOString() });
}
