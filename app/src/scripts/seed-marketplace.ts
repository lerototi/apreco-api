/**
 * seed-marketplace.ts
 *
 * Gera massa de dados agroecológicos no Firestore:
 *  - 3 produtores rurais fictícios (com perfil completo)
 *  - 25 produtos distribuídos entre as 4 subcategorias
 *
 * Execução:
 *   npx ts-node -r dotenv/config --project tsconfig.json src/scripts/seed-marketplace.ts
 *
 * (ou compilar e rodar: npx tsc && node lib/scripts/seed-marketplace.js)
 */

// Carrega .env antes de qualquer import que precise das vars
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

import { db } from '../config/firebase';
import type { RuralProducerProfile } from '../models/profiles/ruralProducer';
import type { ProducerProduct }      from '../models/producerProduct';

// ─── Imagens — Pexels CDN (sem autenticação, sem bloqueio por User-Agent) ─────
// Formato: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?w=640
// Todos os IDs foram validados com HTTP HEAD 200.

function px(id: number): string[] {
  return [`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?w=640`];
}

const IMG: Record<string, string[]> = {
  tomato:       px(533360),
  leafy:        px(1327838),
  carrot:       px(143133),
  corn:         px(1022867),
  pumpkin:      px(1640770),
  banana:       px(1093038),
  mango:        px(918643),
  herb:         px(1638280),
  honey:        px(4109714),
  jam:          px(1028714),
  cassava:      px(6157063),
  oil:          px(725998),
  tincture:     px(3994840),
  soap:         px(4465124),
  cream:        px(3997990),
  coffee:       px(312418),
  beans:        px(4110251),
  sweet_potato: px(8601689),
  garlic:       px(4197445),
  eggplant:     px(3669638),
  pepper:       px(594137),
  lettuce:      px(2325843),
  okra:         px(7421023),
};

// ─── Produtores ───────────────────────────────────────────────────────────────

interface SeedProducer {
  uid: string;
  profile: RuralProducerProfile;
}

const PRODUCERS: SeedProducer[] = [
  {
    uid: 'seed_producer_001',
    profile: {
      displayName: 'Sítio Raízes Vivas',
      userName: 'sitio_raizes_vivas',
      avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png',
      bio: 'Família agricultora da região serrana há 3 gerações. Cultivamos em sistema agroflorestal, respeitando os ciclos naturais e o solo vivo. Trabalhamos com transição agroecológica certificada pelo IBD.',
      phone: '+5511999990001',
      isWhatsApp: true,
      instagram: 'sitio_raizes_vivas',
      website: null,
      organic: true,
      certifications: ['IBD Orgânico', 'SisOrg'],
      deliveryOptions: ['Feira livre (sábados)', 'Entrega a domicílio (até 20 km)', 'Retirada no sítio'],
    },
  },
  {
    uid: 'seed_producer_002',
    profile: {
      displayName: 'Horta Comunitária Ipê',
      userName: 'horta_ipe',
      avatarUrl: null,
      bio: 'Produção coletiva de hortaliças e ervas medicinais em área urbana periférica. Sem agrotóxicos, com compostagem local e captação de água da chuva.',
      phone: '+5511999990002',
      isWhatsApp: false,
      instagram: 'hortaipe',
      website: null,
      organic: true,
      certifications: ['Orgânico Participativo (OCS)'],
      deliveryOptions: ['Feira (terças e sextas)', 'Cestas mensais (assinatura)'],
    },
  },
  {
    uid: 'seed_producer_003',
    profile: {
      displayName: 'Apicultura & Ervas Serra Azul',
      userName: 'serra_azul_apicultura',
      avatarUrl: null,
      bio: 'Mel artesanal, tinturas, sabonetes e cosméticos naturais produzidos na Mata Atlântica. Apicultura sem agrotóxicos, colmeia racional, extrativismo responsável.',
      phone: '+5511999990003',
      isWhatsApp: true,
      instagram: 'serraaazul_mel',
      website: 'https://serraaazul.com.br',
      organic: false,
      certifications: ['Boas Práticas Apícolas (MAPA)'],
      deliveryOptions: ['Correios (todo o Brasil)', 'Retirada na propriedade', 'Feiras regionais'],
    },
  },
];

// ─── Produtos ─────────────────────────────────────────────────────────────────

type ProductSeed = Omit<ProducerProduct, 'id' | 'createdAt' | 'updatedAt'> & { producerUid: string };

const now = new Date().toISOString();

