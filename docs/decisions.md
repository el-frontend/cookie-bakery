# Decisiones técnicas y hallazgos

Registro de lo que se ha verificado empíricamente contra Cookie Chain. El PRD (`docs/prds/PRD-cookie-bakery.md`) manda; este archivo recoge los hallazgos que resuelven sus incógnitas.

---

## 2026-09-07 · Sondeo inicial de Cookie Chain (previo a fase 0)

Verificado con `curl` contra `https://rpc.cookiescan.io` y `https://api.cookiescan.io`. **No se ha probado nada con wallet todavía** — todo lo de abajo es lectura anónima.

### RPC operativo

| Dato         | Valor                                           |
| ------------ | ----------------------------------------------- |
| `getVersion` | `solana-core: 4.1.2`, `feature-set: 3345198602` |
| `getSlot`    | 23,872,514 (en el momento del sondeo)           |
| Servidor     | nginx/1.24.0 (Ubuntu)                           |

Agave **4.1.2** es una versión moderna (jul 2026). Implica runtime actual y soporte de las extensiones de Token-2022.

### ✅ RIESGO RESUELTO — los programas nativos están desplegados

El PRD listaba como riesgo Alto que Cookie Chain no tuviera Token-2022 con extensiones de metadata. **Lo tiene:**

