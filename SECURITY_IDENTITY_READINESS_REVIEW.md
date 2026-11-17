# Revisión de identidad, privilegios y preparación de fases
> **Estado posterior:** la propuesta recomendada fue aprobada e implementada el 2026-10-27 mediante las migraciones 005–007. Los hallazgos siguientes se conservan como evidencia del diagnóstico previo; el estado vigente y las pruebas están en `BACKEND_SECURITY_AUDIT.md` y `DATABASE_AND_IDENTITY_RUNBOOK.md`.

Fecha: 2026-10-27  
Alcance: backend Express, PostgreSQL, autenticación, autorización, cuentas institucionales y preparación para Gemini/Socket.IO.

## Resumen ejecutivo

El backend tiene una base razonable: consultas parametrizadas, JWT con algoritmo/emisor/audiencia explícitos, controles de rol, aislamiento por curso e institución, restricciones de integridad, rate limiting, Helmet y pruebas de seguridad. La auditoría actual de npm no reporta vulnerabilidades conocidas en dependencias de producción.

Sin embargo, el sistema todavía no debe considerarse completo para producción ni debería comenzar a consumir servicios de IA con costo sin cerrar primero una **Fase 2.5 de identidad y privilegios**. El problema principal no es SQL injection: es el gobierno de quién puede crear una cuenta, con qué rol, en qué institución y cómo demuestra que controla el correo.

La recomendación es reemplazar el registro basado en un código de licencia compartido por un flujo de invitaciones de correo exactas. El superadministrador debe ser una identidad fija creada mediante un bootstrap administrativo, nunca mediante el registro público. El dominio ayuda a validar afiliación, pero no debe decidir por sí solo el rol.

Estado observado en la base activa durante la revisión:

- 1 superadministrador activo y verificado.
- 1 docente activo y verificado.
- 5 estudiantes activos y verificados.
- 4 migraciones aplicadas.
- La API se conecta como el rol PostgreSQL `postgres`, que actualmente es superusuario.
- Row-Level Security no está habilitado; el aislamiento depende del backend y de restricciones/triggers puntuales.

## Controles que ya están bien encaminados

- El registro público solo acepta los roles `estudiante` y `docente`; no acepta `superadministrador` ([backend/controllers/authController.js](backend/controllers/authController.js), líneas 53-74).
- El middleware verifica JWT con `HS256`, emisor y audiencia, y vuelve a consultar el estado actual del usuario en PostgreSQL ([backend/middleware/authMiddleware.js](backend/middleware/authMiddleware.js), líneas 22-73).
- Las rutas administrativas existentes exigen rol de superadministrador ([backend/routes/authRoutes.js](backend/routes/authRoutes.js), líneas 26-35).
- Las consultas revisadas utilizan parámetros y los recursos académicos aplican autorización por propietario, matrícula e institución ([backend/services/authorizationService.js](backend/services/authorizationService.js), líneas 7-39).
- La base restringe rol, género, estado, formato de email, formato de nombres y hash bcrypt ([database/schema.sql](database/schema.sql), líneas 30-73).
- CORS usa una lista permitida, Helmet está activo y existen límites de cuerpo y peticiones ([backend/config/security.js](backend/config/security.js), líneas 13-61; [backend/server.js](backend/server.js), líneas 28-44).
- `npm audit --omit=dev` reportó 0 vulnerabilidades conocidas el 2026-10-27.

## Hallazgos prioritarios

### SEC-ID-001 — Cuenta activa sin verificar el correo

- Severidad: Alta.
- Ubicación: `register` y `login` en [backend/controllers/authController.js](backend/controllers/authController.js), líneas 129-150 y 194-231; columna `correo_verificado` en [database/schema.sql](database/schema.sql), línea 40.
- Evidencia: el registro inserta `correo_verificado = false`, pero un estudiante queda con estado `activo` y recibe un JWT inmediatamente. El login comprueba contraseña y estado, pero no exige `correo_verificado`.
- Impacto: una persona puede registrar el correo de otra antes que su propietario, ocupar su identificador único y acceder como estudiante sin demostrar control del buzón.
- Corrección: exigir una invitación enviada al correo y consumirla una sola vez; alternativamente, crear la cuenta pendiente y no emitir JWT hasta verificar el correo.
- Mitigación temporal: dejar todos los registros nuevos en `pendiente` y bloquear login/token cuando `correo_verificado = false`.
- Nota de falso positivo: los 7 usuarios actuales están verificados, pero el flujo vulnerable sigue existiendo para cuentas nuevas.

