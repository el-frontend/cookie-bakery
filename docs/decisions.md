# Decisiones técnicas y hallazgos

Registro de lo que se ha verificado empíricamente contra Cookie Chain. El PRD (`docs/prds/PRD-cookie-bakery.md`) manda; este archivo recoge los hallazgos que resuelven sus incógnitas.

---

## 2026-09-07 · Sondeo inicial de Cookie Chain (previo a fase 0)

Verificado con `curl` contra `https://rpc.cookiescan.io` y `https://api.cookiescan.io`. **No se ha probado nada con wallet todavía** — todo lo de abajo es lectura anónima.

### RPC operativo

| Dato | Valor |
|---|---|
| `getVersion` | `solana-core: 4.1.2`, `feature-set: 3345198602` |
| `getSlot` | 23,872,514 (en el momento del sondeo) |
| Servidor | nginx/1.24.0 (Ubuntu) |

Agave **4.1.2** es una versión moderna (jul 2026). Implica runtime actual y soporte de las extensiones de Token-2022.

### ✅ RIESGO RESUELTO — los programas nativos están desplegados

El PRD listaba como riesgo Alto que Cookie Chain no tuviera Token-2022 con extensiones de metadata. **Lo tiene:**

| Programa | Address | Tamaño | Loader |
|---|---|---|---|
| Token-2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | **1,382,016 B** | BPFLoader2 |
| Token (SPL) | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | 134,080 B | BPFLoader2 |
| Associated Token | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | 105,032 B | BPFLoader2 |
| Compute Budget | `ComputeBudget111111111111111111111111111111` | 22 B | NativeLoader |
| Memo | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` | 74,800 B | BPFLoader2 |

Los cinco con `executable: true`. El tamaño de Token-2022 (~1.38 MB) coincide con el build completo de mainnet, el que incluye las extensiones. **El fallback a SPL Token clásico de RF-02 sigue en el plan, pero baja de prioridad.**

> ⚠️ Pendiente: que el programa esté desplegado no garantiza que la extensión `TokenMetadata` funcione. Confirmar creando un mint real en fase 2.

### ✅ RESUELTO — WebSocket disponible

`wss://rpc.cookiescan.io` (mismo host, upgrade desde https) responde **`101 Switching Protocols`**.

Consecuencia: `useTrackedDataSWR` (`getBalance` + `accountNotifications`) funciona tal cual. **No hace falta el fallback a polling** que contemplaba RT-02. `solanaRpc` deriva el `wss://` automáticamente; no hay que pasar `rpcSubscriptionsUrl`.

### ✅ CORS abierto

El RPC responde con:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Solana-Client
```

Una app 100 % cliente puede llamarlo directamente desde el navegador. No hace falta proxy.

### ✅ RIESGO RESUELTO — la DAS API tiene holders por mint

El PRD listaba como riesgo Bajo que la DAS no tuviera método de holders. **Lo tiene.**

`POST https://api.cookiescan.io` → HTTP 200:

```jsonc
// request
{"jsonrpc":"2.0","id":1,"method":"getTokenAccounts",
 "params":{"mint":"<mint>","limit":1}}          // params es OBJETO, no array

// response
{"result":{
  "total": 1422,                                 // ← nº de holders, gratis
  "limit": 1, "page": 1,
  "token_accounts":[{
    "address":"…", "mint":"…", "owner":"…",
    "amount":"7697045698324009",                 // string, no number
    "delegated_amount":0, "frozen":false,
    "token_program":"Tokenkeg…"                  // ← identifica Token vs Token-2022
  }]}}
```

Notas para RF-04:
- `total` da el recuento de holders sin paginar nada.
- `amount` viene como **string** — parsear a `bigint`, nunca a `number`.
- `token_program` por cuenta permite detectar la variante del token sin una lectura extra.
- Paginación por `page` / `limit`.
- ⚠️ **Sin verificar:** si el orden es por `amount` descendente y cuál es el `limit` máximo. RF-04 necesita el top 20, así que confirmarlo al implementar; si no viene ordenado, paginar y ordenar en cliente, o caer a `getTokenLargestAccounts`.

---

## Incógnitas todavía abiertas

| # | Incógnita | Bloquea | Cómo se resuelve |
|---|---|---|---|
| 1 | Valor correcto de `VITE_WALLET_CHAIN` (identificador Wallet Standard que anuncia Nightly para Cookie Chain) | RF-01 | Spike de fase 1 con Nightly instalada — enumerar `wallet.chains` en el navegador |
| 2 | Si `client.sendTransaction` delega en `signAndSendTransactions` de la wallet (RT-03.1) | RF-01, todo lo demás | Spike de fase 1: primera tx real |
| 3 | Si Nightly firma con blockhash de Cookie Chain sin rechazar (RT-03.2) | RF-02+ | Spike de fase 1 |
| 4 | Si la extensión `TokenMetadata` de Token-2022 funciona en esta cadena | RF-02 | Crear un mint de prueba en fase 2 |
| 5 | Orden y `limit` máximo de `getTokenAccounts` en la DAS | RF-04 | Probar al implementar RF-04 |
