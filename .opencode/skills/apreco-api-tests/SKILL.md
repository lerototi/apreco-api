---
name: apreco-api-tests
description: Workflow completo para criar e manter testes unitários no apreco-api. Use sempre que implementar nova funcionalidade, corrigir bugs ou refatorar código. Garante cobertura de todos os casos relevantes e validação dos testes existentes.
license: MIT
compatibility: opencode
---

## O que eu faço

Guio o processo de criação e manutenção de testes unitários para o apreco-api, seguindo os padrões e convenções já estabelecidos no projeto.

---

## Stack de testes

| Ferramenta | Papel |
|---|---|
| **Jest 30** | Runner de testes |
| **ts-jest** | Compilação TypeScript em tempo de teste |
| **supertest** | Disponível para testes de integração HTTP (opcional) |

Todos os testes ficam em `app/src/__tests__/` e espelham a estrutura de `app/src/`.

---

## Onde cada arquivo de teste fica

```
app/src/__tests__/
  controllers/          ← testes de cada controller
  middleware/           ← testes de middleware (auth, etc.)
  models/               ← testes de modelos e funções puras
  helpers/
    factories.ts        ← factories de dados de teste (ADICIONE aqui quando criar novos modelos)
  __mocks__/
    firebase-module.ts  ← mock central do Firestore/Auth (MODIFIQUE aqui quando necessário)
  setup.ts              ← variáveis de ambiente para todos os testes
```

---

## Como executar os testes

```bash
# De dentro de app/
npm test                  # executa todos os testes uma vez
npm run test:watch        # modo watch (reexecuta ao salvar)
npm run test:coverage     # gera relatório de cobertura em app/coverage/
```

---

## Padrões do projeto

### 1. Nomenclatura
- Arquivo de teste: `<nomeDoArquivoFonte>.test.ts`
- Comentários e descrições de `describe`/`it` em **português brasileiro**
- Bloco `describe` por função/método testado
- Mensagens de `it` descrevem o comportamento esperado (ex: `'retorna 404 quando usuário não existe'`)

### 2. Estrutura de cada teste

```typescript
import { firestoreStore } from '../__mocks__/firebase-module';
import { minhaFuncao } from '../../controllers/meuController';
import { makeRequest, makeResponse, makeUser } from '../helpers/factories';

beforeEach(() => {
  firestoreStore.clear(); // limpa estado entre testes
});

describe('minhaFuncao', () => {
  it('caso de sucesso', async () => {
    // 1. Arrange — popula o store e monta req/res
    firestoreStore.set('colecao/id', dadoFake);
    const req = makeRequest({ body: { ... } });
    const res = makeResponse();

    // 2. Act
    await minhaFuncao(req, res);

    // 3. Assert
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ... }));
    expect(res.status).not.toHaveBeenCalled();
  });
});
```

### 3. Mock do Firestore (`firebase-module.ts`)

O mock central suporta:

- **Coleções simples**: `db.collection('users').doc('uid')`
- **Subcoleções aninhadas**: `db.collection('ruralProducers').doc('uid').collection('properties').doc('id')`
- **`FieldValue.arrayUnion`** e **`FieldValue.arrayRemove`** — aplicados automaticamente no `set(merge: true)` e `update()`
- **`CollectionRef.orderBy().get()`** — retorna todos os docs da coleção (sem ordenação real)
- **`DocumentRef.delete()`** — remove o doc do store
- **`CollectionRef.doc()` sem id** — gera ID aleatório (para `createFarmProperty`, etc.)

**Caminhos no `firestoreStore`** (Map<string, object>):
```
'users/{uid}'
'ruralProducers/{uid}'
'ruralProducers/{uid}/properties/{propertyId}'
'establishments/{uid}'
'consumers/{uid}'
```

### 4. Factories em `helpers/factories.ts`

Sempre use e **estenda** as factories existentes antes de criar dados inline:

