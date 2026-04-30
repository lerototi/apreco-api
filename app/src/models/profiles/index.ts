/**
 * Ponto central de exportação dos schemas de perfil.
 *
 * Para adicionar um novo tipo de perfil:
 *  1. Crie o arquivo em `profiles/<novoTipo>.ts`
 *  2. Exporte a interface e a função `build<NovoTipo>Profile`
 *  3. Re-exporte aqui
 *  4. Registre a função no `PROFILE_BUILDERS` em `user.ts`
 */

export { ConsumidorProfile, buildConsumidorProfile } from './consumidor';
export { RuralProducerProfile, buildRuralProducerProfile } from './ruralProducer';
export { EstabelecimentoProfile, buildEstabelecimentoProfile } from './estabelecimento';

export type UserProfile =
  | import('./consumidor').ConsumidorProfile
  | import('./ruralProducer').RuralProducerProfile
  | import('./estabelecimento').EstabelecimentoProfile
  | Record<string, unknown>;
