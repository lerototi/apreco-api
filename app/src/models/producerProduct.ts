/**
 * Modelo de Produto do Produtor Rural (ProducerProduct).
 *
 * Subcoleção no Firestore:
 *   ruralProducers/{producerUid}/products/{productId}
 *
 * Subcategorias:
 *  - fresh:     Fresco / in natura
 *  - processed: Beneficiado / processado
 *  - extract:   Extrações (mel, óleos etc.)
 *  - cosmetic:  Cosmético natural
 */

import { db } from '../config/firebase';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type ProductSubcategory = 'fresh' | 'processed' | 'extract' | 'cosmetic';

export interface ProducerProduct {
  id: string;
  /** Nome do produto (ex: Tomate Cereja Orgânico) */
  name: string;
  /** Descrição do produto: variedade, forma de cultivo, uso, etc. */
  description: string | null;
  /** Subcategoria do produto */
  subcategory: ProductSubcategory;
  /**
   * Produto permanente: sempre presente na cartela do produtor.
   * Quando true, publishedUntil é ignorado.
   */
  permanent: boolean;
  /**
   * Produto sazonal: disponível apenas por uma temporada.
   * Quando true, publishedUntil deve ser fornecido.
   */
  seasonal: boolean;
  /**
   * Data de expiração da publicação (ISO 8601).
   * Obrigatório quando seasonal=true e permanent=false.
   * null quando permanent=true.
   */
  publishedUntil: string | null;
  /** Preço em reais. null se negociável ou não informado. */
  price: number | null;
  /**
   * Quantidade que corresponde ao preço informado.
   * Ex: price=8.50, quantity=1, unit='kg' → R$ 8,50 por 1 kg.
   * null quando price é null.
   */
  quantity: number | null;
  /** Unidade de medida (ex: kg, unidade, dúzia, litro) */
  unit: string | null;
  /**
   * URLs das fotos do produto.
   * Por enquanto URLs externas; futuramente upload para Firebase Storage.
   */
  photos: string[];
  /** O produtor aceita trocas por este produto */
  acceptsTrade: boolean;
  /** Produto ativo/visível no marketplace */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProducerProductInput = Omit<ProducerProduct, 'id' | 'createdAt' | 'updatedAt'>;

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type RawInput = Record<string, unknown>;

const VALID_SUBCATEGORIES: ProductSubcategory[] = ['fresh', 'processed', 'extract', 'cosmetic'];

export function buildProducerProduct(p: RawInput): ProducerProductInput {
  const permanent = typeof p.permanent === 'boolean' ? p.permanent : false;
  const seasonal  = typeof p.seasonal  === 'boolean' ? p.seasonal  : false;
  const subcategory: ProductSubcategory =
    VALID_SUBCATEGORIES.includes(p.subcategory as ProductSubcategory)
      ? (p.subcategory as ProductSubcategory)
      : 'fresh';

  return {
    name:          ((p.name as string) || '').trim(),
    description:   (p.description as string) || null,
    subcategory,
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

function productsCol(producerUid: string) {
  return db.collection('ruralProducers').doc(producerUid).collection('products');
}

export async function listProducerProducts(producerUid: string): Promise<ProducerProduct[]> {
  const snap = await productsCol(producerUid).orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProducerProduct));
}

/**
 * Lista todos os produtos ativos de todos os produtores (marketplace público).
 * Usa collectionGroup para varrer ruralProducers/{uid}/products em paralelo.
 * Cada produto recebe o campo `producerUid` extraído do path do documento.
 */
export async function listAllActiveProducts(): Promise<(ProducerProduct & { producerUid: string })[]> {
  const snap = await db
    .collectionGroup('products')
    .where('active', '==', true)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(d => {
    // path: ruralProducers/{producerUid}/products/{productId}
    const producerUid = d.ref.parent.parent?.id ?? '';
    return { id: d.id, producerUid, ...d.data() } as ProducerProduct & { producerUid: string };
  });
}

export async function findProducerProduct(
  producerUid: string,
  productId: string,
): Promise<ProducerProduct | null> {
  const doc = await productsCol(producerUid).doc(productId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ProducerProduct;
}

export async function createProducerProduct(
  producerUid: string,
  data: ProducerProductInput,
): Promise<ProducerProduct> {
  const now = new Date().toISOString();
  const ref = productsCol(producerUid).doc();
  const product: ProducerProduct = { id: ref.id, ...data, createdAt: now, updatedAt: now };
  await ref.set(product);
  return product;
}

export async function updateProducerProduct(
  producerUid: string,
  productId: string,
  data: Partial<ProducerProductInput>,
): Promise<ProducerProduct> {
  const now = new Date().toISOString();
  await productsCol(producerUid).doc(productId).update({ ...data, updatedAt: now });
  const updated = await findProducerProduct(producerUid, productId);
  if (!updated) throw new Error('Product not found after update.');
  return updated;
}

export async function deleteProducerProduct(producerUid: string, productId: string): Promise<void> {
  await productsCol(producerUid).doc(productId).delete();
}
