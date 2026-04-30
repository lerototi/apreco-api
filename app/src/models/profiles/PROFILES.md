# User Profiles — Apreco

## Conceito

O sistema de perfis do Apreco distingue três tipos de usuário, cada um com seu conjunto de dados específicos armazenado no campo `profile` do documento Firestore.

O tipo do usuário é determinado pelo campo `role`. A seleção de role ocorre durante o onboarding, logo após o primeiro login.

---

## Roles disponíveis

| Role | Descrição |
|---|---|
| `consumidor` | Usuário que busca e adquire produtos de produtores locais |
| `ruralProducer` | Produtor rural — abrange agricultores, pecuaristas, apicultores, piscicultores, produtores de laticínios e qualquer pessoa que produza alimentos diretamente da terra ou criação animal |
| `estabelecimento` | Negócio (restaurante, mercado, padaria, etc.) que busca fornecedores e produtores |

> **Por que `ruralProducer` e não `agricultor`?**
> O termo "produtor rural" é mais abrangente e preciso. Um apicultor, piscicultor ou criador de gado não é estritamente um "agricultor". O sistema usa o termo em inglês para manter consistência com o restante dos campos da API.

---

## Fluxo de atribuição de role

```
Primeiro login (Google)
    └── fetchMyProfile() → profile vazio?
            ├── SIM → /onboarding
            │         ├── "Sim, sou produtor rural" → /onboarding/ruralProducer
            │         └── "Não, sou consumidor"    → /onboarding/consumidor
            └── NÃO → /(tabs)
```

O onboarding:
1. Apresenta a pergunta de seleção de role (`/onboarding/index`)
2. Chama `PUT /users/me/role` com o role escolhido
3. Chama `PUT /users/me/profile` com os dados do formulário
4. Atualiza o contexto local (`AuthContext`) e navega para `/(tabs)`

---

## Schemas de perfil

### `ConsumidorProfile`

Arquivo: `apreco-api/app/src/models/profiles/consumidor.ts`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | `string \| null` | Não | Nome de exibição do consumidor |
| `city` | `string \| null` | **Sim** (validado no app) | Cidade de residência |
| `neighborhood` | `string \| null` | Não | Bairro de residência |
| `interests` | `string[]` | Não | Interesses alimentares (ex: orgânicos, veganos, sazonais) |

---

### `RuralProducerProfile`

Arquivo: `apreco-api/app/src/models/profiles/ruralProducer.ts`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `nickname` | `string \| null` | **Sim** (validado no app) | Identificador público único (ex: `joao_horta`) |
| `bio` | `string \| null` | Não | Descrição livre do produtor e sua produção |
| `phone` | `string \| null` | Não | Telefone de contato |
| `isWhatsApp` | `boolean` | Não | Indica se o número também é WhatsApp (padrão: `false`) |
| `farmName` | `string \| null` | Não | Nome da propriedade/fazenda/sítio |
| `city` | `string \| null` | **Sim** (validado no app) | Cidade onde o produtor está localizado |
| `neighborhood` | `string \| null` | Não | Bairro ou localidade dentro da cidade |
| `productionSites` | `string[]` | Não | Locais onde mantém sua produção (pode ter mais de um) |
| `organic` | `boolean` | Não | Indica produção orgânica/agroecológica (padrão: `false`) |
| `certifications` | `string[]` | Não | Certificações obtidas (ex: IBD, Ecocert, SisOrg) |
| `deliveryOptions` | `string[]` | Não | Opções de entrega disponíveis |
| `instagram` | `string \| null` | Não | Handle do Instagram (sem @) |
| `facebook` | `string \| null` | Não | Perfil ou página no Facebook |
| `website` | `string \| null` | Não | Site ou loja online |

---

### `EstabelecimentoProfile`