### SEC-ID-002 — El código de licencia funciona como secreto compartido de inscripción

- Severidad: Alta.
- Ubicación: [backend/controllers/authController.js](backend/controllers/authController.js), líneas 53-68 y 114-129; [database/schema.sql](database/schema.sql), líneas 14-23.
- Evidencia: cualquier correo sintácticamente válido puede registrarse si conoce `codigo_licencia`; el cliente también envía el rol solicitado.
- Impacto: una filtración o reutilización del código permite crear estudiantes activos y generar solicitudes de docentes. Un dominio válido tampoco demuestra que la persona esté autorizada para tener un rol concreto.
- Corrección: usar invitaciones por correo exacto, donde `id_institucion` y `rol` provengan del servidor y nunca del cuerpo de registro.
- Mitigación temporal: hacer que estudiantes y docentes queden pendientes y requerir aprobación individual.
- Nota de falso positivo: el endpoint no devuelve el código de licencia, pero existe un código demo en los seeds y los códigos se comparten por diseño.

### SEC-ADMIN-001 — La identidad única del superadministrador no está garantizada

- Severidad: Alta.
- Ubicación: rol permitido en [database/schema.sql](database/schema.sql), líneas 43-71; cuenta demo en [database/seeds.sql](database/seeds.sql), líneas 13-19.
- Evidencia: la API pública impide solicitar el rol, pero la base permite múltiples filas con `rol = 'superadministrador'`; tampoco exige un correo corporativo exacto ni impide cambiar el correo o rol de esa cuenta por futuras rutas administrativas.
- Impacto: una futura función defectuosa, una importación o una operación manual podría crear otro superadministrador o alterar la identidad principal.
- Corrección: crear el superadministrador con un bootstrap idempotente, aplicar un índice único parcial que permita como máximo uno, fijar su correo aprobado y excluirlo de las rutas genéricas de cambio de rol/estado.
- Mitigación: auditar diariamente que exista exactamente uno y registrar toda modificación administrativa.
- Nota de falso positivo: actualmente sí existe exactamente un superadministrador; falta garantizar que el estado se conserve.

### SEC-CRED-001 — Credenciales demo conocidas y reutilizadas por pruebas

- Severidad: Alta; crítica si los seeds se cargan en un entorno accesible.
- Ubicación: [database/seeds.sql](database/seeds.sql), líneas 4-18; [tests/database.integration.test.js](tests/database.integration.test.js), líneas 14-17.
- Evidencia: el repositorio documenta una contraseña demo fija y la prueba de integración inicia sesión con ella contra la base real.
- Impacto: cualquier despliegue que conserve esas cuentas queda accesible con credenciales conocidas, incluido el superadministrador demo.
- Corrección: separar seeds de desarrollo y bootstrap de producción; generar la credencial inicial fuera del repositorio y forzar cambio/MFA en el primer acceso.
- Mitigación: no exponer el entorno actual y rotar inmediatamente las credenciales antes de una demostración pública.
- Nota de falso positivo: es aceptable únicamente en un entorno local aislado identificado explícitamente como demo.

### SEC-DB-001 — La API usa un superusuario de PostgreSQL

- Severidad: Alta.
- Ubicación: configuración predeterminada en [backend/config/database.js](backend/config/database.js), líneas 18-29. Confirmado en ejecución: `current_user = postgres`, `rolsuper = true`.
- Evidencia: la conexión activa tiene capacidad de superusuario.
- Impacto: una vulnerabilidad futura en la API tendría alcance total sobre PostgreSQL, más allá de las tablas y operaciones que codeInt necesita.
- Corrección: crear `codeint_app` sin `SUPERUSER`, sin `CREATEDB`, sin `CREATEROLE` y con privilegios mínimos; usar otro rol propietario exclusivamente para migraciones.
- Mitigación: restringir PostgreSQL a red local mientras se crea el rol dedicado.
- Nota de falso positivo: en desarrollo local es frecuente usar `postgres`, pero no es aceptable para producción.