| Factory | Tipo retornado |
|---|---|
| `makeUser(overrides?)` | `UserDocument` (consumer) |
| `makeRuralProducer(overrides?)` | `UserDocument` (ruralProducer) |
| `makeEstablishment(overrides?)` | `UserDocument` (establishment) |
| `makeMultiRoleUser(overrides?)` | `UserDocument` (consumer + ruralProducer) |
| `makeConsumerProfile(overrides?)` | `ConsumerProfile` |
| `makeRuralProducerProfile(overrides?)` | `RuralProducerProfile` |
| `makeEstablishmentProfile(overrides?)` | `EstablishmentProfile` |
| `makeFarmProperty(overrides?)` | `FarmProperty` |
| `makeFarmPropertyInput(overrides?)` | `FarmPropertyInput` |
| `makeRequest(overrides?)` | `Request` mock com `user` autenticado (`uid-test-001`) |
| `makeResponse()` | `Response` mock com `status`, `json`, `send` espiados |
| `makeDecodedToken(overrides?)` | `DecodedIdToken` fake |

**Quando criar nova factory**: adicione em `helpers/factories.ts` seguindo o padrão existente (valor base + spread de `overrides`).

### 5. Mock de erro do Firestore (500)

```typescript
it('retorna 500 quando o Firestore lança erro', async () => {
  const { db } = await import('../__mocks__/firebase-module');
  db.collection.mockReturnValueOnce({
    doc: jest.fn(() => ({
      get: jest.fn().mockRejectedValueOnce(new Error('Firestore offline')),
    })),
  } as any);

  const req = makeRequest();
  const res = makeResponse();
  await minhaFuncao(req, res);

  expect(res.status).toHaveBeenCalledWith(500);
});
```

---

## Checklist ao criar nova funcionalidade

Ao implementar um novo endpoint ou função, crie testes cobrindo **todos** os casos abaixo:

### Controllers REST
- [ ] **Sucesso (200/201)** — resposta correta com dados válidos
- [ ] **Não encontrado (404)** — recurso inexistente
- [ ] **Validação (400)** — body/params inválidos ou ausentes
- [ ] **Autorização (403)** — usuário sem permissão/role necessário
- [ ] **Erro interno (500)** — falha simulada do Firestore
- [ ] **Idempotência** — se aplicável (ex: adicionar role já existente)
- [ ] **Sanitização** — campos desconhecidos não persistem

### Modelos / funções puras
- [ ] **Caminho feliz** — retorno correto com entrada válida
- [ ] **Entrada inválida** — valores nulos, tipos errados, campos ausentes
- [ ] **Retrocompatibilidade** — docs antigos sem campos novos funcionam

### Middleware
- [ ] **Token ausente** — 401
- [ ] **Token malformado** — 401
- [ ] **Token inválido/expirado** — 401
- [ ] **Token válido** — `next()` chamado, `req.user` preenchido

---

## Checklist ao corrigir um bug

1. **Reproduza o bug** escrevendo um teste que **falha** antes da correção
2. Aplique a correção no código-fonte
3. Confirme que o novo teste **passa**
4. Execute `npm test` para garantir que nenhum teste existente quebrou

---

## Checklist ao refatorar

1. Execute `npm test` antes para ter a baseline verde
2. Refatore o código
3. Execute `npm test` novamente — todos devem continuar passando
4. Se a interface pública mudou, atualize os testes correspondentes

---

## Adicionando novo modelo com subcoleção

Se o novo modelo usa subcoleção Firestore (como `FarmProperty`), o caminho no `firestoreStore` segue o padrão:

```
'colecaoPai/{parentId}/subcolecao/{childId}'
```

O mock já suporta isso automaticamente via `docRef.collection(subCol)`.

---

## Convenção de UIDs nos testes

| UID | Propósito |
|---|---|
| `uid-test-001` | Usuário autenticado padrão (usado por `makeRequest`) |
| `uid-ruralproducer-001` | Produtor rural padrão |
| `uid-establishment-001` | Estabelecimento padrão |
| `uid-multi-001` | Usuário com múltiplos roles |
| `uid-publico` | Usuário para testes de `getById` |
| `uid-fantasma` | UID que nunca existe (para testar 404) |
