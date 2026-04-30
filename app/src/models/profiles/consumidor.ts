/**
 * Schema do perfil do Consumidor.
 *
 * Consumidores são usuários que utilizam a plataforma para encontrar e adquirir
 * produtos de produtores rurais e estabelecimentos.
 */

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ConsumidorProfile {
  /** Nome de exibição do consumidor */
  name: string | null;
  /** Cidade de residência */
  city: string | null;
  /** Bairro de residência */
  neighborhood: string | null;
  /** Interesses alimentares (ex: orgânicos, veganos, sazonais) */
  interests: string[];
}

// ─── Schema (sanitização) ─────────────────────────────────────────────────────

type ProfileInput = Record<string, unknown>;

export function buildConsumidorProfile(p: ProfileInput): ConsumidorProfile {
  return {
    name: (p.name as string) || null,
    city: (p.city as string) || null,
    neighborhood: (p.neighborhood as string) || null,
    interests: Array.isArray(p.interests) ? (p.interests as string[]) : [],
  };
}