### SEC-AUTH-001 — Ciclo de vida de credenciales y tokens incompleto

- Severidad: Media-Alta.
- Ubicación: generación de JWT en [backend/controllers/authController.js](backend/controllers/authController.js), líneas 20-44; autenticación en [backend/middleware/authMiddleware.js](backend/middleware/authMiddleware.js), líneas 28-73.
- Evidencia: no existen verificación de correo, recuperación/cambio de contraseña, MFA, logout con revocación, `token_version` ni fecha de cambio de contraseña.
- Impacto: un JWT robado continúa válido hasta expirar; cambiar la contraseña no revoca tokens. La cuenta más privilegiada no tiene segundo factor.
- Corrección: agregar `token_version`, incrementar al cambiar contraseña o cerrar sesiones, comprobarlo en cada JWT y exigir MFA al superadministrador antes de producción.
- Mitigación: reducir temporalmente la vida del JWT y desactivar la cuenta ante sospecha; el middleware ya bloquea cuentas inactivas.
- Nota de falso positivo: consultar la cuenta en cada petición permite revocar al inactivarla, pero no ofrece cierre selectivo de sesiones.

### SEC-AUDIT-001 — No existe auditoría de acciones administrativas

- Severidad: Media.
- Ubicación: aprobación de docentes en [backend/controllers/authController.js](backend/controllers/authController.js), líneas 354-397; esquema completo sin tabla de auditoría de seguridad.
- Evidencia: se modifica el estado del docente sin almacenar actor, motivo, fecha, resultado ni valor anterior.
- Impacto: no se puede reconstruir quién habilitó una cuenta, dominio, cuota o institución.
- Corrección: tabla append-only `auditoria_seguridad` y registro transaccional de invitaciones, aprobaciones, bloqueos, cambios de rol, dominios y cuotas.
- Mitigación: logs estructurados centralizados, sin incluir tokens ni contraseñas.
- Nota de falso positivo: `uso_ia` audita consumo de IA, no decisiones de identidad.

### SEC-RATE-001 — Limitación de autenticación solo en memoria/IP

- Severidad: Media para producción distribuida.
- Ubicación: [backend/config/security.js](backend/config/security.js), líneas 38-48.
- Evidencia: `express-rate-limit` usa el almacén de memoria predeterminado y no hay contador de fallos por cuenta más IP.
- Impacto: los límites se reinician al reiniciar el proceso, no se comparten entre instancias y una red institucional con NAT puede bloquear a muchos usuarios legítimos.
- Corrección: almacén compartido y límites combinados por IP y hash normalizado del email, con demoras progresivas.
- Mitigación: mantener el límite actual mientras solo exista una instancia local.
- Nota de falso positivo: el control actual sí reduce ataques básicos en una sola instancia.

### SEC-SOCKET-001 — Socket.IO todavía acepta conexiones sin autenticación

- Severidad: Media ahora; alta antes de implementar la fase multijugador.
- Ubicación: [backend/server.js](backend/server.js), líneas 31-37 y 72-79.
- Evidencia: cualquier cliente con origen permitido puede conectarse; no se valida JWT en el handshake ni membresía de sala.
- Impacto futuro: suplantación de docentes/estudiantes, unión a salas ajenas, respuestas manipuladas o escucha de eventos.
- Corrección: middleware de autenticación de Socket.IO, autorización por evento, asociación servidor-side del usuario, rate limits y nonces/idempotencia para respuestas.
- Mitigación: no añadir eventos con efectos de negocio hasta implementar el middleware.
- Nota de falso positivo: hoy solo existen conexión y desconexión; todavía no hay eventos privilegiados.

### SEC-AI-001 — Faltan invariantes e idempotencia para la fase Gemini/XP

