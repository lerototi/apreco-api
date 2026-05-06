/**
 * seed-demands.ts
 *
 * Gera massa de dados realista no Firestore:
 *   - 3 estabelecimentos fictícios (com perfil completo)
 *   - 12 demandas de insumos distribuídas entre eles
 *   - 20 ofertas de produtores para essas demandas
 *     (com vários status: pending, accepted, rejected, confirmed, cancelled)
 *
 * Execução:
 *   npx ts-node -r dotenv/config --project tsconfig.json src/scripts/seed-demands.ts
 *
 * Pré-requisito: seed-marketplace.ts já executado
 *   (usa seed_producer_001/002/003 como produtores que fazem ofertas)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

import { db } from '../config/firebase';
import type { EstablishmentProfile } from '../models/profiles/establishment';
import type { EstablishmentDemand }  from '../models/establishmentDemand';
import type { DemandOffer }          from '../models/demandOffer';

// ─── Constantes de tempo ──────────────────────────────────────────────────────

const now = new Date().toISOString();

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function isoTs(offsetHours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - offsetHours);
  return d.toISOString();
}

// ─── Estabelecimentos fictícios ───────────────────────────────────────────────

interface SeedEstablishment {
  uid:     string;
  profile: EstablishmentProfile;
}

const ESTABLISHMENTS: SeedEstablishment[] = [
  {
    uid: 'seed_estab_001',
    profile: {
      avatarUrl:         null,
      userName:          'restaurante_origem',
      businessName:      'Restaurante Origem',
      cnpj:              '12.345.678/0001-90',
      businessType:      'Restaurante',
      bio:               'Cozinha contemporânea de raiz, com menu sazonal baseado em produtos agroecológicos e orgânicos direto de produtores locais. Localizados no Bairro da Liberdade.',
      address:           'Rua dos Estudantes, 87 — Liberdade',
      city:              'São Paulo',
      state:             'SP',
      phone:             '+5511988880001',
      isWhatsApp:        true,
      instagram:         'restauranteorigem',
      website:           'https://restauranteorigem.com.br',
      recurringNeeds:    ['hortaliças', 'frutas', 'ervas frescas', 'mel'],
      linkedProducerIds: ['seed_producer_001', 'seed_producer_002'],
    },
  },
  {
    uid: 'seed_estab_002',
    profile: {
      avatarUrl:         null,
      userName:          'mercadinho_semente',
      businessName:      'Mercadinho Semente Verde',
      cnpj:              '98.765.432/0001-11',
      businessType:      'Mercado Natural',
      bio:               'Mercado especializado em produtos orgânicos, naturais e a granel. Fornecemos para famílias e pequenos negócios da zona norte de Campinas.',
      address:           'Av. José de Souza Campos, 314 — Centro',
      city:              'Campinas',
      state:             'SP',
      phone:             '+5519977770002',
      isWhatsApp:        true,
      instagram:         'mercadinhosementeverde',
      website:           null,
      recurringNeeds:    ['grãos', 'farinhas', 'leguminosas', 'café'],
      linkedProducerIds: ['seed_producer_001', 'seed_producer_003'],
    },
  },
  {
    uid: 'seed_estab_003',
    profile: {
      avatarUrl:         null,
      userName:          'padaria_integral_raiz',
      businessName:      'Padaria Integral Raiz',
      cnpj:              '11.222.333/0001-44',
      businessType:      'Padaria Artesanal',
      bio:               'Produzimos pão de fermentação natural com farinhas integrais, orgânicas e locais. Sem conservantes, sem aditivos químicos.',
      address:           'Rua das Amendoeiras, 22 — Vila Madalena',
      city:              'São Paulo',
      state:             'SP',
      phone:             '+5511966660003',
      isWhatsApp:        false,
      instagram:         'padariaintegralraiz',
      website:           null,
      recurringNeeds:    ['farinhas', 'ovos', 'mel', 'frutas secas'],
      linkedProducerIds: ['seed_producer_003'],
    },
  },
];

// ─── Demandas ─────────────────────────────────────────────────────────────────

type DemandSeed = Omit<EstablishmentDemand, 'id'>;

/** Gera 4 demandas para o Restaurante Origem */
const DEMANDS_ESTAB_001: DemandSeed[] = [
  {
    establishmentUid:  'seed_estab_001',
    establishmentName: 'Restaurante Origem',
    productName:       'Tomate Cereja Orgânico',
    category:          'hortalicas',
    quantityNeeded:    20,
    unit:              'kg',
    maxPricePerUnit:   12.00,
    deadline:          isoDate(14),
    deliveryLocation:  { displayName: 'Restaurante Origem — Cozinha', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             'Preferência por variedades mix (amarelo e vermelho). Entrega nas terças antes das 10h.',
    status:            'open',
    createdAt:         isoTs(48),
    updatedAt:         isoTs(48),
  },
  {
    establishmentUid:  'seed_estab_001',
    establishmentName: 'Restaurante Origem',
    productName:       'Alface e Mix de Folhosas',
    category:          'hortalicas',
    quantityNeeded:    15,
    unit:              'kg',
    maxPricePerUnit:   8.00,
    deadline:          isoDate(7),
    deliveryLocation:  { displayName: 'Restaurante Origem — Cozinha', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             'Rúcula, alface crespa, agrião e chicória. Colheita máximo 24h antes da entrega.',
    status:            'negotiating',
    createdAt:         isoTs(72),
    updatedAt:         isoTs(2),
  },
  {
    establishmentUid:  'seed_estab_001',
    establishmentName: 'Restaurante Origem',
    productName:       'Mel Silvestre Puro',
    category:          'outros',
    quantityNeeded:    5,
    unit:              'kg',
    maxPricePerUnit:   80.00,
    deadline:          isoDate(21),
    deliveryLocation:  { displayName: 'Restaurante Origem — Cozinha', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             'Uso em sobremesas e drinques. Prefiro não pasteurizado com origem certificada.',
    status:            'open',
    createdAt:         isoTs(24),
    updatedAt:         isoTs(24),
  },
  {
    establishmentUid:  'seed_estab_001',
    establishmentName: 'Restaurante Origem',
    productName:       'Abóbora Moranga Cabotiá',
    category:          'hortalicas',
    quantityNeeded:    30,
    unit:              'kg',
    maxPricePerUnit:   6.00,
    deadline:          isoDate(-3), // já vencida — cancelled
    deliveryLocation:  { displayName: 'Restaurante Origem — Cozinha', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             null,
    status:            'cancelled',
    createdAt:         isoTs(168),
    updatedAt:         isoTs(75),
  },
];

/** Gera 4 demandas para o Mercadinho Semente Verde */
const DEMANDS_ESTAB_002: DemandSeed[] = [
  {
    establishmentUid:  'seed_estab_002',
    establishmentName: 'Mercadinho Semente Verde',
    productName:       'Feijão Carioca Agroecológico',
    category:          'graos',
    quantityNeeded:    50,
    unit:              'kg',
    maxPricePerUnit:   16.00,
    deadline:          isoDate(30),
    deliveryLocation:  { displayName: 'Mercadinho Semente Verde — Estoque', city: 'Campinas', state: 'SP', coords: null, placeId: null },
    notes:             'Grão limpo, sem impurezas. Embalagem a vácuo em sacos de 1 kg ou 5 kg.',
    status:            'open',
    createdAt:         isoTs(12),
    updatedAt:         isoTs(12),
  },
  {
    establishmentUid:  'seed_estab_002',
    establishmentName: 'Mercadinho Semente Verde',
    productName:       'Farinha de Mandioca Artesanal',
    category:          'processados',
    quantityNeeded:    40,
    unit:              'kg',
    maxPricePerUnit:   14.00,
    deadline:          isoDate(20),
    deliveryLocation:  { displayName: 'Mercadinho Semente Verde — Estoque', city: 'Campinas', state: 'SP', coords: null, placeId: null },
    notes:             'Grão médio ou fino, cor clara. Aprovação de amostra antes do pedido completo.',
    status:            'open',
    createdAt:         isoTs(36),
    updatedAt:         isoTs(36),
  },
  {
    establishmentUid:  'seed_estab_002',
    establishmentName: 'Mercadinho Semente Verde',
    productName:       'Café Agroflorestal Torrado',
    category:          'bebidas',
    quantityNeeded:    10,
    unit:              'kg',
    maxPricePerUnit:   60.00,
    deadline:          isoDate(45),
    deliveryLocation:  { displayName: 'Mercadinho Semente Verde — Estoque', city: 'Campinas', state: 'SP', coords: null, placeId: null },
    notes:             'Torra média ou média-escura. Moído grosso para filtro e coado. Com certificação de origem.',
    status:            'closed',
    createdAt:         isoTs(200),
    updatedAt:         isoTs(10),
  },
  {
    establishmentUid:  'seed_estab_002',
    establishmentName: 'Mercadinho Semente Verde',
    productName:       'Batata-Doce Laranja',
    category:          'hortalicas',
    quantityNeeded:    25,
    unit:              'kg',
    maxPricePerUnit:   9.00,
    deadline:          isoDate(10),
    deliveryLocation:  { displayName: 'Mercadinho Semente Verde — Estoque', city: 'Campinas', state: 'SP', coords: null, placeId: null },
    notes:             null,
    status:            'open',
    createdAt:         isoTs(6),
    updatedAt:         isoTs(6),
  },
];

/** Gera 4 demandas para a Padaria Integral Raiz */
const DEMANDS_ESTAB_003: DemandSeed[] = [
  {
    establishmentUid:  'seed_estab_003',
    establishmentName: 'Padaria Integral Raiz',
    productName:       'Mel para uso culinário',
    category:          'outros',
    quantityNeeded:    8,
    unit:              'kg',
    maxPricePerUnit:   75.00,
    deadline:          isoDate(25),
    deliveryLocation:  { displayName: 'Padaria Integral Raiz', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             'Mel claro, sabor suave. Uso em receitas de pão doce e bolos. Embalagem em potes de 1 kg.',
    status:            'open',
    createdAt:         isoTs(18),
    updatedAt:         isoTs(18),
  },
  {
    establishmentUid:  'seed_estab_003',
    establishmentName: 'Padaria Integral Raiz',
    productName:       'Banana Prata para biomassa',
    category:          'frutas',
    quantityNeeded:    20,
    unit:              'kg',
    maxPricePerUnit:   5.00,
    deadline:          isoDate(5),
    deliveryLocation:  { displayName: 'Padaria Integral Raiz', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             'Banana verde ou semi-madura para receita de biomassa de banana verde. Entrega máximo 3 dias.',
    status:            'negotiating',
    createdAt:         isoTs(60),
    updatedAt:         isoTs(4),
  },
  {
    establishmentUid:  'seed_estab_003',
    establishmentName: 'Padaria Integral Raiz',
    productName:       'Óleo de Coco Extra Virgem',
    category:          'extratos',
    quantityNeeded:    6,
    unit:              'L',
    maxPricePerUnit:   55.00,
    deadline:          isoDate(35),
    deliveryLocation:  { displayName: 'Padaria Integral Raiz', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             'Prensado a frio, sem refinamento. Uso culinário (gordura para pães).',
    status:            'open',
    createdAt:         isoTs(10),
    updatedAt:         isoTs(10),
  },
  {
    establishmentUid:  'seed_estab_003',
    establishmentName: 'Padaria Integral Raiz',
    productName:       'Alho Nacional Orgânico',
    category:          'hortalicas',
    quantityNeeded:    3,
    unit:              'kg',
    maxPricePerUnit:   30.00,
    deadline:          isoDate(15),
    deliveryLocation:  { displayName: 'Padaria Integral Raiz', city: 'São Paulo', state: 'SP', coords: null, placeId: null },
    notes:             null,
    status:            'open',
    createdAt:         isoTs(8),
    updatedAt:         isoTs(8),
  },
];

// ─── Ofertas (definidas APÓS ter os IDs das demandas) ─────────────────────────

/**
 * Recebe o mapa demandIndex → demandId (gerado durante o seed)
 * e retorna os objetos de oferta prontos para gravação.
 *
 * Index 0-3  → demandas do estab_001
 * Index 4-7  → demandas do estab_002
 * Index 8-11 → demandas do estab_003
 */
function buildOffers(demandIds: string[]): Array<Omit<DemandOffer, 'id'> & { demandIndex: number }> {
  return [
    // ── Demanda 0: Tomate Cereja (estab_001, status=open) — 2 ofertas pending ───
    {
      demandIndex:  0,
      demandId:     demandIds[0],
      producerUid:  'seed_producer_001',
      producerName: 'Sítio Raízes Vivas',
      quantity:     15,
      pricePerUnit: 10.50,
      message:      'Tenho tomate cereja amarelo e vermelho orgânico. Posso entregar nas terças até às 9h. Certificado IBD.',
      status:       'pending',
      createdAt:    isoTs(30),
      updatedAt:    isoTs(30),
    },
    {
      demandIndex:  0,
      demandId:     demandIds[0],
      producerUid:  'seed_producer_002',
      producerName: 'Horta Comunitária Ipê',
      quantity:     10,
      pricePerUnit: 9.00,
      message:      'Produção orgânica participativa. Entregas terças e sextas na Grande SP.',
      status:       'pending',
      createdAt:    isoTs(20),
      updatedAt:    isoTs(20),
    },

    // ── Demanda 1: Folhosas (estab_001, status=negotiating) — accepted + rejected
    {
      demandIndex:  1,
      demandId:     demandIds[1],
      producerUid:  'seed_producer_002',
      producerName: 'Horta Comunitária Ipê',
      quantity:     15,
      pricePerUnit: 7.00,
      message:      'Mix semanal com rúcula, alface, chicória e couve. Colhemos na manhã da entrega. Podemos ir semanalmente.',
      status:       'accepted',
      createdAt:    isoTs(70),
      updatedAt:    isoTs(2),
    },
    {
      demandIndex:  1,
      demandId:     demandIds[1],
      producerUid:  'seed_producer_001',
      producerName: 'Sítio Raízes Vivas',
      quantity:     15,
      pricePerUnit: 8.50,
      message:      'Folhosas agroecológicas, colheita fresca. Dificuldade com agrião no momento.',
      status:       'rejected',
      createdAt:    isoTs(68),
      updatedAt:    isoTs(65),
    },

    // ── Demanda 2: Mel (estab_001, status=open) — 1 oferta pending ───────────
    {
      demandIndex:  2,
      demandId:     demandIds[2],
      producerUid:  'seed_producer_003',
      producerName: 'Apicultura & Ervas Serra Azul',
      quantity:     5,
      pricePerUnit: 75.00,
      message:      'Mel silvestre Mata Atlântica, não pasteurizado, flora nativa. Envio pelos Correios ou retirada. Laudo de qualidade disponível.',
      status:       'pending',
      createdAt:    isoTs(10),
      updatedAt:    isoTs(10),
    },

    // ── Demanda 4: Feijão (estab_002, status=open) — 2 pending ────────────────
    {
      demandIndex:  4,
      demandId:     demandIds[4],
      producerUid:  'seed_producer_001',
      producerName: 'Sítio Raízes Vivas',
      quantity:     50,
      pricePerUnit: 14.00,
      message:      'Feijão carioca sem veneno, grão uniforme. Embalamos em sacos de 1 kg a vácuo. Frete via transportadora para Campinas.',
      status:       'pending',
      createdAt:    isoTs(8),
      updatedAt:    isoTs(8),
    },
    {
      demandIndex:  4,
      demandId:     demandIds[4],
      producerUid:  'seed_producer_002',
      producerName: 'Horta Comunitária Ipê',
      quantity:     30,
      pricePerUnit: 13.50,
      message:      'Temos 30 kg disponíveis agora. Podemos ir ao mercado ou despachar.',
      status:       'pending',
      createdAt:    isoTs(5),
      updatedAt:    isoTs(5),
    },

    // ── Demanda 5: Farinha de Mandioca (estab_002, status=open) — 1 pending ───
    {
      demandIndex:  5,
      demandId:     demandIds[5],
      producerUid:  'seed_producer_001',
      producerName: 'Sítio Raízes Vivas',
      quantity:     40,
      pricePerUnit: 11.00,
      message:      'Farinha torrada artesanalmente, grão médio, cor clara. Posso enviar amostra gratuita antes do pedido.',
      status:       'pending',
      createdAt:    isoTs(20),
      updatedAt:    isoTs(20),
    },

    // ── Demanda 6: Café (estab_002, status=closed) — 1 confirmed ─────────────
    {
      demandIndex:  6,
      demandId:     demandIds[6],
      producerUid:  'seed_producer_003',
      producerName: 'Apicultura & Ervas Serra Azul',
      quantity:     10,
      pricePerUnit: 56.00,
      message:      'Café agroflorestal arábica, torra média. Moído grosso para filtro. Embalagem grão + nota fiscal.',
      status:       'confirmed',
      createdAt:    isoTs(192),
      updatedAt:    isoTs(10),
    },

    // ── Demanda 7: Batata-Doce (estab_002, status=open) — 1 pending ──────────
    {
      demandIndex:  7,
      demandId:     demandIds[7],
      producerUid:  'seed_producer_002',
      producerName: 'Horta Comunitária Ipê',
      quantity:     25,
      pricePerUnit: 6.50,
      message:      'Batata-doce laranja cultivada sem agrotóxico. Disponível para entrega em Campinas.',
      status:       'pending',
      createdAt:    isoTs(3),
      updatedAt:    isoTs(3),
    },

    // ── Demanda 8: Mel Padaria (estab_003, status=open) — 1 pending ───────────
    {
      demandIndex:  8,
      demandId:     demandIds[8],
      producerUid:  'seed_producer_003',
      producerName: 'Apicultura & Ervas Serra Azul',
      quantity:     8,
      pricePerUnit: 70.00,
      message:      'Mel silvestre claro, sabor suave (florada de laranjeira predominante). Potes de 1 kg lacrados.',
      status:       'pending',
      createdAt:    isoTs(15),
      updatedAt:    isoTs(15),
    },

    // ── Demanda 9: Banana (estab_003, status=negotiating) — accepted + cancelled
    {
      demandIndex:  9,
      demandId:     demandIds[9],
      producerUid:  'seed_producer_001',
      producerName: 'Sítio Raízes Vivas',
      quantity:     20,
      pricePerUnit: 4.50,
      message:      'Banana prata verde ou semi-madura disponível. Entrega na próxima semana em SP.',
      status:       'accepted',
      createdAt:    isoTs(58),
      updatedAt:    isoTs(4),
    },
    {
      demandIndex:  9,
      demandId:     demandIds[9],
      producerUid:  'seed_producer_002',
      producerName: 'Horta Comunitária Ipê',
      quantity:     15,
      pricePerUnit: 4.00,
      message:      'Temos banana verde orgânica. Mas não conseguimos entregar no prazo de 3 dias.',
      status:       'cancelled',
      createdAt:    isoTs(55),
      updatedAt:    isoTs(50),
    },

    // ── Demanda 10: Óleo de Coco (estab_003, status=open) — 1 pending ─────────
    {
      demandIndex:  10,
      demandId:     demandIds[10],
      producerUid:  'seed_producer_003',
      producerName: 'Apicultura & Ervas Serra Azul',
      quantity:     6,
      pricePerUnit: 50.00,
      message:      'Óleo de coco extra virgem prensado a frio. Embalagem em frascos âmbar de 200 ml (30 unidades). Envio pelos Correios.',
      status:       'pending',
      createdAt:    isoTs(6),
      updatedAt:    isoTs(6),
    },

    // ── Demanda 11: Alho (estab_003, status=open) — 1 pending ────────────────
    {
      demandIndex:  11,
      demandId:     demandIds[11],
      producerUid:  'seed_producer_001',
      producerName: 'Sítio Raízes Vivas',
      quantity:     3,
      pricePerUnit: 24.00,
      message:      'Alho branco orgânico, cabeça graúda. Colheita deste mês. Envio pelos Correios ou entrego em São Paulo.',
      status:       'pending',
      createdAt:    isoTs(4),
      updatedAt:    isoTs(4),
    },
  ];
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱 Iniciando seed de demandas e ofertas...\n');

  // ── Perfis dos estabelecimentos ─────────────────────────────────────────────
  console.log(`🏪 Inserindo ${ESTABLISHMENTS.length} estabelecimentos...`);
  for (const { uid, profile } of ESTABLISHMENTS) {
    await db.collection('establishments').doc(uid).set(profile);
    console.log(`  ✓ ${profile.businessName} (${uid})`);
  }

  // ── Demandas ─────────────────────────────────────────────────────────────────
  const allDemandSeeds: DemandSeed[] = [
    ...DEMANDS_ESTAB_001,
    ...DEMANDS_ESTAB_002,
    ...DEMANDS_ESTAB_003,
  ];

  console.log(`\n📋 Inserindo ${allDemandSeeds.length} demandas...`);

  const demandIds: string[] = [];

  for (const demand of allDemandSeeds) {
    const ref = db.collection('establishmentDemands').doc();
    await ref.set({ ...demand, id: ref.id });
    demandIds.push(ref.id);
    const label = demand.status.padEnd(11);
    console.log(`  ✓ [${label}] ${demand.establishmentName} → "${demand.productName}"`);
  }

  // ── Ofertas ──────────────────────────────────────────────────────────────────
  const offerSeeds = buildOffers(demandIds);

  console.log(`\n📨 Inserindo ${offerSeeds.length} ofertas...`);

  for (const { demandIndex, ...offerData } of offerSeeds) {
    const demandId = demandIds[demandIndex];
    const ref = db
      .collection('establishmentDemands')
      .doc(demandId)
      .collection('offers')
      .doc();
    await ref.set({ ...offerData, id: ref.id });
    const label = offerData.status.padEnd(9);
    console.log(`  ✓ [${label}] ${offerData.producerName} → demanda[${demandIndex}] @ R$ ${offerData.pricePerUnit}/${allDemandSeeds[demandIndex].unit}`);
  }

  // ── Resumo ───────────────────────────────────────────────────────────────────
  console.log('\n📊 Resumo por estabelecimento:');
  for (const { uid, profile } of ESTABLISHMENTS) {
    const count = allDemandSeeds.filter(d => d.establishmentUid === uid).length;
    const oids  = offerSeeds.filter(o => allDemandSeeds[o.demandIndex]?.establishmentUid === uid).length;
    console.log(`  ${profile.businessName}: ${count} demandas, ${oids} ofertas recebidas`);
  }

  const byStatus = allDemandSeeds.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\n📊 Demandas por status:');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status.padEnd(12)}: ${count}`);
  }

  const byOfferStatus = offerSeeds.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\n📊 Ofertas por status:');
  for (const [status, count] of Object.entries(byOfferStatus)) {
    console.log(`  ${status.padEnd(10)}: ${count}`);
  }

  console.log(`\n✅ Seed concluído — ${allDemandSeeds.length} demandas e ${offerSeeds.length} ofertas gravadas.\n`);
}

seed().catch(err => {
  console.error('\n❌ Seed falhou:', err);
  process.exit(1);
});
