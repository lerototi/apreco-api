/**
 * Schema do perfil do Produtor Rural (ruralProducer).
 *
 * O termo "produtor rural" é mais abrangente que "agricultor" e engloba:
 * agricultores, pecuaristas, apicultores, piscicultores, produtores de
 * laticínios, entre outros. Qualquer pessoa que produza alimentos ou insumos
 * agrícolas diretamente da terra ou criação animal.
 */

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RuralProducerProfile {
  /** Apelido/identificador público do produtor (único, ex: @joao_horta) */
  nickname: string | null;
  /** Descrição livre sobre o produtor e sua produção */
  bio: string | null;
  /** Telefone de contato */
  phone: string | null;
  /** Indica se o número de telefone também é WhatsApp */
  isWhatsApp: boolean;
  /** Nome da propriedade/fazenda/sítio */
  farmName: string | null;
  /** Cidade onde o produtor está localizado */
  city: string | null;
  /** Bairro ou localidade dentro da cidade */
  neighborhood: string | null;
  /** Locais onde o produtor mantém sua produção (pode ter mais de um) */
  productionSites: string[];
  /** Indica se a produção é orgânica/agroecológica */
  organic: boolean;
  /** Certificações obtidas (ex: IBD, Ecocert, SisOrg) */
  certifications: string[];
  /** Opções de entrega disponíveis (ex: retirada, entrega a domicílio, feira) */
  deliveryOptions: string[];
  /** Instagram (sem @) */
  instagram: string | null;
  /** Perfil ou página no Facebook */
  facebook: string | null;
  /** Site ou loja online */
  website: string | null;
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildRuralProducerProfile(p: ProfileInput): RuralProducerProfile {
  return {
    nickname: (p.nickname as string) || null,
    bio: (p.bio as string) || null,
    phone: (p.phone as string) || null,
    isWhatsApp: typeof p.isWhatsApp === 'boolean' ? p.isWhatsApp : false,
    farmName: (p.farmName as string) || null,
    city: (p.city as string) || null,
    neighborhood: (p.neighborhood as string) || null,
    productionSites: Array.isArray(p.productionSites) ? (p.productionSites as string[]) : [],
    organic: typeof p.organic === 'boolean' ? p.organic : false,
    certifications: Array.isArray(p.certifications) ? (p.certifications as string[]) : [],
    deliveryOptions: Array.isArray(p.deliveryOptions) ? (p.deliveryOptions as string[]) : [],
    instagram: (p.instagram as string) || null,
    facebook: (p.facebook as string) || null,
    website: (p.website as string) || null,
  };
}
