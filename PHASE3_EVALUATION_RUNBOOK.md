# Fase 3: evaluación PSeInt e IA

## Flujo implementado

1. El estudiante valida el código localmente. Esta operación no usa Gemini ni consume cuota.
2. Al enviar, el backend guarda el intento con un `Idempotency-Key` UUID.
3. Si la estructura PSeInt es inválida, responde `422`, conserva los errores por línea y no reserva tokens.
4. Si es válida, PostgreSQL reserva de forma atómica una parte de la cuota del docente.
5. Gemini devuelve una evaluación JSON estructurada; el backend vuelve a validar todos sus campos.
6. Evaluación, uso real de tokens, XP y progreso se confirman en una sola transacción.
7. Repetir el mismo `Idempotency-Key` con el mismo contenido devuelve el resultado previo sin evaluar ni cobrar otra vez.

No se otorga XP más de una vez por estudiante, curso y ejercicio, aunque existan varios intentos aprobados.

## Configuración local

Completar en `.env`:

```dotenv
GEMINI_API_KEY=clave_real
GEMINI_MODEL=gemini-3.8-flash
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_OUTPUT_TOKENS=1200
GEMINI_TOKEN_RESERVATION=16000
```

La clave no debe enviarse al frontend, guardarse en la base de datos ni incluirse en commits.

## API para el frontend

Todas las rutas requieren `Authorization: Bearer <JWT>`.

### Validación gratuita

```http
POST /api/ejercicios/{id_ejercicio}/validar
Content-Type: application/json

{
  "codigo_pseint": "Algoritmo Demo\n  Escribir \"Hola\"\nFinAlgoritmo"
}
```

La respuesta incluye `valido`, `consume_tokens_ia: false`, errores y advertencias con número de línea.

### Envío y evaluación

```http
POST /api/ejercicios/{id_ejercicio}/envios
Authorization: Bearer <JWT_ESTUDIANTE>
Idempotency-Key: 61ae8f28-2d0c-4a14-9119-67f45817928f
Content-Type: application/json

{
  "codigo_pseint": "Algoritmo Demo\n  Escribir \"Hola\"\nFinAlgoritmo"
}
```

El cliente debe generar un UUID nuevo para cada intento nuevo y reutilizarlo solamente al reintentar la misma petición por un problema de red.

Estados posibles: `rechazado_local`, `pendiente`, `procesando`, `completado` y `fallido`.

### Asignar cuota como superadministrador

```http
POST /api/ia/cuotas
Authorization: Bearer <JWT_SUPERADMIN>
Content-Type: application/json

{
  "id_docente": "UUID_DEL_DOCENTE",
  "limite_tokens": 500000,
  "fecha_inicio": "2026-10-27T00:00:00-05:00",
  "fecha_fin": "2026-12-31T23:59:59-05:00"
}
```

Las cuotas de un mismo docente no pueden superponerse. `GET /api/ia/cuotas` muestra el límite y los tokens comprometidos.

### Consultar consumo de IA

```http
GET /api/ia/consumo?limite=50&pagina=1
Authorization: Bearer <JWT_DOCENTE>
```

El docente ve su cuota vigente (`limite_tokens`, `tokens_consumidos`, `tokens_reservados`, `tokens_disponibles`), un resumen de operaciones y el detalle paginado por estudiante, ejercicio y curso. El superadministrador usa el mismo endpoint con `?id_docente=UUID` (obligatorio para él).

## Gamificación

Una evaluación nueva devuelve además `xp_ganada`, `logros_desbloqueados` (logros/insignias que se otorgaron en esa misma transacción) y `gamificacion` (nivel actual, XP total y progreso al siguiente nivel). Los logros se calculan desde el catálogo `logro` (`xp_acumulado`, `ejercicios_aprobados`, `mundos_completados`, `partidas_participadas`) y nunca se otorgan dos veces.

## Envíos atascados

Si el servidor se reinicia mientras un envío está en `pendiente` o `procesando`, al reintentar con el mismo `Idempotency-Key` pasados `GEMINI_TIMEOUT_MS + 2 minutos` el envío se marca `fallido`, se libera la reserva de tokens (`uso_ia` pasa a `fallido`) y la respuesta es `409`; el cliente debe reenviar con un UUID nuevo.

## Respuestas relevantes

- `201`: evaluación nueva completada.
- `200`: validación local o resultado idempotente ya existente.
- `202`: la misma operación sigue procesándose.
- `409 AI_QUOTA_UNAVAILABLE`: el docente no tiene cuota vigente/suficiente.
- `409 IDEMPOTENCY_KEY_REUSED`: el UUID se reutilizó con otros datos.
- `422`: el código fue guardado, pero falló la validación local.
- `502/503/504`: Gemini devolvió un resultado inválido, no estuvo disponible o agotó el tiempo.

## Pruebas

```powershell
npm test
$env:RUN_DB_TESTS='1'; npm test
```

Las pruebas unitarias no llaman a Gemini. La prueba de integración reemplaza temporalmente el proveedor por una respuesta controlada y elimina sus registros al terminar.