| Programa         | Address                                        | Tamaño          | Loader       |
| ---------------- | ---------------------------------------------- | --------------- | ------------ |
| Token-2022       | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`  | **1,382,016 B** | BPFLoader2   |
| Token (SPL)      | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`  | 134,080 B       | BPFLoader2   |
| Associated Token | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | 105,032 B       | BPFLoader2   |
| Compute Budget   | `ComputeBudget111111111111111111111111111111`  | 22 B            | NativeLoader |
| Memo             | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`  | 74,800 B        | BPFLoader2   |

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

| #   | Incógnita                                                                              | Bloquea              | Cómo se resuelve                         |
| --- | -------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------- |
| 1   | ~~Valor correcto de `VITE_WALLET_CHAIN`~~ **RESUELTA** → `solana:mainnet`              | ~~RF-01~~            | Cerrada por la spike RF-01.1 (ver abajo) |
| 2   | Si `client.sendTransaction` delega en `signAndSendTransactions` de la wallet (RT-03.1) | RF-01, todo lo demás | Spike de fase 1: primera tx real         |
| 3   | Si Nightly firma con blockhash de Cookie Chain sin rechazar (RT-03.2)                  | RF-02+               | Spike de fase 1                          |
| 4   | Si la extensión `TokenMetadata` de Token-2022 funciona en esta cadena                  | RF-02                | Crear un mint de prueba en fase 2        |
| 5   | Orden y `limit` máximo de `getTokenAccounts` en la DAS                                 | RF-04                | Probar al implementar RF-04              |

---

## 2026-09-08 · Erratas del PRD detectadas al implementar

### ❌ RT-02 se equivoca sobre los chain id aceptados

El PRD (RT-02) y la primera versión de `CLAUDE.md` afirman que `walletSigner({ chain })` **solo acepta** `solana:mainnet | solana:devnet | solana:testnet | solana:localnet`. **Es falso.** El tipo instalado (`@solana/kit-plugin-wallet` 0.19.0, `types.d.ts`) es:

```ts
chain: SolanaChain | (IdentifierString & {});
```

La documentación del propio campo dice que acepta «any wallet-standard `IdentifierString` shape (`${string}:${string}`) for custom chains or non-Solana L2s» y que el comportamiento en runtime es **chain-agnostic**. El error vino de tomar la lista "Chain Identifiers" del skill `solana-dev` como si fuera el tipo completo, cuando solo enumeraba los literales de `SolanaChain`.

**Consecuencias:**

- Cookie Chain **puede** tener identificador propio (p. ej. `cookie:mainnet`) y sería válido pasarlo. La spike RF-01.1 debe anotar el valor real, no elegir entre cuatro.
- La validación de `VITE_WALLET_CHAIN` valida **forma**, no lista cerrada (RF-01.2 corregido en consecuencia).

**Lo que sí se confirma**, y sigue siendo el riesgo principal: el descubrimiento filtra por `uiWallet.chains.includes(chain)`, así que un valor que ninguna wallet anuncia da **lista vacía sin error**. Modo de fallo adicional no documentado en el PRD: las cuentas que no pueden producir signer para esa cadena resuelven a `signer: null` en lugar de lanzar.

> **Pendiente:** corregir RT-02 en `docs/prds/PRD-cookie-bakery.md`. No se toca durante la ejecución del plan (la skill `execute-plan` lo prohíbe); hacerlo al cerrar RF-01.

### ✅ INCÓGNITA #1 RESUELTA — `VITE_WALLET_CHAIN=solana:mainnet`

Spike RF-01.1 ejecutada en Chrome con las extensiones reales instaladas, enumerando el **registro Wallet Standard crudo** (`getWallets()` de `@wallet-standard/app`) en lugar de `useWallets(client)`, que filtra por cadena y habría ocultado justo lo que buscábamos.

**12 wallets detectadas** (una entrada por wallet y ecosistema). Lo que anuncia Nightly:

| Entrada de Nightly | `chains`                                                                   |
| ------------------ | -------------------------------------------------------------------------- |
| **Solana**         | `solana:mainnet`, `solana:mainnet-beta`, `solana:testnet`, `solana:devnet` |
| Aptos              | `aptos:devnet`, `aptos:testnet`, `aptos:mainnet`                           |
| IOTA               | `iota:devnet`, `iota:testnet`, `iota:mainnet`                              |
| Cedra              | `cedra:devnet`, `cedra:testnet`, `cedra:mainnet`                           |
| Sui                | `sui:mainnet`                                                              |

**Conclusión: no existe identificador propio de Cookie Chain.** Ninguna wallet anuncia `cookie:*` ni nada específico de la cadena. Cookie Chain se direcciona como Solana, así que `solana:mainnet` es el valor correcto — y es el que ya tenía `.env.example`.

**Por qué `solana:mainnet` y no `solana:mainnet-beta`:** Nightly anuncia ambos, pero `mainnet-beta` **solo lo anuncia Nightly**; Phantom, MetaMask y OKX no. Usarlo filtraría fuera al resto de wallets sin ningún beneficio. Con `solana:mainnet` el descubrimiento devuelve las cuatro.

**Verificado en la app real** (`npm run dev`, sin `?probe`): la lista muestra Phantom, MetaMask, OKX Wallet y **Nightly**; `WalletReadyGate` resuelve a `DISCONNECTED` sin parpadeo y la consola sale limpia (sin errores ni warnings).

**Hallazgo colateral relevante para RT-03.1:** la entrada Solana de Nightly expone **ambas** features:

```
solana:signTransaction        ← el camino de solo-firma que necesitamos
solana:signAndSendTransaction ← el que enviaría por SU rpc
```

Que `solana:signTransaction` esté disponible confirma que el camino de firma pura es viable con Nightly. **Sigue sin verificarse cuál de las dos elige `walletSigner`** — eso es la incógnita #2 y necesita una tx real.

> Nota: `accounts: 0` en la entrada Solana de Nightly (no conectada). Sus entradas de Aptos y Cedra sí traen `accounts: 1`, o sea que la extensión está desbloqueada y funcionando.

### ⚠️ `@solana-program/token-2022` marcado como deprecated

Al instalar, npm avisó: `@solana-program/token-2022@0.7.0: This package has been deprecated`. Es un paquete que RT-01 nombra y que RF-02 necesita. Llegó como dependencia transitiva, no directa. **Sin investigar todavía** — resolver cuál es el sustituto antes de empezar RF-02.
