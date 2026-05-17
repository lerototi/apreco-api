# Demandas Recorrentes — Comportamento Atual e Roadmap

## Comportamento atual (MVP)

Demandas com `isRecurring: true` se comportam **igual às pontuais** no ciclo de confirmação de ofertas:

- Quando `quantityConfirmed >= quantityNeeded` após um `confirmOffer`, a demanda é fechada (`status: 'closed'`).
- Não há reabertura automática.

Esse comportamento está documentado com `TODO` no controller:

```
// TODO(feature): demandas recorrentes devem reabrir automaticamente conforme
// periodicidade configurada pelo estabelecimento. Por ora ficam 'closed' como
// demandas pontuais. Implementar quando o campo `recurrencePeriod` for adicionado.
```

Ver: `src/controllers/offerController.ts` → `confirmOffer`.

---

## Feature futura: reabertura automática por periodicidade

### O que precisa ser implementado

1. **Campo `recurrencePeriod`** no modelo `EstablishmentDemand`:
   ```ts
   /** Intervalo de reabertura automática. Null para demandas pontuais. */
   recurrencePeriod: 'weekly' | 'biweekly' | 'monthly' | null;
   ```

2. **Lógica em `confirmOffer`**: quando `isRecurring === true` e `fullyFulfilled`:
   - Em vez de `updateDemandStatus(demandId, 'closed')`, reagendar a demanda:
     - Resetar `quantityNeeded` (ou criar nova demanda filha)
     - Agendar a reabertura com base em `recurrencePeriod`
     - Manter histórico de ciclos anteriores

3. **Job/trigger** (Cloud Functions ou cron) para reabrir a demanda na data calculada:
   - `open` → aceita novas ofertas do próximo ciclo

### Alternativa mais simples (sem job)

Ao invés de fechar e reabrir, manter a demanda em `'open'` mesmo após atingir a quantidade confirmada do ciclo. O estabelecimento fecha manualmente quando quiser pausar.

---

## Status do campo `negotiating`

O status `'negotiating'` existe no tipo `DemandStatus` mas **não é mais atribuído pelo backend** (foi removido de `acceptOffer`). Está reservado para uso futuro ou para remoção em versão futura.

Demandas com `status: 'negotiating'` ainda são exibidas no marketplace do produtor (listadas junto com `'open'`) para evitar regressão com dados legados.
