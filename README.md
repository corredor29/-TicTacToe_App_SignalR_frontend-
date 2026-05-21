# TICTACTOE ONLINE — Frontend Documentation
> v2.0 · Retro Arcade Edition · HTML / CSS / JS puro

---

## 1. Descripción General

Frontend web para el juego TicTacToe multijugador en tiempo real. Construido en HTML, CSS y JavaScript puro sin frameworks, con estética retro arcade y comunicación en tiempo real via SignalR.

**Características principales:**
- Autenticación JWT con usuario/contraseña y Google OAuth
- Sala de espera con lista de jugadores online y estado de presencia
- Retos entre jugadores, tablero sincronizado con el servidor
- Sistema de revancha, ranking global y selector de estado

---

## 2. Estructura de Archivos

```
tictactoe-frontend/
├── index.html     ← Estructura HTML: pantallas, modales, tablero. Sin lógica inline.
├── style.css      ← Estilos retro arcade: fuente pixelada, CRT, glitch, animaciones.
├── state.js       ← Estado global compartido (STATE) y constantes de URL.
├── api.js         ← Llamadas HTTP al backend: login, register, google auth, ranking.
├── hub.js         ← Conexión SignalR, eventos del servidor y métodos de invocación (HUB).
├── game.js        ← Renderizado del tablero a partir del GameStateDto del servidor (GAME).
├── ui.js          ← Manejo de pantallas, modales, listas de usuarios y toasts (UI).
└── actions.js     ← Acciones del usuario: conecta UI → Hub → API.
```

> **Orden de carga en index.html** (importante por dependencias):
> `state.js → api.js → ui.js → game.js → hub.js → actions.js`

---

## 3. Flujos Principales

### 3.1 Autenticación

| Paso | Descripción |
|------|-------------|
| 1. Login / Registro | El usuario ingresa credenciales. `actions.js` llama a `api.js` → `POST /user/login` o `/user/register`. |
| 2. Google OAuth | El botón de Google dispara `handleGoogleLogin()` → `api.js` → `POST /auth/google` con el `id_token`. |
| 3. Tokens | El backend retorna `accessToken` + `refreshToken`. Se guardan en `STATE`. |
| 4. Hub | Se llama `connectHub()` para iniciar la conexión SignalR autenticada con el JWT. |
| 5. Lobby | Se muestra `lobby-screen` y el usuario queda online. |

### 3.2 Flujo de Partida

| Evento | Quién lo dispara | Qué ocurre |
|--------|-----------------|------------|
| `sendInvite(to)` | Jugador A presiona RETAR | `HUB.requestRoom(to)` → servidor envía `RequestPrivateRoom` al jugador B. |
| `acceptInvite()` | Jugador B presiona ACEPTAR | `HUB.createRoom(from)` → servidor crea sala y emite `GameStateUpdated` a ambos. |
| `GAME.makeMove(pos)` | Jugador hace clic en celda | `HUB.sendMove()` → servidor valida, actualiza estado y emite `GameStateUpdated`. |
| `GameStateUpdated` | Servidor (SignalR) | `GAME.renderState(gs)` actualiza tablero, turno, marcador y detecta resultado. |
| `requestRematch()` | Jugador presiona REVANCHA | `HUB.requestRematch()` → servidor envía `RematchRequested` al oponente. |
| `acceptRematch()` | Oponente acepta | `HUB.respondRematch(accepted:true)` → servidor reinicia partida y emite nuevo `GameStateUpdated`. |
| `leaveGame()` | Jugador abandona | `HUB.closeRoom()` → servidor notifica `ClosePrivateRoom` y ambos regresan al lobby. |

### 3.3 Estado de Presencia

El jugador puede cambiar su estado desde el sidebar del lobby:

| Estado | StatusId | Comportamiento |
|--------|----------|----------------|
| ● ON | 1 | Disponible — puede recibir retos. |
| ● PLAY | 2 | Jugando — marcado manualmente. |
| ● DND | 3 | No molestar — no puede recibir invitaciones. |

> El backend valida las transiciones; no se puede cambiar de estado con una partida activa.

---

## 4. Arquitectura JavaScript

### 4.1 `state.js` — Estado Global

Objeto `STATE` único compartido por todos los módulos:

```js
STATE.accessToken    // JWT del usuario autenticado
STATE.username       // Nombre del jugador actual
STATE.opponent       // Username del oponente en partida
STATE.gameState      // Último GameStateDto recibido del servidor
STATE.score          // Marcador local { X, O, draws }
STATE.connection     // Instancia de la conexión SignalR
```

### 4.2 `api.js` — HTTP

Funciones asíncronas que encapsulan `fetch()`. Todas retornan `{ ok, data }`:

| Función | Endpoint |
|---------|----------|
| `login(username, password)` | `POST /user/login` |
| `register(username, password)` | `POST /user/register` |
| `googleAuth(idToken)` | `POST /auth/google` |
| `getRanking()` | `GET /user/ranking` (con Bearer token) |

### 4.3 `hub.js` — SignalR

Establece la conexión con el Hub y registra todos los eventos del servidor. Expone el objeto `HUB` con métodos de invocación:

| Método HUB | Invoca en el servidor |
|------------|----------------------|
| `HUB.requestRoom(to)` | `RequestPrivateRoom` |
| `HUB.createRoom(to)` | `CreatePrivateRoom` |
| `HUB.closeRoom(to)` | `ClosePrivateRoom` |
| `HUB.sendMove(to, pos)` | `SendPrivateRoomMessage` |
| `HUB.requestRematch(to)` | `RequestRematch` |
| `HUB.respondRematch(to, accepted)` | `RespondRematch` |
| `HUB.setStatus(id)` | `SetAvailabilityStatus` |