const PRODUCTS: ProductSeed[] = [
  // ── Sítio Raízes Vivas (fresh & processed) ──────────────────────────────────
  {
    producerUid: 'seed_producer_001',
    name: 'Tomate Cereja Orgânico',
    description: 'Cultivado em sistema agroflorestal, sem agrotóxicos. Sabor adocicado e acidez equilibrada, ideal para saladas, massas e antepastos. Colhido maduro na planta.',
    subcategory: 'fresh',
    permanent: false, seasonal: true, publishedUntil: '2025-04-30',
    price: 9.50, quantity: 500, unit: 'g',
    photos: IMG.tomato,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Cenoura Baby Orgânica',
    description: 'Variedade baby, colhida nova para textura macia e sabor delicado. Ótima para sucos, refogados e consumo in natura. Produção sem defensivos químicos.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 7.00, quantity: 500, unit: 'g',
    photos: IMG.carrot,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Milho Verde Crioulo',
    description: 'Variedade crioula preservada há décadas pela nossa família. Milho dulce e macio, sem modificação genética. Colhido fresco e disponível de dez a fev.',
    subcategory: 'fresh',
    permanent: false, seasonal: true, publishedUntil: '2025-02-28',
    price: 3.00, quantity: 2, unit: 'espigas',
    photos: IMG.corn,
    acceptsTrade: true, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Abóbora Moranga Cabotiá',
    description: 'Moranga de casca dura, polpa alaranjada e adocicada. Excelente para sopas, assados e purês. Cultivada em rotação de cultura com adubação verde.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 12.00, quantity: 1, unit: 'kg',
    photos: IMG.pumpkin,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Banana Prata Agroecológica',
    description: 'Banana prata madura no pé, sem adubação química. Polpa cremosa e doce, ótima para mesa, vitaminas e sobremesas. Entregue em pencas.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 8.00, quantity: 1, unit: 'kg',
    photos: IMG.banana,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Farinha de Mandioca Agroecológica',
    description: 'Farinha de mandioca torrada artesanalmente. Grão médio, crocante e seca. Mandioca cultivada sem agrotóxicos na nossa área de roçado em SAF.',
    subcategory: 'processed',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 11.00, quantity: 1, unit: 'kg',
    photos: IMG.cassava,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Feijão Carioca Agroecológico',
    description: 'Feijão carioca da nossa lavoura, sem veneno. Grão uniforme, cozimento rápido. Cultivado em consórcio com milho crioulo — manejo tradicional.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 14.00, quantity: 1, unit: 'kg',
    photos: IMG.beans,
    acceptsTrade: true, active: true,
  },
  {
    producerUid: 'seed_producer_001',
    name: 'Alho Nacional Orgânico',
    description: 'Alho branco de cabeça graúda, produzido sem fungicidas ou pesticidas. Aroma intenso e persistente. Excelente conservação pós-colheita.',
    subcategory: 'fresh',
    permanent: false, seasonal: true, publishedUntil: '2025-09-30',
    price: 25.00, quantity: 500, unit: 'g',
    photos: IMG.garlic,
    acceptsTrade: false, active: true,
  },

  // ── Horta Comunitária Ipê (fresh & processed) ────────────────────────────────
  {
    producerUid: 'seed_producer_002',
    name: 'Mix de Folhosas Orgânicas',
    description: 'Cesta semanal com rúcula, almeirão, chicória e couve-manteiga. Colhidas na manhã da entrega. Sem agrotóxicos, adubação com composto orgânico local.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 12.00, quantity: 1, unit: 'cesta',
    photos: IMG.leafy,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Alface Crespa Orgânica',
    description: 'Alface crespa verde, colhida no dia. Folhas tenras e crocantes. Produção em canteiros com cobertura morta (mulching) e irrigação por gotejamento.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 4.00, quantity: 1, unit: 'pé',
    photos: IMG.lettuce,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Batata-Doce Laranja',
    description: 'Batata-doce de polpa laranja, rica em betacaroteno. Cultivada sem agrotóxico, ideal para assados, purês e vitaminas. Colheita artesanal.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 6.50, quantity: 1, unit: 'kg',
    photos: IMG.sweet_potato,
    acceptsTrade: true, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Berinjela Comprida Orgânica',
    description: 'Berinjela comprida tipo japonesa, casca roxa brilhante, polpa macia. Excelente para grelhados, patês e conservas. Colhida nova para menos amargor.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 8.00, quantity: 1, unit: 'kg',
    photos: IMG.eggplant,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Pimentão Colorido Orgânico',
    description: 'Mix de pimentões vermelho, amarelo e verde, colhidos maduros. Doces e crocantes. Cultivados sem veneno, adubados com biofertilizante foliante.',
    subcategory: 'fresh',
    permanent: false, seasonal: true, publishedUntil: '2025-05-31',
    price: 10.00, quantity: 500, unit: 'g',
    photos: IMG.pepper,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Quiabo Orgânico',
    description: 'Quiabo jovem e tenro, colhido quando ainda pequeno para evitar o endurecimento. Ótimo para ensopados, grelha e mucilagem natural em pratos regionais.',
    subcategory: 'fresh',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 7.50, quantity: 500, unit: 'g',
    photos: IMG.okra,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Geleia de Maracujá Artesanal',
    description: 'Geleia de maracujá com baixo teor de açúcar, feita com fruta da horta comunitária. Sem conservantes. Casca esterilizada com vapor, lacrada com selo de qualidade.',
    subcategory: 'processed',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 18.00, quantity: 250, unit: 'g',
    photos: IMG.jam,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_002',
    name: 'Chá de Ervas Medicinais (Mix)',
    description: 'Blend de camomila, melissa e hortelã cultivadas na horta. Secagem à sombra para preservar óleos essenciais. Sem aditivos ou conservantes.',
    subcategory: 'processed',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 14.00, quantity: 50, unit: 'g',
    photos: IMG.herb,
    acceptsTrade: false, active: true,
  },

  // ── Serra Azul (extract & cosmetic) ─────────────────────────────────────────
  {
    producerUid: 'seed_producer_003',
    name: 'Mel Silvestre Puro — Serra Atlântica',
    description: 'Mel extraído de floradas nativas da Mata Atlântica (eucalipto, laranjeira e mata ciliar). Não pasteurizado, não filtrado. Rico em enzimas e polifenóis naturais.',
    subcategory: 'extract',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 35.00, quantity: 500, unit: 'g',
    photos: IMG.honey,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_003',
    name: 'Própolis Verde Extrato Alcoólico 30%',
    description: 'Extrato de própolis verde coletado de abelhas africanizadas em zona de transição de Mata Atlântica. Concentração 30%, sem adição de corantes ou aromas.',
    subcategory: 'extract',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 42.00, quantity: 30, unit: 'ml',
    photos: IMG.tincture,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_003',
    name: 'Óleo de Coco Extra Virgem Artesanal',
    description: 'Prensado a frio de cocos frescos, sem aquecimento ou solventes. Sabor suave e aroma característico. Uso culinário e cosmético. Produção em microescala.',
    subcategory: 'extract',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 38.00, quantity: 200, unit: 'ml',
    photos: IMG.oil,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_003',
    name: 'Sabonete de Mel e Própolis',
    description: 'Sabonete artesanal em barra com mel silvestre e extrato de própolis verde. Saponificação a frio, com óleo de coco, de palma sustentável e manteiga de karité. Sem SLS.',
    subcategory: 'cosmetic',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 22.00, quantity: 90, unit: 'g',
    photos: IMG.soap,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_003',
    name: 'Creme Hidratante de Babosa e Mel',
    description: 'Hidratante corporal com gel de aloe vera cultivada organicamente e mel silvestre. Textura leve, absorção rápida, sem parabenos ou petrolatos.',
    subcategory: 'cosmetic',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 48.00, quantity: 120, unit: 'ml',
    photos: IMG.cream,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_003',
    name: 'Café Agroflorestal Torrado Artesanal',
    description: 'Café arábica cultivado à sombra de bananeiras e ingás em sistema agroflorestal. Torra média, notas de caramelo e frutas vermelhas. Moído na hora do pedido.',
    subcategory: 'processed',
    permanent: true, seasonal: false, publishedUntil: null,
    price: 52.00, quantity: 250, unit: 'g',
    photos: IMG.coffee,
    acceptsTrade: false, active: true,
  },
  {
    producerUid: 'seed_producer_003',
    name: 'Manga Palmer Orgânica',
    description: 'Manga palmer de árvore adulta em sistema agroflorestal. Polpa firme, fibrosa, sabor intenso e pouco ácido. Colhida madura no pé, sem carbeto.',
    subcategory: 'fresh',
    permanent: false, seasonal: true, publishedUntil: '2025-02-15',
    price: 6.00, quantity: 1, unit: 'unidade',
    photos: IMG.mango,
    acceptsTrade: false, active: true,
  },
];

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Iniciando seed do marketplace...\n');

  // ── Produtores ──────────────────────────────────────────────────────────────
  console.log(`📋 Inserindo ${PRODUCERS.length} produtores...`);
  for (const { uid, profile } of PRODUCERS) {
    await db.collection('ruralProducers').doc(uid).set(profile);
    console.log(`  ✓ ${profile.displayName} (${uid})`);
  }

  // ── Produtos ────────────────────────────────────────────────────────────────
  console.log(`\n🛒 Inserindo ${PRODUCTS.length} produtos...`);
  for (const { producerUid, ...productData } of PRODUCTS) {
    const ref  = db.collection('ruralProducers').doc(producerUid).collection('products').doc();
    const product: ProducerProduct = {
      id: ref.id,
      ...productData,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(product);
    console.log(`  ✓ [${productData.subcategory.padEnd(9)}] ${productData.name}`);
  }

  const perProducer = PRODUCTS.reduce<Record<string, number>>((acc, p) => {
    acc[p.producerUid] = (acc[p.producerUid] ?? 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Resumo:');
  for (const { uid, profile } of PRODUCERS) {
    console.log(`  ${profile.displayName}: ${perProducer[uid] ?? 0} produtos`);
  }
  console.log(`\n✅ Seed concluído — ${PRODUCTS.length} produtos e ${PRODUCERS.length} produtores gravados.\n`);
}

seed().catch(err => {
  console.error('\n❌ Seed falhou:', err);
  process.exit(1);
});