Arquivo: `apreco-api/app/src/models/profiles/estabelecimento.ts`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `phone` | `string \| null` | Não | Telefone de contato |
| `businessName` | `string \| null` | Não | Razão social ou nome fantasia |
| `cnpj` | `string \| null` | Não | CNPJ (formato: XX.XXX.XXX/XXXX-XX) |
| `address` | `string \| null` | Não | Endereço completo |
| `city` | `string \| null` | Não | Cidade |
| `state` | `string \| null` | Não | Estado (sigla, ex: SP) |
| `bio` | `string \| null` | Não | Descrição do estabelecimento |
| `businessType` | `string \| null` | Não | Tipo do negócio (ex: restaurante, mercado, padaria) |
| `recurringNeeds` | `string[]` | Não | Necessidades recorrentes de insumos |

---

## API — Endpoints de perfil

Todos os endpoints requerem `Authorization: Bearer <Firebase ID Token>`.

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/users/me` | Retorna o perfil completo (privado) do usuário autenticado |
| `PUT` | `/users/me/role` | Atualiza o role. Body: `{ "role": "ruralProducer" }` |
| `PUT` | `/users/me/profile` | Atualiza o profile. Body: `{ "profile": { ... } }` |
| `GET` | `/users/:id` | Retorna o perfil público de qualquer usuário (sem `email`, `createdAt`, `updatedAt`) |

### Sanitização de campos

O endpoint `PUT /users/me/profile` nunca persiste campos desconhecidos. Cada role tem seu builder:

```
profile input (qualquer campos)
    └── sanitizeProfile(role, input)
            ├── role = 'consumidor'     → buildConsumidorProfile(input)
            ├── role = 'ruralProducer'  → buildRuralProducerProfile(input)
            └── role = 'estabelecimento'→ buildEstabelecimentoProfile(input)
```

Campos não presentes no schema são silenciosamente descartados antes de salvar no Firestore.

---

## Estrutura de arquivos

```
apreco-api/app/src/models/
├── user.ts                        # UserDocument, CRUD, sanitizeProfile, isValidRole
└── profiles/
    ├── index.ts                   # Re-exporta todos os tipos e builders
    ├── consumidor.ts              # ConsumidorProfile + buildConsumidorProfile
    ├── ruralProducer.ts           # RuralProducerProfile + buildRuralProducerProfile
    └── estabelecimento.ts         # EstabelecimentoProfile + buildEstabelecimentoProfile

apreco/app/onboarding/
├── _layout.tsx                    # Stack layout (oculto do drawer)
├── index.tsx                      # Seleção de role (produtor rural ou consumidor)
├── ruralProducer.tsx              # Formulário completo do produtor rural
└── consumidor.tsx                 # Formulário básico do consumidor
```

---

## Como adicionar um novo tipo de perfil

1. **Crie o schema** em `apreco-api/app/src/models/profiles/<novoTipo>.ts`:
   ```ts
   export interface NovoTipoProfile { /* campos */ }
   export function buildNovoTipoProfile(p: ProfileInput): NovoTipoProfile { /* ... */ }
   ```

2. **Re-exporte** em `profiles/index.ts`.

3. **Registre o builder** em `user.ts` dentro de `PROFILE_BUILDERS`:
   ```ts
   const PROFILE_BUILDERS: Record<UserRole, ...> = {
     // ...
     novoTipo: buildNovoTipoProfile,
   };
   ```

4. **Adicione o role** ao tipo `UserRole` e ao array `VALID_ROLES` em `user.ts`.

5. **Crie a tela de onboarding** em `apreco/app/onboarding/<novoTipo>.tsx`.

6. **Registre a rota** em `apreco/app/onboarding/_layout.tsx` e adicione o cartão de seleção em `index.tsx`.

7. **Escreva os testes** para o schema (API) e para a tela (app).

---

## Validação no app vs. sanitização na API

A validação e a sanitização são responsabilidades separadas e complementares:

| Camada | Responsabilidade |
|---|---|
| **App (frontend)** | Valida campos obrigatórios e formatos antes de enviar (UX imediata, sem round-trip) |
| **API (backend)** | Sanitiza campos desconhecidos antes de persistir (segurança, integridade do Firestore) |

A API **nunca** retorna erro por campos extras no body — ela simplesmente os descarta. A validação de negócio (ex: nickname obrigatório) é responsabilidade do app.