### 4.4 `game.js` — Tablero

- **`GAME.renderState(gs)`** — recibe el `GameStateDto` del servidor y actualiza: celdas del tablero, celdas ganadoras, indicador de turno, highlight del scoreboard y resultado final.
- **`GAME.makeMove(pos)`** — valida que sea el turno del jugador y llama `HUB.sendMove()`.
- **`GAME.spawnPixels(type)`** — genera partículas de píxeles animadas al terminar una partida (verde=victoria, rojo=derrota, gris=empate).

### 4.5 `ui.js` — Interfaz

Objeto `UI` que controla el DOM sin que otros módulos accedan directamente:

| Método | Qué hace |
|--------|----------|
| `UI.showScreen(id)` | Cambia la pantalla activa (auth / lobby / game). |
| `UI.toast(msg)` | Muestra notificación temporal en la barra inferior. |
| `UI.showModal(id)` | Abre un modal por id. |
| `UI.closeModal(id)` | Cierra un modal por id. |
| `UI.renderUserListFull(users)` | Renderiza la lista de jugadores con estado de presencia. |
| `UI.showRanking()` | Carga el ranking desde la API y abre el modal. |
| `UI.switchTab(tab)` | Cambia entre login y registro en la pantalla de auth. |

### 4.6 `actions.js` — Punto de Entrada

Conecta todos los módulos. Cada función corresponde a una acción concreta del usuario (`login`, `sendInvite`, `leaveGame`, etc.). También registra el listener de teclado (Enter en auth) y expone `handleGoogleLogin()` como función global para el callback de Google.

---

## 5. Sistema de Diseño

### 5.1 Tipografía

| Variable | Fuente | Uso |
|----------|--------|-----|
| `--pixel` | Press Start 2P | Títulos, botones, etiquetas principales. |
| `--mono` | Share Tech Mono | Textos secundarios, estados, contadores. |

### 5.2 Paleta de Colores

| Variable CSS | Valor | Uso |
|-------------|-------|-----|
| `--bg` | `#050810` | Fondo principal — negro azulado profundo. |
| `--glow` | `#00ff88` | Verde neón — color principal, brillo de la interfaz. |
| `--glow2` | `#ff0066` | Magenta — acciones destructivas, jugador X, errores. |
| `--cyan` | `#00eeff` | Cian — jugador O, elementos secundarios activos. |
| `--yellow` | `#ffee00` | Amarillo arcade — jugador en partida, celdas ganadoras. |
| `--muted` | `#3a5070` | Azul oscuro — textos secundarios, bordes inactivos. |

### 5.3 Efectos Visuales

- **Scanlines CRT** — overlay con `repeating-linear-gradient` para simular pantalla de tubo.
- **Viñeta** — `radial-gradient` en `body::after` que oscurece los bordes de la pantalla.
- **Glitch del título** — animación CSS que desplaza `text-shadow` con colores X/O y aplica `skewX`.
- **Parpadeo pixel** — `animation: step-end` para "INSERT COIN" y el punto de presencia online.
- **Pixel burst** — partículas `<div>` creadas dinámicamente con animación CSS al terminar partida.
- **Sombra neón** — `text-shadow` multicapa en X, O y elementos activos del tablero.
- **Grid animado** — `background-image` con `linear-gradient` que se desplaza en el lobby.

---

## 6. Configuración

### 6.1 URLs del Backend

En `state.js`, ajusta las constantes según el entorno:

```js
const API_BASE = 'http://localhost:5177/api';
const HUB_URL  = 'http://localhost:5177/hubs/connectionuser';
```

### 6.2 Google OAuth

En `index.html`, el atributo `data-client_id` debe corresponder al Client ID de Google Cloud Console:

```html
<div id="g_id_onload"
  data-client_id="TU_CLIENT_ID.apps.googleusercontent.com"
  data-callback="handleGoogleLogin"
  data-auto_prompt="false">
</div>
```

Orígenes autorizados en Google Cloud:
- `http://localhost:5500`
- `http://127.0.0.1:5500`

### 6.3 Servidor de Desarrollo

Usar **Live Server** de VS Code u otro servidor HTTP local en el puerto `5500`. No abrir `index.html` directamente como `file://` — el CORS del Hub fallará.

---

## 7. Dependencias Externas

| Librería | Versión | Uso |
|----------|---------|-----|
| `@microsoft/signalr` | 8.0.0 (CDN) | Cliente SignalR para la conexión en tiempo real. |
| Google Identity Services | latest (CDN) | Botón de login con Google y callback del `id_token`. |
| Press Start 2P | Google Fonts | Fuente pixelada principal del tema arcade. |
| Share Tech Mono | Google Fonts | Fuente monoespaciada para textos secundarios. |

> Todas las dependencias se cargan desde CDN. No hay proceso de build ni `npm`.

---

## 8. Requisitos del Backend

El frontend asume que el backend expone:

| Endpoint / Hub | Descripción |
|----------------|-------------|
| `POST /api/user/login` | Recibe `LoginDto`, retorna `TokenDto`. |
| `POST /api/user/register` | Recibe `RegisterDto`, retorna mensaje. |
| `POST /api/auth/google` | Recibe `GoogleTokenDto` con `idToken`, retorna `TokenDto`. |
| `GET /api/user/ranking` | Retorna lista de `RankingEntryDto` (requiere JWT). |
| Hub `/hubs/connectionuser` | Hub SignalR con `[Authorize]`. Acepta JWT via query string `access_token`. |

CORS debe permitir el origen del frontend (`SetIsOriginAllowed(_ => true)` en desarrollo).

---

*── END OF DOCUMENT ──*
