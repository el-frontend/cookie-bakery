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

| #   | Incógnita                                                                                              | Bloquea    | Cómo se resuelve                             |
| --- | ------------------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------- |
| 1   | ~~Valor correcto de `VITE_WALLET_CHAIN`~~ **RESUELTA** → `solana:mainnet`                              | ~~RF-01~~  | Cerrada por la spike RF-01.1 (ver abajo)     |
| 2   | ~~Si `client.sendTransaction` delega en `signAndSendTransactions` (RT-03.1)~~ **RESUELTA** → no delega | ~~todo~~   | Cerrada leyendo el código de Kit (ver abajo) |
| 3   | ~~Si Nightly firma con blockhash de Cookie Chain (RT-03.2)~~ **RESUELTA** → sí firma                   | ~~RF-02+~~ | Cerrada con una tx real firmada (ver abajo)  |
| 4   | Si la extensión `TokenMetadata` de Token-2022 funciona en esta cadena                                  | RF-02      | Crear un mint de prueba en fase 2            |
| 5   | Orden y `limit` máximo de `getTokenAccounts` en la DAS                                                 | RF-04      | Probar al implementar RF-04                  |

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

> ✅ **Corregido** en el PRD v1.1.1 al cerrar RF-01. Durante la ejecución del plan no se tocó (la skill `execute-plan` lo prohíbe), por eso quedó registrado aquí primero.

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

### ✅ FALSA ALARMA — `@solana-program/token-2022` no está deprecado

Al instalar, npm avisó: `@solana-program/token-2022@0.7.0: This package has been deprecated`. Investigado:

| Comprobación                                            | Resultado                          |
| ------------------------------------------------------- | ---------------------------------- |
| `npm view @solana-program/token-2022@0.7.0 deprecated`  | `This package has been deprecated` |
| `npm view @solana-program/token-2022@0.16.1 deprecated` | (vacío — **no** deprecada)         |
| `dist-tags.latest`                                      | `0.16.1`                           |
| ¿Sigue en `package-lock.json`?                          | **No**, cero coincidencias         |

La **0.7.0** llegaba como dependencia transitiva de framework-kit (`@solana/client` / `@solana/react-hooks`). Al quitar framework-kit en RF-01.3 desapareció del árbol por completo. La versión vigente **no está deprecada**.

**Para RF-02:** instalar `@solana-program/token-2022@^0.16.1` como dependencia directa. Nada que sustituir; el aviso era ruido heredado del stack antiguo.

### ✅ INCÓGNITA #2 RESUELTA (RT-03.1) — la wallet solo firma; enviamos nosotros

**El riesgo nº 1 del proyecto queda cerrado.** Verificado con Nightly conectada de verdad (cuenta `6MGLK3tStEZcJJdPRhMAMsKUG1z6EUVUKv3yVMVTzRQa`) más lectura del código de las librerías instaladas.

**1. El signer que instala Nightly es de los peligrosos — expone ambas capacidades:**

```jsonc
{
  "address": "…",
  "modifyAndSignTransactions": "fn", // ← firma y devuelve
  "signAndSendTransactions": "fn", // ← enviaría por SU rpc
  "modifyAndSignMessages": "fn",
}
```

Es simultáneamente `TransactionModifyingSigner` y `TransactionSendingSigner`, y ocupa los roles `payer` **e** `identity` (mismo objeto). Sobre el papel, exactamente el escenario que temía RT-03.

**2. Pero Kit nunca invoca la vía de envío.** Dos comprobaciones encadenadas:

`@solana/kit-plugin-rpc` (0.19.0) solo usa estos dos helpers — `signAndSendTransactionMessageWithSigners` no aparece por ninguna parte:

```
2  partiallySignTransactionMessageWithSigners
2  signTransactionMessageWithSigners
0  signAndSend*
```

Y en `@solana/signers`, la vía de firma **desactiva explícitamente** la detección de sending signers:

```js
async function partiallySignTransactionMessageWithSigners(msg, config) {
  const { partialSigners, modifyingSigners } = categorizeTransactionSigners(
    deduplicateSigners(getSignersFromTransactionMessage(msg).filter(isTransactionSigner)),
    { identifySendingSigner: false }, // ← aquí está la garantía
  );
  …
}
```

Con `identifySendingSigner: false`, un signer que tenga ambas capacidades se clasifica como **modifying signer** y se firma por `modifyAndSignTransactions`. Su `signAndSendTransactions` no se llama jamás en este camino.

