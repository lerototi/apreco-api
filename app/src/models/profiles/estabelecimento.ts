/**
 * Schema do perfil do Estabelecimento.
 *
 * Estabelecimentos são negócios (restaurantes, mercados, padarias, etc.) que
 * utilizam a plataforma para encontrar fornecedores e produtores rurais.
 */

// ─── Interface ────────────────────────────────────────────────────────────────

export interface EstabelecimentoProfile {
  /** Telefone de contato */
  phone: string | null;
  /** Razão social ou nome fantasia */
  businessName: string | null;
  /** CNPJ (formato: XX.XXX.XXX/XXXX-XX) */
  cnpj: string | null;
  /** Endereço completo */
  address: string | null;
  /** Cidade */
  city: string | null;
  /** Estado (sigla, ex: SP) */
  state: string | null;
  /** Descrição do estabelecimento */
  bio: string | null;
  /** Tipo do negócio (ex: restaurante, mercado, padaria) */
  businessType: string | null;
  /** Necessidades recorrentes de insumos (ex: verduras, frutas, ovos) */
  recurringNeeds: string[];
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildEstabelecimentoProfile(p: ProfileInput): EstabelecimentoProfile {
  return {
    phone: (p.phone as string) || null,
    businessName: (p.businessName as string) || null,
    cnpj: (p.cnpj as string) || null,
    address: (p.address as string) || null,
    city: (p.city as string) || null,
    state: (p.state as string) || null,
    bio: (p.bio as string) || null,
    businessType: (p.businessType as string) || null,
    recurringNeeds: Array.isArray(p.recurringNeeds) ? (p.recurringNeeds as string[]) : [],
  };
}
