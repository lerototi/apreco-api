/**
 * fix-photos.ts
 *
 * Atualiza o campo `photos` de todos os produtos dos produtores seed
 * para usar URLs do Pexels CDN (que funcionam em React Native sem User-Agent).
 *
 * Execução:
 *   npx ts-node --project tsconfig.json src/scripts/fix-photos.ts
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

import { db } from '../config/firebase';

function px(id: number): string[] {
  return [`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?w=640`];
}

// Mapeamento: nome exato do produto → URL Pexels correta
const PHOTO_MAP: Record<string, string[]> = {
  'Tomate Cereja Orgânico':                  px(533360),
  'Cenoura Baby Orgânica':                   px(143133),
  'Milho Verde Crioulo':                     px(1022867),
  'Abóbora Moranga Cabotiá':                 px(1640770),
  'Banana Prata Agroecológica':              px(1093038),
  'Farinha de Mandioca Agroecológica':       px(6157063),
  'Feijão Carioca Agroecológico':            px(4110251),
  'Alho Nacional Orgânico':                  px(4197445),
  'Mix de Folhosas Orgânicas':               px(1327838),
  'Alface Crespa Orgânica':                  px(2325843),
  'Batata-Doce Laranja':                     px(8601689),
  'Berinjela Comprida Orgânica':             px(3669638),
  'Pimentão Colorido Orgânico':              px(594137),
  'Quiabo Orgânico':                         px(7421023),
  'Geleia de Maracujá Artesanal':            px(1028714),
  'Chá de Ervas Medicinais (Mix)':           px(1638280),
  'Mel Silvestre Puro — Serra Atlântica':    px(4109714),
  'Própolis Verde Extrato Alcoólico 30%':    px(3994840),
  'Óleo de Coco Extra Virgem Artesanal':     px(725998),
  'Sabonete de Mel e Própolis':              px(4465124),
  'Creme Hidratante de Babosa e Mel':        px(3997990),
  'Café Agroflorestal Torrado Artesanal':    px(312418),
  'Manga Palmer Orgânica':                   px(918643),
};

const SEED_PRODUCER_UIDS = [
  'seed_producer_001',
  'seed_producer_002',
  'seed_producer_003',
];

async function fixPhotos() {
  console.log('\n🔧 Corrigindo fotos dos produtos seed...\n');
  let updated = 0;
  let skipped = 0;

  for (const uid of SEED_PRODUCER_UIDS) {
    const snap = await db
      .collection('ruralProducers').doc(uid)
      .collection('products')
      .get();

    for (const doc of snap.docs) {
      const name: string = doc.data().name ?? '';
      const newPhotos = PHOTO_MAP[name];

      if (!newPhotos) {
        console.log(`  ⚠ sem mapeamento para: "${name}"`);
        skipped++;
        continue;
      }

      await doc.ref.update({ photos: newPhotos, updatedAt: new Date().toISOString() });
      console.log(`  ✓ ${name}`);
      updated++;
    }
  }

  console.log(`\n✅ ${updated} produtos atualizados, ${skipped} sem mapeamento.\n`);
}

fixPhotos().catch(err => {
  console.error('\n❌ Fix falhou:', err);
  process.exit(1);
});