**Cadena completa:** `client.sendTransaction` → planner → `partiallySignTransactionMessageWithSigners` (sending detection off) → `modifyAndSignTransactions` de Nightly (solo firma) → el executor envía por **nuestro** `rpcUrl`.

**Conclusión: el stack de RT-01 cumple RT-03 por diseño y no hace falta bajar al pipeline manual de `@solana/kit`.** El fallback documentado en RT-03 sigue siendo válido como plan B, pero no se necesita.

> Pendiente RT-03.2: que Nightly **acepte firmar** un blockhash de Cookie Chain en lugar de rechazarlo. Ojo: firmar no cuesta COOK — solo aterrizar la tx lo cuesta. Se puede resolver sin fondos intentando una transferencia mínima: si Nightly firma y el envío falla con "insufficient funds" **devuelto por rpc.cookiescan.io**, quedan probadas las dos cosas a la vez (que firma, y que la tx salió por nuestro RPC y no por el suyo).

### ✅ INCÓGNITA #3 RESUELTA (RT-03.2) — Nightly firma para Cookie Chain

**RT-03 queda cerrado por completo.** Probado con una transacción real firmada por Nightly (cuenta `6MGLK3tStEZcJJdPRhMAMsKUG1z6EUVUKv3yVMVTzRQa`, saldo 0). Transferencia mínima a uno mismo; no se movió nada y el saldo sigue en 0.

Firma obtenida:

```
4BEoRsMQ9qdz4wXc4nEopQGv7dMFAceTBtRySZM8KTKWtbGMzuUxgRgmC4ieKDjfuAee4iNJqDvz12sqXXHXs9pD
```

Que exista firma prueba lo que hacía falta: **Nightly no rechaza un blockhash de Cookie Chain.** Levanta su UI de aprobación normal, con cuenta y fee, y firma.

Y el error de vuelta prueba la otra mitad:

```jsonc
{
  "__code": 1, // blockhash expirado
  "currentBlockHeight": "23578836n",
  "lastValidBlockHeight": "23578835n",
}
```

Esas alturas de bloque son las de **Cookie Chain** (~23,5 M, coherente con el `getSlot` del sondeo). Si la tx hubiera salido por el RPC de Nightly hacia Solana mainnet, las alturas estarían en cientos de millones. **La firma la hace la wallet; el envío sale por nuestro RPC.**

#### ⚠️ Hallazgo operativo: el blockhash caduca mientras el humano aprueba

La tx no falló por fondos: falló por **un solo bloque** de diferencia (`23578836` vs `lastValid 23578835`). El tiempo que tarda una persona en leer y aprobar el prompt de la wallet **se come la ventana de validez del blockhash**.

Consecuencias directas:

- **RF-05.3** (reintento único ante `blockhash-expired`) sube de "por si acaso" a **camino habitual**. Sin él, el primer intento de cualquier usuario que lea el prompt fallará.
- **RF-03.7** (airdrop por lotes): con N firmas seguidas, los últimos lotes son los que más riesgo tienen. Refuerza pedir blockhash lo más tarde posible y reintentar por lote.
- Merece medir la ventana real de Cookie Chain al implementar RF-05.

#### Nota de método

Con saldo 0 la wallet **no llega a que le pidan firmar**: `solanaRpc` simula antes para estimar límites de recursos, y la simulación falla con `Attempt to debit an account but found no record of a prior credit` (código `7050003`) — devuelto por rpc.cookiescan.io, otra confirmación de que las lecturas van a nuestra cadena. Para forzar el paso de firma hubo que desactivar temporalmente `skipPreflight` y `transactionConfig.estimateResourceLimits`. **Ya revertido**; el cliente vuelve a simular antes de firmar, que es justo lo que pide el PRD §0.8.

> Bonus: que `solanaRpc` simule antes de firmar cubre gratis el requisito "simula antes de firmar" del PRD. La UI de RF-02.5 solo tiene que mostrar el resultado.

### 🧹 Probe de cadena retirada

`src/dev/ChainProbe.tsx` y el `?probe` de `main.tsx` se eliminaron una vez fijado `VITE_WALLET_CHAIN`: eran artefactos de desarrollo que se colaban en el bundle de producción. Si Cookie Chain publicase algún día identificador propio y hubiera que repetir el sondeo, están en el historial de git:

```bash
git show 555f918 -- src/dev/ChainProbe.tsx
```

La idea clave a conservar si se rehace: enumerar con `getWallets()` de `@wallet-standard/app` (registro **crudo**), nunca con `useWallets(client)`, que filtra justo por la cadena que se quiere descubrir.
