# Fase 4: salas multijugador Kahoot (Socket.io)

## Conexión

```js
const socket = io('http://localhost:3000', { auth: { token: JWT } });
```

El socket usa las mismas reglas que el API REST (firma, emisor, audiencia, sesión no revocada, correo verificado, cuenta activa). Errores de `connect_error`: `AUTHENTICATION_REQUIRED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `SESSION_REVOKED`, `ACCOUNT_NOT_ACTIVE`.

Todos los eventos aceptan un callback `ack({ success, error?, ... })`. Los errores esperados traen un código en `error` (por ejemplo `PIN_INVALIDO`, `NICK_EN_USO`); los inesperados devuelven `ERROR_INTERNO` sin detalles. Cada socket admite 60 eventos cada 10 s (`DEMASIADOS_EVENTOS`).

## Ciclo de estados

`espera` → `countdown` → `pregunta` → `estadisticas_pregunta` → (siguiente pregunta o) `finalizada`.
Si el docente cierra una sala que nunca comenzó, pasa a `cancelada` y no reparte XP.

## Docente (anfitrión)

| Evento | Datos | Efecto |
|---|---|---|
| `room:create` | `{ id_curso, preguntas }` | Crea la sala (transaccional), la abre en memoria y se une como anfitrión. Responde `{ data: { id_sala, pin, totalPreguntas, curso } }` y emite `room:created`. |
| `room:host` | `{ pin }` | Abre una sala preparada con `POST /api/salas` o recupera el control tras reconectarse. Emite `room:state`. |
| `game:start` | `{ pin? }` | Inicia la partida. Requiere al menos un jugador. |
| `question:end` | `{ pin? }` | Cierra la pregunta antes de que termine el tiempo. |
| `question:next` | `{ pin? }` | Solo cuando la pregunta ya cerró. En la última pregunta cierra la partida. |
| `game:finish` | `{ pin? }` | Termina la partida antes de tiempo. Es idempotente. |

Formato de `preguntas`: `[{ enunciado, tiempo_limite_seg (5-120, def. 30), puntos_base (100-5000, def. 1000), opciones: [{ texto, es_correcta }] }]`. Entre 1 y 50 preguntas, 2 a 4 opciones, **exactamente una** correcta. Las etiquetas A-D se asignan por posición.

Eventos que recibe el anfitrión: `player:joined`, `player:reconnected`, `player:disconnected`, `answers:update_count`, `question:results` (con la opción correcta, estadísticas y top 5), `game:podium` (podio y ranking completo).

## Estudiante

| Evento | Datos | Efecto |
|---|---|---|
| `room:join` | `{ pin, nick? }` | Solo estudiantes con matrícula activa en el curso de la sala. El apodo se sanea y debe ser único en la sala. Si la partida ya comenzó solo pueden volver quienes ya estaban dentro (reconexión) y reciben `room:state`. |
| `answer:submit` | `{ id_opcion }` | Una respuesta por pregunta. El tiempo lo mide el servidor. La confirmación es solo `{ recibido: true }`: el acierto se conoce en `answer:result`. |

Eventos que recibe: `room:joined_success`, `game:started`, `question:countdown`, `question:show` (sin `es_correcta`; incluye `servidor_ts`), `answer:result` (`correct`, `puntaje`, `puntajeTotal`, `posicion`), `game:podium` (`tuPuesto`, `tuPuntaje`, `xpGanado`, `logros_desbloqueados`), `room:state`, `room:replaced` (se abrió otra sesión del mismo estudiante), `host:disconnected`, `room:cancelled`.

## REST

Todas requieren `Authorization: Bearer <JWT>`.

- `POST /api/salas` (docente): prepara una sala en estado `espera`; el docente la abre luego con `room:host { pin }`.
- `GET /api/salas/:pin/info`: datos previos al ingreso. Solo para el docente dueño o estudiantes matriculados; `lista_para_unirse` indica si el anfitrión ya la abrió.
- `GET /api/salas/activas` (estudiante), `GET /api/salas/docente` (docente), `GET /api/salas/:id_sala/detalle` (docente; incluye respuestas correctas).

## Puntuación y XP

`puntaje = round(puntos_base × (1 − tiempo / (2 × límite)))`, 0 si es incorrecta o fuera de tiempo. Desempate: menor tiempo total de respuesta. XP al cerrar: 1.º 150, 2.º 100, 3.º 50, resto 20, siempre que hayan respondido al menos una pregunta. XP, posiciones y logros se guardan en una sola transacción; el XP no se duplica (`uq_xp_por_participante_sala`). Participar en una partida desbloquea los logros de `partidas_participadas`.

## Operación

- El estado de las salas vive en memoria: **una sola instancia del servidor**. Al arrancar, las salas que seguían `espera`/`en_curso` se cancelan.
- Si el anfitrión se desconecta, hay 10 minutos (`KAHOOT_HOST_GRACE_MS`) para volver con `room:host`; vencido el plazo la sala se cierra.
- Variables opcionales: `KAHOOT_COUNTDOWN_SECONDS` (3), `KAHOOT_HOST_GRACE_MS`, `KAHOOT_CLOSED_ROOM_TTL_MS`.
- Límite de 5 salas abiertas por docente.
- Pruebas: `npm test` (unitarias) y `$env:RUN_DB_TESTS='1'; npm test` (incluye una partida completa con sockets reales).
