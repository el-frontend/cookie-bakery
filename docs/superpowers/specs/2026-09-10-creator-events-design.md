# Diseño — Eventos de airdrop para creadores de contenido

**Fecha:** 10 sep 2026 · **Autor:** Carlos Chao (con Claude Code) · **Estado:** propuesta, pendiente de aprobación
**PRD base:** [docs/prds/PRD-cookie-bakery.md](../../prds/PRD-cookie-bakery.md)

---

## 1. Qué problema resuelve

Hoy un airdrop en Cookie Bakery empieza por un CSV que el creador tiene que fabricar a mano. Ahí es donde la herramienta deja de ser útil: nadie tiene una lista de `address,amount` de su comunidad.

Este diseño añade la pieza que falta. El creador **abre un evento**, comparte un link, **sus seguidores se registran ellos mismos**, y dentro del evento el creador dispone de herramientas para repartir: un **sorteo verificable** y un **envío manual**. La lista deja de ser un problema del creador y pasa a construirla la propia audiencia.

El referente de producto es el sorteo de un streamer, no la distribución de un token de un proyecto.

### El hueco, verificado

La investigación de apps comparables (10 sep 2026) da un resultado claro:

- **Herramientas de airdrop serias** — [Streamflow](https://streamflow.finance/) (hasta 1M de destinatarios, portal de claim, vesting), [Helius Airship](https://www.helius.dev/blog/solana-airdrop) (compresión ZK, 10k wallets por 0,01 SOL), Metaplex Gumdrop. Todas sirven a **proyectos**, no a creadores: no hay evento, no hay registro, no hay momento en directo. Y todas usan modelo **claim**, que exige un programa on-chain propio.
- **Herramientas de sorteo para streamers** — [StreamerGiveaway](https://streamergiveaway.org/), [WheelOrbit](https://wheelorbit.com/twitch-wheel-spinner), [FairPick](https://fairpick.app/for/streamers), [SpinWheelNames](https://spinwheelnames.com/creator/live-stream-giveaway-wheel). El patrón está maduro: entrada por comando de chat, overlay en vivo, rueda como browser source de OBS. **Ninguna paga nada.** Eligen un nombre; el premio lo manda el creador después, por fuera.
- **Plataformas de quests** — [Galxe, Zealy, Layer3](https://vuk.digital/web3-quest-platforms/). Backends centralizados, anti-sybil vía APIs sociales, adopción masiva, cero polémica.
- **Sorteos verificables** — [Rafli](https://www.coingecko.com/learn/rafli-online-raffles-fair-verifiable-fraud-proof), [OnChainWin](https://onchainwin.com/). La categoría existe porque el fallo por defecto es "el host anunció un ganador y nadie puede comprobarlo". Técnica estándar: commit-reveal. Las fuentes avisan de [no usar un blockhash aislado como aleatoriedad](https://solana.garden/guides/provably-fair-dice/) porque es manipulable.

**Conclusión:** el hueco es la unión de las dos primeras categorías. Cookie Bakery sería la rueda **y** el pago en el mismo clic.

**Consecuencia técnica:** el modelo _claim_ no está disponible (el PRD prohíbe programas propios y Cookie Chain no tiene un merkle distributor desplegado), así que se mantiene el modelo **push** que ya existe. Es la decisión correcta para el tamaño real: decenas o cientos de personas, no decenas de miles.

---

## 2. Decisiones que este documento cambia

Este spec **deroga** cuatro puntos del PRD §1.5 ("No-objetivos v1"), por decisión explícita del autor:

| PRD §1.5 decía       | Ahora                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Sin backend/servidor | **Supabase** (Postgres + Auth + RLS). Sin Edge Functions.                                 |
| Sin base de datos    | **Postgres**, para eventos, registros, sorteos y pagos                                    |
| Sin autenticación    | **Sign-In-With-Solana** — la wallet del creador _es_ la cuenta                            |
| Sin mobile-first     | La página de registro (`/e/:slug`) **es** mobile-first. El resto sigue siendo escritorio. |

**Lo que NO cambia, y es el núcleo:** RT-03 sigue intacto. **La wallet solo firma; la app envía.** Ninguna clave privada toca el servidor, ninguna transferencia sale de una wallet nuestra.

### Por qué la parte centralizada es defendible

La objeción de la comunidad blockchain nunca es "hay un servidor" — es **custodia, censura y afirmaciones incomprobables**. Tres hechos:

1. **La app ya dependía de infraestructura centralizada.** `rpc.cookiescan.io` y `api.cookiescan.io` son endpoints únicos de un tercero. "100 % cliente" nunca significó _trustless_; significó "sin servidor nuestro".
2. **El precedente es la norma.** Galxe, Zealy, Layer3, Streamflow: toda la categoría corre sobre backends centralizados.
3. **La wallet es la cuenta.** Con [SIWS](https://supabase.com/docs/guides/auth/auth-web3) no montamos un sistema de identidad paralelo; emitimos una sesión para una identidad que ya es de la cadena. Sin email, sin contraseña.

### Las cinco reglas duras

No son buenas intenciones. Son restricciones del diseño, y cada una tiene su verificación en §9.

1. **Ninguna clave privada en el servidor.** La wallet del creador firma cada transferencia.
2. **Cero custodia de fondos.** No existe wallet de escrow. El token va de la wallet del creador a la del seguidor, directo. En el momento en que retengamos tokens, la crítica pasa a tener razón.
3. **El servidor no es la fuente de verdad del dinero.** Supabase guarda la _intención_ (eventos, registros, ganadores). La cadena guarda _lo que pasó_. Si Supabase desaparece, los airdrops pasados siguen íntegros y comprobables en CookieScan.
4. **Exportable siempre.** Un botón: evento + registros + resultados en CSV/JSON. Sin lock-in.
5. **El sorteo es verificable por cualquiera.** Un servidor que elige ganadores es una afirmación incomprobable. Ver §5.

### Dónde la crítica sí sería justa

La lista de registros es un **honeypot**: handle + wallet, por creador, es un dataset de desanonimización. Mitigación en §4.3 y §5.4. No se guarda nada que no se necesite: ni emails, ni IPs más allá de lo que registre Supabase.

---

## 3. Arquitectura: dos superficies

Hay dos audiencias con necesidades opuestas, y deben ser dos superficies, no una UI con condicionales.

|             | Creador                             | Seguidor                            |
| ----------- | ----------------------------------- | ----------------------------------- |
| Ruta        | `/` → sección `events`              | `/e/:slug`                          |
| Shell       | El de siempre (TopBar, footer, nav) | Ninguno                             |
| Auth        | SIWS obligatorio                    | Ninguno en el slice; social después |
| Dispositivo | Escritorio                          | **Móvil**                           |
| Trabajo     | Crear evento, sortear, pagar        | Dar una dirección y marcharse       |

**La página de registro es la única pantalla de todo el proyecto que se abrirá en un teléfono**, con el stream en la otra mano. Si no funciona en móvil, el evento no tiene entradas. Eso la convierte en un requisito no funcional propio, no en un detalle estético.

### Enrutado

`App.tsx` es hoy un `switch` sobre `section`, sin router. Se añade un **split por path en la raíz de `main.tsx`**: si `location.pathname` empieza por `/e/`, se monta la app pública; si no, el shell actual. No se introduce `react-router` para dos rutas. `vercel.json` ya trae el rewrite SPA, así que las rutas profundas funcionan sin cambios.

**La superficie pública es su propio chunk lazy.** El seguidor no debe descargar Recharts ni el launcher para pegar una dirección. Es el mismo razonamiento que ya aplica a `HoldersChart` (ver CLAUDE.md § Bundle), y hay que medirlo igual.

### Rutas nuevas

- `/e/:slug` — registro (pública, mobile-first)
- `/e/:slug/verify` — verificador del sorteo (pública, recalcula en el navegador)
- sección `events` — panel del creador

---

## 4. Modelo de datos

Migraciones en `supabase/migrations/*.sql`. Antes de escribirlas, cargar los skills `supabase:supabase` y `supabase:supabase-postgres-best-practices`.

### 4.1 Tablas

```sql
create type event_status as enum ('draft', 'open', 'closed', 'paid');
create type draw_status  as enum ('committed', 'revealed', 'abandoned');

-- Nombre público del creador. auth.users es la cuenta; esto es lo que se muestra.
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null,
  display_name   text,
  created_at     timestamptz not null default now()
);

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique,
  title         text not null,
  mint          text not null,
  mint_decimals smallint not null,
  mint_symbol   text,
  status        event_status not null default 'draft',
  entry_count   integer not null default 0,
  opened_at     timestamptz,
  closed_at     timestamptz,
  created_at    timestamptz not null default now()
);

create table public.entries (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  wallet_address  text not null,
  social_provider text,
  social_handle   text,
  created_at      timestamptz not null default now(),
  unique (event_id, wallet_address)
);

-- Una cuenta social = una entrada. Índice parcial porque user_id es null en el slice.
create unique index entries_event_user_uniq
  on public.entries (event_id, user_id) where user_id is not null;

-- Append-only (ver 4.3c). La política de INSERT exige que el evento esté
-- en `closed`: sobre `open` entrarían inscripciones tras congelar la lista
-- y el `entries_root` publicado dejaría de cuadrar.
create table public.draws (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  winners_count     integer not null check (winners_count > 0),
  amount_per_winner numeric(39,0) not null check (amount_per_winner > 0),
  seed_commit       text not null,          -- SHA-256 hex de la semilla
  target_slot       bigint not null,        -- slot futuro que dará la entropía
  entry_hashes      text[] not null,        -- compromisos publicados, orden canónico
  entries_root      text not null,          -- SHA-256 de la lista concatenada
  chain_blockhash   text,                   -- se rellena al revelar
  revealed_seed     text,                   -- hex, se rellena al revelar
  winner_entry_ids  uuid[],
  status            draw_status not null default 'committed',
  commit_signature  text,                   -- tx memo del commit
  commit_slot       bigint,                 -- slot en que aterrizó esa tx
  reveal_signature  text,                   -- tx memo del reveal
  created_at        timestamptz not null default now()
);

-- La semilla, legible SOLO por el creador dueño. Separada para que `draws`
-- pueda ser de lectura pública sin filtrarla.
create table public.draw_secrets (
  draw_id uuid primary key references public.draws(id) on delete cascade,
  seed    text not null
);

-- Espejo de la verdad on-chain. Si discrepa con la cadena, manda la cadena.
create table public.payouts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  draw_id    uuid references public.draws(id) on delete set null,
  entry_id   uuid not null references public.entries(id) on delete cascade,
  amount     numeric(39,0) not null check (amount > 0),
  signature  text,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);
```

**Gotcha de tipos:** `numeric(39,0)` guarda cantidades en unidades base sin pérdida, pero `supabase-js` las devuelve como **string**. Convertir a `bigint` en el cliente, nunca a `number` — es el mismo error que dividir por `1e9`, que el PRD ya prohíbe.

**Tope:** máximo 1.000 entradas por evento, igual que el tope de filas de CSV de RF-03. Con 1.000 entradas, `entry_hashes` pesa ~64 KB por sorteo; aceptable.

### 4.2 El anti-sybil vive en Postgres

`unique (event_id, wallet_address)` y el índice parcial sobre `(event_id, user_id)`. **Una restricción de base de datos no se salta con un bug de UI ni llamando a la API a mano.** El login social se apoya en el índice de usuario; la restricción de wallet ya sirve por sí sola en el slice.

### 4.3 RLS: nadie enumera la lista excepto el creador

Es la mitigación del honeypot y la única frontera de seguridad del sistema. RLS activado en todas las tablas, sin excepción.

| Tabla          | `anon`                                         | Seguidor autenticado          | Creador dueño                                                                |
| -------------- | ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `events`       | SELECT si `status <> 'draft'`                  | idem                          | ALL                                                                          |
| `entries`      | **INSERT** en evento `open`; **ningún SELECT** | INSERT; SELECT solo la propia | SELECT/UPDATE/DELETE las de sus eventos                                      |
| `draws`        | SELECT (todo, para verificar)                  | idem                          | INSERT si el evento está `closed`; UPDATE solo para revelar. **Sin DELETE.** |
| `draw_secrets` | nada                                           | nada                          | SELECT/INSERT las suyas                                                      |
| `payouts`      | nada                                           | nada                          | ALL las de sus eventos                                                       |
| `profiles`     | SELECT `display_name`                          | idem                          | ALL la propia                                                                |

Tres consecuencias de diseño que hay que resolver, no ignorar:

**a) El contador público.** Si `anon` no puede leer `entries`, no puede hacer `count`. Así que `events.entry_count` lo mantiene un **trigger** `after insert on entries`. Es la única forma de mostrar "312 registrados" sin abrir la lista.

**b) El seguidor no puede leer su propia entrada en el slice.** Sin login social no hay `auth.uid()`, así que no hay política de SELECT que le aplique. El `INSERT` se hace con `Prefer: return=minimal`, el éxito se pinta desde el estado del cliente, y la revisita se detecta con `localStorage`. Si limpia el navegador y reintenta, choca con la restricción única — y **ese error es la respuesta correcta**: "esta wallet ya está registrada en el evento". El error es la función.

**c) `draws` es append-only.** Sin política de DELETE, y el verificador lista **todos** los sorteos, incluidos los `abandoned`. Es lo que cierra el ataque de re-tirada (§5.2).

---

## 5. El sorteo verificable

### 5.1 Por qué no hace falta servidor

La semilla la genera el **navegador del creador**, que publica `commit = SHA256(semilla)` y guarda la semilla en `draw_secrets`, legible solo por él. No hace falta ninguna Edge Function: solo Postgres, RLS y auth.

Y el relato de confianza queda en su sitio: **el que promete es el creador ante su audiencia, no nosotros.** No hay que confiar en Cookie Bakery para creer el sorteo.

### 5.2 El agujero, y el arreglo

**El agujero.** El creador conoce la semilla desde el principio. Si la entropía fuera el blockhash del instante de cerrar, podría ir comprobando "si cierro ahora, ¿quién gana?" y cerrar cuando le convenga. _Grinding._

**El arreglo.** La entropía no sale del bloque actual, sino de un **slot futuro**. Al crear el sorteo se fija `target_slot = slot_actual + 150` (≈1 minuto). Ese hash **no existe todavía**, así que no hay nada que tantear.

En directo eso no es una espera, es el redoble: _"el sorteo usa el hash del bloque 12.345.678, que Cookie Chain aún no ha producido; en cuanto salga, giramos"_.

**El ataque residual: la re-tirada.** El creador podría crear el sorteo, esperar el bloque, ver que no le gusta el resultado y crear otro. Lo cierra §4.3(c): `draws` es append-only, los abandonados quedan visibles con su commit y su slot, y el verificador los lista. Re-tirar es posible pero **públicamente visible** — que es la defensa honesta de cualquier commit-reveal.

### 5.3 Algoritmo

Precondición: **un sorteo solo se puede crear sobre un evento en `closed`.** Si se permitiera sobre `open`, entrarían inscripciones después de congelar la lista y el `entries_root` publicado dejaría de cuadrar.

1. **Commit.** El creador fija monto y número de ganadores. El navegador genera 32 bytes aleatorios (`crypto.getRandomValues`), calcula `commit = SHA256(semilla)`, congela la lista de entradas y fija `target_slot = getSlot() + 150` (≈1 min, a ~400 ms por slot). Se escribe la fila de `draws` y se manda una **tx memo obligatoria** con `commit | target_slot | entries_root`.
2. **Espera.** Hasta que Cookie Chain produzca `target_slot`.
3. **Reveal.** `final = SHA256(semilla || blockhash)`. Fisher–Yates determinista sobre la lista de hashes en orden canónico. Los primeros `winners_count` son los ganadores.
4. **Publicación.** Se escriben semilla, blockhash y ganadores, y se manda la segunda **tx memo** con el resultado.

### 5.3.1 Qué hace verificable el orden temporal

**Corrección importante sobre una intuición equivocada:** el commit **no** es anterior a las entradas, y no necesita serlo. El creador ve la lista antes de elegir la semilla. Podría intentar buscar una semilla que favorezca a alguien — pero para cualquier semilla, los ganadores siguen dependiendo de un blockhash que todavía no existe. Buscar semilla es inútil.

Lo que el commit sí garantiza, y es lo único que hace falta: que la semilla estaba **fijada antes de conocerse la entropía**. Y eso se comprueba **on-chain, sin confiar en los timestamps de Supabase**:

> la tx memo del commit aterrizó en un slot estrictamente menor que `target_slot`.

Ambos números son públicos y comprobables en CookieScan. Por eso la tx memo del commit es obligatoria y no decorativa: es el reloj de confianza del sistema.

### 5.3.2 Definiciones exactas

El verificador tiene que dar el mismo resultado bit a bit, así que aquí no cabe ambigüedad:

- **`semilla`** = 32 bytes crudos de `crypto.getRandomValues`. Se guarda y publica en **hex minúsculas**; `commit = SHA256(bytes_crudos)`, también hex.
- **`final`** = `SHA256(semilla_bytes || utf8(blockhash_base58))`. El blockhash entra como **su string base58**, el mismo que se lee en CookieScan, no como sus 32 bytes decodificados. Así alguien puede verificar a mano con lo que ve en el explorador.
- **`hashEntry`** = `SHA256(utf8(event_id) || 0x00 || utf8(wallet_address))`, en hex minúsculas. El byte separador impide colisiones por concatenación.
- **Orden canónico** = los hashes hex ordenados **lexicográficamente ascendente**. Nunca el orden de inserción, o el servidor podría reordenar para mover el resultado.
- **`entries_root`** = `SHA256(utf8(h_0 || "\n" || h_1 || "\n" || … || h_n-1))` sobre la lista ya ordenada, sin salto final.
- **Flujo de aleatoriedad** = `SHA256(final || u32be(contador))`, con `contador` desde 0, concatenando bloques de 32 bytes según se consuman.
- **Índices sin sesgo** = para elegir en `[0, n)` se leen 4 bytes como entero sin signo y se aplica **rechazo por muestreo**: se descarta cualquier valor `>= floor(2^32 / n) * n` y se lee el siguiente. Usar módulo directo introduciría sesgo, y un sorteo con sesgo no es un sorteo justo — es precisamente lo que este diseño promete evitar.
- **Fisher–Yates** = hacia atrás, `for i = n-1 … 1`, intercambiando con un índice `j` en `[0, i]`.

### 5.3.3 Qué comprueba el verificador

1. `SHA256(semilla) == commit`.
2. La tx memo del commit aterrizó en un slot `< target_slot`.
3. `blockhash` es el real de `target_slot` en CookieScan.
4. `entries_root` cuadra con la lista publicada, y la lista está en orden canónico.
5. Rehaciendo el shuffle salen exactamente los mismos ganadores.

### 5.4 Verificable sin desanonimizar

Hay una tensión real: **verificar exige publicar la lista de participantes; proteger a la gente exige no publicar el par handle→wallet.**

Se resuelve publicando la lista **como compromisos**: cada entrada es `SHA256(event_id || wallet_address)`. El sorteo corre sobre esos hashes.

- Cualquiera verifica que fue un reparto limpio sobre N compromisos.
- Cada participante verifica **su propia** inclusión: conoce su wallet, calcula su hash, lo busca en la lista.
- Los ganadores se anuncian por handle (o por dirección truncada en el slice).
- **Nadie aprende el mapa de quién es qué wallet.**

El `event_id` en el hash es el salt: impide cruzar listas entre eventos para detectar que la misma wallet participó en varios.

### 5.5 Limitaciones declaradas

Van en el spec y en la UI, no escondidas:

- **Esto no es VRF.** Un validador que produzca el bloque `target_slot` tiene influencia marginal sobre el resultado. Para un sorteo de comunidad basta; no se venderá como algo que no es.
- **El creador puede inflar su propia lista.** Nada le impide registrarse muchas veces con wallets distintas desde la página pública antes de cerrar. El sorteo seguiría siendo matemáticamente limpio sobre una lista contaminada. Mitigación parcial: el contador es público y en vivo durante el registro, y cada participante puede verificar su inclusión. No es hermético, y el login social de fase 2 solo lo encarece, no lo cierra. **Esta herramienta hace verificable el sorteo, no la honestidad del creador.**
- **La verificación a futuro depende de que el RPC conserve historia.** Si `rpc.cookiescan.io` poda, el blockhash pasado solo queda atestiguado en la tx memo. Ver spike §8.2.

---

## 6. Los flujos

### 6.1 El creador

1. Entra en `events`, firma SIWS. La wallet es la cuenta; si es la primera vez se crea su `profile`.
2. **Nuevo evento:** título, token (del selector de "Mis tokens" que ya existe, o pegando un mint), slug. Estado `draft`.
3. **Abrir registro** → `status = 'open'`. Aparece el link `/e/:slug` y su QR, para pegar en el chat o mostrar en pantalla.
4. Ve entrar las inscripciones en vivo.
5. **Cerrar registro** → `status = 'closed'`.
6. Reparte, con las tres herramientas de §6.3.
7. **Exporta** el evento cuando quiera.

### 6.2 El seguidor

Abre `/e/:slug` en el móvil. Ve el token, el creador y cuánta gente hay dentro. Pega su dirección de Cookie Chain — o conecta la wallet si está en escritorio — y confirma. Listo.

**No le cuesta nada: ni gas, ni COOK, ni firma.** Toda la familia de errores de saldo desaparece de esa pantalla.

### 6.3 Las herramientas del evento

1. **Sorteo (ruleta)** — monto por ganador y cuántos. El de §5.
2. **Envío manual** — casilla por fila, monto, enviar a los seleccionados.
3. **Reparto a todos** — mismo monto a cada registrado, o un bote dividido entre todos.

La tercera se incluye porque es el mismo motor y sale gratis.

---

## 7. Reutilización: dónde está el regalo

El sorteo produce wallets ganadoras → `{ address, amount }[]` → **que es exactamente la forma que ya devuelve `parseCsv`**.

Así que `validateRows`, `mergeDuplicates`, `probeAtas`, `sourceAccount`, `buildPlan` y `executor` funcionan **sin tocar una línea**: batching, simulación previa, firma, progreso por lote, pausa, reintento y export de resultados ya existen y están testeados.

**El evento es, simplemente, otra fuente de la lista de destinatarios, junto al CSV.** Y el traspaso `events → airdrop` usa el mismo mecanismo de estado cruzado que ya existe en `App.tsx` para el "Airdrop more" del Oven. Cero arquitectura nueva.

Código realmente nuevo:

```
src/lib/supabase/client.ts        cliente único, tipado desde el esquema
src/lib/supabase/events.ts        CRUD de eventos
src/lib/supabase/entries.ts       registro y lectura de entradas
src/lib/draw/hashEntry.ts         SHA256(event_id || wallet)
src/lib/draw/shuffle.ts           Fisher-Yates determinista
src/lib/draw/runDraw.ts           commit / reveal
src/lib/draw/verifyDraw.ts        verificación independiente
src/lib/draw/toRecipients.ts      EL ADAPTADOR: ganadores -> filas de airdrop
src/app/Events.tsx                panel del creador
src/public/Register.tsx           /e/:slug        (chunk aparte)
src/public/Verify.tsx             /e/:slug/verify (chunk aparte)
supabase/migrations/*.sql
```

Las lecturas van por **SWR**, no TanStack, para respetar la regla de un solo sistema de caché (CLAUDE.md § Stack).

**Dependencias nuevas:** `@supabase/supabase-js` en runtime; CLI de Supabase en desarrollo, para los tests de RLS.

**Variables de entorno nuevas:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. El CSP de `vercel.json` ya permite `connect-src 'self' https: wss:`, así que Supabase entra sin cambios — conviene apretarlo a hosts concretos más adelante, pero no bloquea.

---

## 8. Spikes previas

El diseño depende de tres cosas que no se pueden dar por buenas.

### 8.1 SIWS con Nightly

`supabase.auth.signInWithWeb3({ chain: 'solana', statement, wallet })` con la `UiWallet` que devuelve `useWallets(client)` de `@solana/kit-plugin-wallet`. Hay que comprobar que el objeto es compatible con lo que Supabase espera.

Contexto: hay [un issue abierto](https://github.com/supabase/auth/issues/2092) sosteniendo que Supabase verifica la firma cruda en vez del spec SIWS completo, y [otro](https://github.com/supabase/auth/issues/2277) de fallo con Ledger. **Tranquiliza** que la firma de login es _off-chain_, así que el identificador de cadena de Cookie Chain no interviene.

**Si falla:** el plan B es autenticar con un mensaje firmado y verificarlo nosotros, lo que sí exigiría una Edge Function. Sería el único trozo de lógica de servidor del sistema.

### 8.2 `getBlock` de un slot pasado

Confirmar que `rpc.cookiescan.io` devuelve el blockhash de un slot ya producido, y con cuánta historia hacia atrás.

**Si poda agresivamente:** la verificación a futuro se apoya solo en la tx memo, y hay que decirlo en la UI en lugar de prometer más.

### 8.3 Presupuesto de bundle de `/e/:slug`

Medir el chunk público aislado. Si arrastra el shell o el cliente de Kit completo, hay que cortarlo: esa página debe cargar en una conexión móvil mala.

---

## 9. Tests

### 9.1 Funciones puras primero

Como ya hace el repo:

- `shuffle` — tests **golden**: misma semilla + mismas entradas → mismos ganadores, siempre. Que cambiar un bit de la semilla cambia el resultado. Y una prueba de **uniformidad**: con `n` no potencia de dos, 100.000 sorteos reparten las victorias sin sesgo detectable — es la que atrapa un módulo directo en lugar del rechazo por muestreo de §5.3.2.
- `hashEntry` — vectores fijos; que el `event_id` como salt hace que la misma wallet dé hashes distintos en eventos distintos; y que el byte separador evita la colisión de concatenación (`event_id` "ab" + wallet "c" no puede igualar "a" + "bc").
- `entriesRoot` — vectores fijos, y que reordenar la lista cambia la raíz.
- `verifyDraw` — **reimplementación independiente**, no una llamada a `runDraw`. Debe rechazar los cinco fallos de §5.3.3: commit que no cuadra, tx memo del commit en un slot posterior a `target_slot`, blockhash cambiado, lista reordenada o con raíz falsa, ganador sustituido.
- `toRecipients` — que la salida valida contra `validateRows` sin cambios.

### 9.2 RLS necesita Postgres real, y eso es infra nueva

Hoy todo es jsdom + Vitest. Las políticas solo se prueban contra Postgres (`supabase start`), en un fichero de test aparte. RLS sin tests es RLS roto, y es la única frontera de seguridad del sistema. Casos mínimos:

- `anon` no puede hacer SELECT de `entries`, de ninguna forma.
- `anon` no puede insertar en un evento `draft`, `closed` ni `paid`.
- Insertar dos veces la misma wallet en el mismo evento falla.
- Un creador no lee los `entries` ni los `draw_secrets` de otro.
- Nadie puede hacer DELETE de un `draw`.
- No se puede crear un `draw` sobre un evento en `open` (la precondición de §5.3).
- Un creador no puede hacer UPDATE de `seed_commit`, `target_slot` ni `entry_hashes` de un `draw` ya creado — solo rellenar los campos del reveal. Si pudiera reescribir el commit, toda la verificación se cae.
- `entry_count` cuadra con el número real de filas tras N inserciones concurrentes.

### 9.3 Verificación de las cinco reglas de §2

- Reglas 1 y 2 — revisión de código: comprobar que ninguna ruta manda una clave ni una dirección nuestra como destino.
- Regla 3 — test: borrar la base de datos local y comprobar que el historial de `payouts` se reconstruye desde las firmas.
- Regla 4 — test del export: el CSV/JSON contiene todo lo necesario para reconstruir el evento.
- Regla 5 — §9.1, el verificador.

---

## 10. Fases

### Fase 0 — RF-07 primero (bloqueante, y bloqueado en el autor)

Deploy, mint BAKE, airdrop de prueba, capturas. **Nada de lo demás puntúa en el bounty hasta que esto exista.** Requiere una wallet con COOK.

### Fase 1 — El slice del bounty

Evento + registro público + sorteo verificable + pago por el motor actual. Incluye las tres spikes, el esquema con RLS y sus tests, y el verificador público.

**Registro solo con wallet, sin login social.**

### Fase 2 — Después del bounty

Login social (los tres proveedores OAuth), **overlay de OBS** para el sorteo, refinamientos del envío manual, sincronización de `myTokens`/`airdropHistory` (la opción C descartada por ahora), perfiles de creador.

### Por qué el login social se corta del slice

Es la mejor medida anti-sybil, y aun así se queda fuera: son tres proveedores OAuth con sus redirects y pantallas de consentimiento, y **no es lo que ve un juez en cinco minutos**. El registro solo-con-wallet se demuestra igual, `unique (event_id, wallet_address)` ya es una respuesta honesta para v1, y el login social entra después detrás de la misma tabla `entries` **sin migrar nada del flujo**.

### Por qué el overlay de OBS se corta, pese a ser el hallazgo de la investigación

Es lo que separa esto de las herramientas existentes, y hay que construirlo. Pero es una superficie más (una tercera ruta, con su propio presupuesto de render y sus propias pruebas en OBS), y el sorteo se demuestra en vídeo sin él. Va a fase 2 con prioridad alta.

---

## 11. Riesgos

| Riesgo                          | Impacto                                        | Mitigación                                                  |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Fase 0 no se cierra a tiempo    | El bounty no puntúa, con o sin esta capa       | Fase 0 va primero, y es lo único que no puede esperar       |
| SIWS no funciona con Nightly    | Hace falta una Edge Function                   | Spike §8.1 antes de construir nada                          |
| El RPC poda historia de bloques | La verificación a futuro se debilita           | Spike §8.2; la tx memo como respaldo                        |
| Fuga de la lista de registros   | Desanonimización de la audiencia de un creador | RLS con tests (§9.2); compromisos en vez de pares (§5.4)    |
| Un creador re-tira el sorteo    | Sorteo injusto                                 | `draws` append-only y verificador que lista los abandonados |
| La app pública crece de peso    | El seguidor móvil no llega a registrarse       | Chunk aparte con presupuesto medido (§8.3)                  |
| Supabase caído                  | Se degrada la capa de eventos                  | Por diseño: Bake, Airdrop y Oven siguen funcionando         |

---

## 12. Fuera de alcance

- Claim en vez de push (exige programa on-chain propio; prohibido por el PRD)
- Envío a gente sin wallet, estilo [TipLink](https://tiplink.io/) — es infra de Solana mainnet, no existe en Cookie Chain
- Integración con APIs de Twitch o YouTube (el autor eligió explícitamente ser agnóstico de plataforma)
- Puntos acumulables entre eventos, rachas, temporadas
- Vesting, condiciones o ventanas de claim
- Cualquier programa on-chain propio
