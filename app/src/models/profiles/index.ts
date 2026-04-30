/**
 * Central export point for profile schemas.
 *
 * To add a new profile type:
 *  1. Create the file at `profiles/<newType>.ts`
 *  2. Export the interface, `build<NewType>Profile` and CRUD functions
 *  3. Re-export here
 *  4. Register the builder in `PROFILE_BUILDERS` in `user.ts`
 */

export {
  ConsumerProfile,
  buildConsumerProfile,
  createConsumerProfile,
  findConsumerProfile,
  updateConsumerProfile,
} from './consumer';

export {
  RuralProducerProfile,
  buildRuralProducerProfile,
  createRuralProducerProfile,
  findRuralProducerProfile,
  updateRuralProducerProfile,
} from './ruralProducer';

export {
  EstabelecimentoProfile,
  buildEstabelecimentoProfile,
  createEstabelecimentoProfile,
  findEstabelecimentoProfile,
  updateEstabelecimentoProfile,
} from './estabelecimento';

export type UserProfile =
  | import('./consumer').ConsumerProfile
  | import('./ruralProducer').RuralProducerProfile
  | import('./estabelecimento').EstabelecimentoProfile
  | Record<string, unknown>;