- Severidad: Alta antes de iniciar consumo real de IA.
- Ubicación: [database/schema.sql](database/schema.sql), líneas 80-100, 250-340 y 347-368.
- Evidencia:
  - `asignacion_tokens` usa claves foráneas, pero no garantiza que beneficiario sea docente ni asignador sea superadministrador.
  - `envio_ejercicio` y `evaluacion_ia` repiten estudiante/curso sin una restricción que pruebe consistencia con matrícula, ejercicio y envío.
  - `uso_ia` no impide tokens negativos ni garantiza coherencia entre tipo de operación, envío/sílabo y estados.
  - `xp_movimiento` no impide otorgar XP dos veces por la misma evaluación ni exige que el origen coincida con la referencia utilizada.
- Impacto: consumo imputado a otra institución, sobreconsumo por carreras concurrentes, evaluación asociada al alumno equivocado o XP duplicado al reintentar una operación.
- Corrección: migración de integridad para roles y relaciones; reserva atómica de cuota con bloqueo de fila; claves idempotentes; índices únicos parciales para premios; transacción única al confirmar evaluación, consumo y XP.
- Mitigación: no llamar a Gemini ni escribir XP hasta implementar estas garantías.
- Nota de falso positivo: `id_operacion` ya es único y es una buena base, pero no cubre todas las operaciones relacionadas.

### SEC-DOC-001 — Documentación y pruebas de identidad desactualizadas

- Severidad: Baja.
- Ubicación: [BACKEND_SECURITY_AUDIT.md](BACKEND_SECURITY_AUDIT.md), líneas 18 y 38-55; [security-reports/README.md](security-reports/README.md), líneas 23-27.
- Evidencia: el informe aún describe género neutral/opcional y cifras anteriores de pruebas; el plan marca la fase 2 como completa aunque correo, recuperación y gobierno de cuentas están pendientes.
- Impacto: otro desarrollador puede asumir que controles inexistentes ya fueron terminados.
- Corrección: actualizar documentación después de aprobar e implementar la Fase 2.5.
- Mitigación: usar este informe como estado vigente.
- Nota de falso positivo: los reportes históricos siguen siendo válidos como evidencia fechada, pero no como estado actual.

## Modelo recomendado de identidad

### 1. Superadministrador fijo

- Una dirección exacta, por ejemplo `admin@codeintcorp.com`; el dominio por sí solo no basta.
- No existe opción pública para crear, invitar o promover a `superadministrador`.
- Se crea con un script de bootstrap de una sola ejecución, no con `seeds.sql`.
- La base permite como máximo una fila con ese rol mediante índice único parcial.
- Su correo y rol no se modifican desde endpoints genéricos.
- Debe tener correo verificado y MFA obligatorio antes de producción.
- Debe existir un procedimiento de recuperación administrado desde servidor/DB para evitar que la única cuenta se convierta en un punto único de bloqueo.

### 2. Dominios institucionales

Crear `institucion_dominio` con, como mínimo:

- `id_institucion_dominio` UUID.
- `id_institucion` UUID.
- `dominio` normalizado sin `@`, por ejemplo `utp.edu.pe`.
- `estado` (`pendiente`, `activo`, `inactivo`).
- `verificado_en`, `creado_por`, `fecha_creacion`.
- Unicidad global de `lower(dominio)` salvo que exista una razón documentada para compartirlo.

Los docentes y estudiantes deben usar dominios de su institución, no `@codeintcorp.com`. El dominio corporativo queda reservado para personal de la plataforma. Una institución puede tener varios dominios.

### 3. Invitaciones por correo exacto

Crear `invitacion_usuario` con:

- email exacto normalizado;
- institución y rol definidos por el servidor;
- `token_hash` aleatorio, nunca el token en texto plano;
- vencimiento, estado, fecha de uso y actor que invitó;
- una sola invitación pendiente por email/institución/rol.

Flujo recomendado:

1. El superadministrador habilita una dirección exacta y elige institución/rol.
2. El sistema valida que el dominio pertenezca a la institución.
3. Se envía un enlace de un solo uso con vencimiento.
4. El usuario establece nombre, contraseña y género.
5. El backend toma email, rol e institución de la invitación, no de `req.body`.
6. Al consumir el enlace, el correo queda verificado y la cuenta activa.
7. La operación completa se ejecuta en una transacción y queda auditada.

Con este modelo, invitar equivale a aprobar. Si se quiere permitir solicitudes espontáneas de docentes, deben ser un flujo separado que siempre quede pendiente.

### 4. Nuevo papel del código de licencia

`codigo_licencia` puede conservarse para representar la suscripción o contrato de la institución, pero no debe autorizar la creación de identidades. Si sigue siendo sensible, debe rotarse y almacenarse como hash o identificador no reutilizable.

### 5. Ciclo de vida de cuenta

- Verificación e invitación con tokens hasheados, de un uso y con vencimiento.
- Recuperación de contraseña sin revelar si el correo existe.
- Cambio de contraseña con contraseña actual.
- `token_version` o identificador de sesión para revocación.
- Bloqueo/desbloqueo con motivo y auditoría.
- MFA para superadministrador.
- No eliminar físicamente usuarios con historial académico; usar estado y anonimización controlada cuando corresponda.

## Fase 2.5 propuesta

Orden recomendado antes de Gemini:

1. Rotar/desacoplar cuentas demo y definir el correo corporativo exacto del superadministrador.
2. Crear rol PostgreSQL de aplicación con privilegios mínimos.
3. Agregar migración de gobierno de identidad: superadmin único, dominios, invitaciones, tokens de cuenta, auditoría y revocación.
4. Reemplazar `/register` por registro mediante invitación y exigir correo verificado en login/middleware.
5. Agregar recuperación/cambio de contraseña y pruebas de abuso.
6. Agregar migración de integridad de IA/XP y reserva atómica de cuota.
7. Actualizar documentación y ejecutar pruebas completas.

Después de estos siete pasos se puede iniciar la fase 3. Antes de la fase 4 debe añadirse autenticación/autorización específica de Socket.IO.

## Pruebas de aceptación necesarias

- No puede existir más de un superadministrador.
- El superadministrador no puede crearse, promoverse ni modificarse mediante rutas públicas/genéricas.
- Una invitación vencida, reutilizada, revocada o con dominio incorrecto es rechazada.
- Modificar `rol`, `email` o `id_institucion` en el cuerpo no altera los valores de la invitación.
- Un usuario no verificado no recibe JWT ni puede iniciar sesión.
- Cambiar contraseña o incrementar `token_version` invalida tokens anteriores.
- Un docente no puede invitar/matricular fuera de su institución.
- Toda aprobación, bloqueo, invitación y cambio de privilegio produce auditoría.
- Dos solicitudes concurrentes de Gemini no exceden la cuota.
- Un reintento con el mismo `id_operacion` no vuelve a consumir tokens ni otorgar XP.
- El rol `codeint_app` no puede crear extensiones, roles, bases ni alterar el esquema.

## Decisiones solicitadas al propietario

1. Correo exacto del superadministrador. Propuesta provisional: `admin@codeintcorp.com`.
2. Quién invita: recomendado inicialmente solo el superadministrador; después se puede delegar a docentes únicamente la invitación de estudiantes de su propia institución.
3. Activación: recomendado que completar una invitación válida active tanto docentes como estudiantes, porque la invitación ya representa la aprobación.
4. Datos demo: recomendado conservarlos solo en desarrollo y crear un bootstrap separado para cualquier ambiente real.
5. Sesiones: recomendado acceso JWT corto más revocación por `token_version`; refresh token HttpOnly puede añadirse cuando exista frontend.

## Dictamen

- Para continuar desarrollando de forma local: sí, el proyecto es utilizable.
- Para declarar completa la fase de seguridad/identidad: no todavía.
- Para comenzar la integración real con Gemini y costos: cerrar primero la Fase 2.5.
- Para producción o exposición pública: además deben existir MFA del superadministrador, rol PostgreSQL mínimo, TLS/proxy configurados, copias/restauración probadas, observabilidad y rotación de secretos.
