/**
 * Modelo de Insumo do Produtor Rural (ProducerInput).
 *
 * Subcoleção no Firestore:
 *   ruralProducers/{producerUid}/inputs/{inputId}
 *
 * Subcategorias:
 *  - seeds:        Sementes
 *  - seedlings:    Mudas
 *  - fertilizer:   Adubos e biofertilizantes
 *  - biodefensive: Biodefensivos
 *  - equipment:    Equipamentos para produção (permanente por padrão, sem sazonal)
 */

import { db } from '../config/firebase';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type InputSubcategory = 'seeds' | 'seedlings' | 'fertilizer' | 'biodefensive' | 'equipment';

export interface ProducerInput {
  id: string;
  /** Nome do insumo (ex: Semente de Alface Americana) */
  name: string;
  /** Descrição: origem, uso recomendado, composição etc. */
  description: string | null;
  /** Subcategoria do insumo */
  subcategory: InputSubcategory;
  /**
   * Variedade — relevante principalmente para seeds e seedlings.
   * null para outras subcategorias.
   */
  variety: string | null;
  /**
   * Insumo permanente na cartela do produtor.
   * equipment é sempre permanente (forçado pelo buildProducerInput).
   */
  permanent: boolean;
  /**
   * Insumo sazonal.
   * Não se aplica a equipment (forçado false pelo buildProducerInput).
   */
  seasonal: boolean;
  /**
   * Data de expiração da publicação (ISO 8601).
   * null quando permanent=true ou subcategory=equipment.
   */
  publishedUntil: string | null;
  /** Preço em reais. null se negociável. */
  price: number | null;
  /**
   * Quantidade que corresponde ao preço informado.
   * Ex: price=15.00, quantity=500, unit='g' → R$ 15,00 por 500 g.
   * null quando price é null.
   */
  quantity: number | null;
  /** Unidade de medida */
  unit: string | null;
  /** URLs das fotos do insumo. */
  photos: string[];
  /** O produtor aceita trocas por este insumo */
  acceptsTrade: boolean;
  /** Insumo ativo/visível no marketplace */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProducerInputData = Omit<ProducerInput, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type RawInput = Record<string, unknown>;

const VALID_SUBCATEGORIES: InputSubcategory[] = [
  'seeds', 'seedlings', 'fertilizer', 'biodefensive', 'equipment',
];

export function buildProducerInput(p: RawInput): ProducerInputData {
  const subcategory: InputSubcategory =
    VALID_SUBCATEGORIES.includes(p.subcategory as InputSubcategory)
      ? (p.subcategory as InputSubcategory)
      : 'seeds';

  const isEquipment = subcategory === 'equipment';
  // Equipamentos são sempre permanentes e nunca sazonais
  const permanent = isEquipment ? true : (typeof p.permanent === 'boolean' ? p.permanent : false);
  const seasonal  = isEquipment ? false : (typeof p.seasonal  === 'boolean' ? p.seasonal  : false);

  return {
    name:          ((p.name as string) || '').trim(),
    description:   (p.description as string) || null,
    subcategory,
    variety:       (p.variety as string) || null,
    permanent,
    seasonal,
    publishedUntil: permanent ? null : ((p.publishedUntil as string) || null),
    price:         typeof p.price === 'number' ? p.price : null,
    quantity:      typeof p.quantity === 'number' ? p.quantity : null,
    unit:          (p.unit as string) || null,
    photos:        Array.isArray(p.photos) ? (p.photos as string[]).filter(Boolean) : [],
    acceptsTrade:  typeof p.acceptsTrade === 'boolean' ? p.acceptsTrade : false,
    active:        typeof p.active === 'boolean' ? p.active : true,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function inputsCol(producerUid: string) {
  return db.collection('ruralProducers').doc(producerUid).collection('inputs');
}

export async function listProducerInputs(producerUid: string): Promise<ProducerInput[]> {
  const snap = await inputsCol(producerUid).orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProducerInput));
}

export async function findProducerInput(
  producerUid: string,
  inputId: string,
): Promise<ProducerInput | null> {
  const doc = await inputsCol(producerUid).doc(inputId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ProducerInput;
}

export async function createProducerInput(
  producerUid: string,
  data: ProducerInputData,
): Promise<ProducerInput> {
  const now = new Date().toISOString();
  const ref = inputsCol(producerUid).doc();
  const input: ProducerInput = { id: ref.id, ...data, createdAt: now, updatedAt: now };
  await ref.set(input);
  return input;
}

export async function updateProducerInput(
  producerUid: string,
  inputId: string,
  data: Partial<ProducerInputData>,
): Promise<ProducerInput> {
  const now = new Date().toISOString();
  await inputsCol(producerUid).doc(inputId).update({ ...data, updatedAt: now });
  const updated = await findProducerInput(producerUid, inputId);
  if (!updated) throw new Error('Input not found after update.');
  return updated;
}

export async function deleteProducerInput(producerUid: string, inputId: string): Promise<void> {
  await inputsCol(producerUid).doc(inputId).delete();
}
