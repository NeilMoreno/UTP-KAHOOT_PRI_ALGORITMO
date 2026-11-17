# codeInt — Plan de implementación y cierre

Fecha de diagnóstico: 14 de noviembre de 2026.

Última actualización: 17 de noviembre de 2026.

Proyecto: `C:\xampp\htdocs\kahoot`.

Estado del plan: bloques 1, 2, 3A, 3B, 4, 6 y 8 completados; bloque 9 en curso. Los bloques 5 (Gemini real) y 7 (sílabos) quedan bloqueados por la clave real de Gemini y por decisiones de producto.

## 1. Objetivo

Completar los flujos de administración, docencia, aprendizaje y multijugador de codeInt, y preparar una entrega verificable y reproducible.

La aplicación ya pudo ejecutarse en `http://localhost:3000`, con conexión a PostgreSQL, frontend servido y respuesta del health check. Arrancar el servidor no equivale a tener terminado el alcance funcional.

## 2. Base técnica y reglas

- Conservar Node.js, Express, PostgreSQL, Socket.IO y el frontend HTML/CSS/JavaScript modular existente.
- Mantener navegación por hash y compatibilidad con la política CSP actual.
- Reutilizar las APIs y servicios existentes antes de crear otros.
- Mantener UUID, autorización por rol, aislamiento institucional y permisos por curso.
- Conservar idempotencia y atomicidad de consumo IA, evaluaciones y XP.
- Mostrar datos reales y estados claros de carga, ausencia de datos y error.
- Respetar el sistema de diseño existente y la accesibilidad en escritorio y móvil.
- Investigar y preservar los cambios locales: el repositorio contiene trabajo preparado, modificado y archivos sin seguimiento.
- Realizar pruebas de integración sobre una base separada de la utilizada para trabajar o demostrar el sistema.

## 3. Diagnóstico inicial

| Área | Evidencia observada | Pendiente principal |
|---|---|---|
| Ejecución local | Servidor, frontend y PostgreSQL respondieron en la sesión anterior | Hacer reproducible instalación y configuración |
| Identidad | Backend de login, invitación, recuperación, cambio de contraseña y revocación | Completar pantallas y entrega de correo |
| Estudiante | Dashboard, mundos, ejercicios, editor y resultados implementados | Verificar recorrido completo con datos y Gemini reales |
| Gemini | Servicio y flujo de evaluación implementados | Configurar clave real y validar modelo y cuota |
| Gamificación | Servicios de XP, niveles, progreso y logros implementados | Verificar comportamiento integral y reintentos |
| Kahoot | Backend REST y Socket.IO implementados | Construir interfaz de anfitrión y participante |
| Docente | Página de entrada indica que está en construcción | Panel y gestión académica |
| Superadministrador | Página de entrada indica que está en construcción | Panel, usuarios, invitaciones, instituciones y cuotas |
| Contenido | Curso nuevo crea siete mundos; seeds con ejercicios para los primeros tres | Contenido de mundos 4–7 y carga explícita de ejercicios en cursos nuevos |
| Sílabos | Entidad y referencias en el modelo | API, procesamiento, generación y pantallas |
| Analíticas | Datos académicos disponibles en las entidades existentes | Endpoints agregados y pantallas de reportes |
| Pruebas | Existen suites unitarias y de integración | Ejecutarlas y cubrir escenarios de cierre |

### Configuración observada

- `NODE_ENV=development`.
- Puerto local: `3000`.
- Usuario de PostgreSQL utilizado por la aplicación: `codeint_app` mediante `DATABASE_URL` (corregido y verificado en el bloque 1).
- Correo deshabilitado: `EMAIL_PROVIDER=disabled`.
- No se identificó una clave real configurada para Gemini.
- URLs de invitación y recuperación corregidas a `http://localhost:3000/#/registro` y `http://localhost:3000/#/restablecer-password` (bloque 1).
- La aplicación usa rutas por hash, por ejemplo `/#/registro?token=...`.

### Precisión sobre las verificaciones

El diagnóstico se basa en lectura del código y configuración, junto con las comprobaciones de arranque de la sesión anterior. Las suites completas no se ejecutaron para elaborar este plan. Los documentos históricos no sustituyen la verificación del código y del entorno vigente.

## 4. Estrategia y orden

Trabajar por bloques funcionales, cerrando cada uno con un resultado demostrable.

Orden recomendado:

`1 → 2 → 3A → 4 → (5 y 6) → 3B → 7 → 8 → 9`

Los bloques 5 y 6 pueden desarrollarse de manera independiente después del bloque 4. El bloque 3B puede adelantarse si se necesita trabajar con instituciones adicionales a la existente.

### Hitos de entrega

1. **Entorno reproducible:** bloque 1.
2. **Gestión y acceso operativos:** bloques 2, 3A y 4.
3. **Versión central demostrable:** bloques 1–6, incluido 3A, con pruebas de aceptación de esos flujos.
4. **Alcance funcional completo del plan:** añadir 3B, 7 y 8.
5. **Cierre de entrega:** bloque 9; incluir despliegue público cuando se confirme como requisito.

## 5. Bloques de implementación

### Bloque 1 — Instalación y configuración reproducibles

Prioridad: inmediata. Dependencias: ninguna.

Objetivo: iniciar el sistema en esta PC o en otra instalación mediante instrucciones verificadas.

- [x] Revisar esquema, migraciones y estado de la base activa.
- [x] Comprobar las cuentas necesarias y documentar su preparación sin publicar secretos.
- [x] Configurar `codeint_app` para runtime y reservar la cuenta propietaria para migraciones.
- [x] Corregir URLs de invitación y recuperación para el puerto y entorno correspondientes.
- [x] Ajustar la construcción de enlaces a la navegación por hash y a la ubicación del parámetro `token` que espera el router.
- [x] Documentar dependencias, configuración, creación de base, migraciones, datos demo, bootstrap y arranque.
- [x] Actualizar los ejemplos de configuración relacionados con estos ajustes.

Estado: **completado el 2026-11-14**.

Evidencia:
- La conexión de runtime ya usaba `codeint_app` mediante `DATABASE_URL`; se alineó el respaldo `DB_*` y `npm run test:db` reporta el usuario correcto.
- `.env` y `.env.example` usan `http://localhost:3000/#/registro` y `http://localhost:3000/#/restablecer-password`, entrecomilladas porque dotenv interpreta `#` como comentario.
- `emailService.buildActionUrl` coloca el token dentro de la ruta hash y conserva otros parámetros.
- `schema.sql` registra las 9 migraciones que ya incorpora; `npm run db:migrate` no reaplica nada.
- Se añadieron `db:create` y `db:schema` para instalar sin depender de `psql`.
- Se corrigió un error de sintaxis en `scripts/bootstrap-superadmin.js`.
- Instalación limpia verificada en base temporal: 26 tablas, 9 migraciones, 0 pendientes.
- Instalación con datos demo verificada: 3 usuarios (2 demo + superadministrador), 7 mundos, 9 ejercicios, 1 matrícula, 6 niveles, 10 logros.
- `npm test`: 48 pruebas, 0 fallos. `npm run db:audit`: sin hallazgos.
- Guía verificada en `README.md`; `DATABASE_AND_IDENTITY_RUNBOOK.md` actualizado.

Referencias: `package.json`, `.env.example`, `backend/server.js`, `backend/config/database.js`, `backend/config/migrationDatabase.js`, `backend/services/emailService.js`, `frontend/js/router.js`, `scripts/`, `DATABASE_AND_IDENTITY_RUNBOOK.md`.

Verificación: preparación sobre una base nueva, conexión, arranque y carga del login; prueba específica de los enlaces generados.

Criterio de finalización: una instalación nueva funciona siguiendo la guía y los enlaces abren la vista correcta con su token disponible.

### Bloque 2 — Cuentas, perfil y recuperación de acceso

Dependencias: bloque 1.

Objetivo: completar el ciclo de cuenta desde el navegador.

- [x] Incorporar «Olvidé mi contraseña» al login.
- [x] Crear formulario de solicitud de recuperación.
- [x] Crear pantalla de restablecimiento mediante enlace.
- [x] Crear pantalla de perfil y cambio de contraseña.
- [x] Conectar las pantallas con los endpoints existentes.
- [x] Mostrar estados de invitación vencida, usada o revocada.
- [ ] Configurar y verificar la entrega real de correo con un proveedor (requiere credenciales externas).
- [x] Verificar expiración y revocación de sesión.
- [x] Mantener las opciones de desarrollo para pruebas locales claramente documentadas.

Estado: **implementado el 2026-11-14**; la entrega real de correo queda pendiente por credenciales externas.

Evidencia:
- Nuevas vistas `forgot-password`, `reset-password` y `profile`, con rutas públicas y protegidas.
- El login enlaza la recuperación y el enlace enviado abre `#/restablecer-password?token=...`.
- Se añadió `ALLOW_DEV_PASSWORD_RESET_TOKEN_RESPONSE` (solo desarrollo y `EMAIL_PROVIDER=disabled`) y el chequeo de producción la rechaza.
- Flujo verificado de extremo a extremo: solicitud, enlace local, restablecimiento, login y rechazo de reutilización; contraseña demo restaurada al finalizar.
- Perfil verificado: edición de datos, rechazo de contraseña actual incorrecta y revocación efectiva tras «cerrar todas las sesiones».
- `npm test` y `npm run db:audit` sin fallos.

Pendiente externo: configurar `EMAIL_PROVIDER=cloudflare` con credenciales reales y comprobar la recepción del correo de invitación y recuperación. Mientras tanto, la aplicación funciona en local con los enlaces de desarrollo.

Referencias: `backend/routes/authRoutes.js`, `backend/controllers/identityController.js`, `backend/services/emailService.js`, `frontend/js/views/login.js`, `frontend/js/views/register.js`, `frontend/js/state.js`, `frontend/js/router.js`.

Verificación: invitación → registro → login → perfil → cambio de contraseña; recuperación con enlace válido, vencido y reutilizado.

Criterio de finalización: el usuario completa el ciclo de cuenta sin herramientas de API y las sesiones anteriores se revocan según las reglas existentes.

### Bloque 3A — Superadministrador: accesos y cuotas

Dependencias: bloques 1 y 2.

Objetivo: habilitar usuarios y recursos IA desde la web.

- [x] Crear panel inicial del superadministrador.
- [x] Crear, listar y revocar invitaciones.
- [x] Consultar usuarios y gestionar sus estados.
- [x] Añadir un listado administrativo de usuarios si es necesario; no se encontró una ruta general en las rutas revisadas.
- [x] Gestionar dominios institucionales con las APIs existentes.
- [x] Consultar docentes y asignar cuotas con periodo de vigencia.
- [x] Consultar consumo, reservas y disponibilidad de tokens.
- [x] Incorporar navegación por rol y estados vacíos o de error.

Regla de identidad: completar una invitación válida activa al usuario. La aprobación de docentes pendientes solo se aplica a los casos contemplados por el modelo vigente; no debe introducir un segundo paso obligatorio para toda invitación.

Estado: **completado el 2026-11-17**.

Evidencia:
- Nuevo `GET /api/auth/usuarios` con filtros por rol, estado, institución y búsqueda; y `GET /api/auth/admin/instituciones` con dominios y métricas.
- `PATCH /api/auth/usuarios/:id/estado` ahora gestiona estudiantes y docentes, protege al superadministrador y revoca sesiones al inactivar. Se corrigió una inferencia de tipos de PostgreSQL (`42P08`) separando el parámetro del estado.
- Vistas `dashboard`, `users`, `invitations`, `institutions` y `quotas` bajo `frontend/js/views/admin/`, con navegación completa para el rol.
- Invitaciones con creación, filtro por estado, revocación y enlace de desarrollo copiable; dominios institucionales con alta y activación/desactivación; cuotas por docente con periodo y panel de consumo.
- Prueba headless de interfaz: panel, usuarios, invitación con enlace, instituciones con dominio UTP, cuota y consumo. Sin errores de consola; los datos de prueba se eliminaron.
- Prueba de integración `admin-panel.integration.test.js` ejecutada y aprobada.

Referencias: `backend/routes/authRoutes.js`, `backend/routes/aiRoutes.js`, `backend/controllers/authController.js`, `backend/controllers/identityController.js`, `backend/controllers/aiQuotaController.js`, `frontend/js/views/home.js`, `frontend/js/layout.js`.

Verificación: invitación de docente y estudiante, registro, gestión de estado y asignación de cuota; impedir acceso de otros roles.

Criterio de finalización: el administrador habilita usuarios de la institución existente y asigna cuota al docente desde la interfaz.

### Bloque 3B — Superadministrador: instituciones y licencias

Dependencias: bloque 3A.

Objetivo: completar la gestión multiinstitucional.

- [x] Definir los campos editables y el comportamiento de activación e inactivación.
- [x] Implementar los endpoints faltantes de creación, edición y cambio de estado de instituciones.
- [x] Incorporar gestión de códigos de licencia como datos de la institución, sin utilizarlos para autorizar registros.
- [x] Crear las pantallas correspondientes y conectarlas con dominios e invitaciones.
- [x] Verificar autorización y efectos del estado institucional sobre los flujos existentes.

Situación inicial: se encontró consulta de instituciones y gestión de dominios, pero no un CRUD completo de instituciones.

Estado: **completado el 2026-11-17**.

Evidencia:
- Nuevos endpoints `POST /api/auth/admin/instituciones`, `PUT /api/auth/admin/instituciones/:id` y `PATCH /api/auth/admin/instituciones/:id/estado`, solo para superadministrador.
- Campos editables: `nombre`, `codigo_licencia` y `estado`. El código de licencia es informativo y no autoriza registros.
- Inactivar una institución revoca las sesiones de sus usuarios, bloquea el login y los tokens existentes, y evita nuevas invitaciones, cursos y dominios. Al reactivarla se puede volver a iniciar sesión.
- La vista de instituciones permite crear, editar, activar/inactivar, agregar dominios y activarlos. Se corrigió una inferencia de tipos de PostgreSQL (`42P08`) al cambiar el estado de un dominio.
- Verificación API del ciclo completo con una institución y un docente temporales; prueba headless de la interfaz de instituciones con alta, edición, dominio e inactivación. Datos temporales eliminados.

Verificación: crear otra institución, configurar dominio e invitar usuarios sin permitir acceso cruzado a recursos académicos.

Criterio de finalización: el administrador habilita y gestiona una institución adicional desde la web.

### Bloque 4 — Panel docente y contenido académico

Dependencias: bloque 3A.

Objetivo: preparar cursos con estudiantes y ejercicios utilizables.

- [x] Crear dashboard docente con indicadores disponibles en datos reales.
- [x] Listar, crear y editar cursos.
- [x] Consultar estudiantes matriculados.
- [x] Incorporar matrícula individual y carga CSV.
- [x] Mostrar resultados de importación por fila conforme al contrato del backend.
- [x] Adaptar el cliente API para enviar archivos mediante `FormData` sin forzar JSON.
- [x] Crear y editar ejercicios dentro de los mundos usando las APIs existentes.
- [x] Completar contenido base de los mundos 4, 5, 6 y 7.
- [x] Definir e implementar una carga explícita de ejercicios base en cursos nuevos.
- [x] Mostrar estados claros cuando un mundo o curso no tenga contenido.

Situación inicial: `createCurso` generaba siete mundos, pero no sus ejercicios. El contenido semilla revisado cubría los tres primeros mundos.

Estado: **completado el 2026-11-17**.

Evidencia:
- Nuevo catálogo `backend/config/baseContent.js` con 7 mundos y 21 ejercicios (3 por mundo); `createCurso` lo copia dentro de la misma transacción.
- `database/seeds.sql` incluye los ejercicios de los mundos 4–7 y `npm run db:sync-base-content` completó el curso demo existente (33 ejercicios insertados, 9 ya presentes).
- Las APIs de ejercicios ahora rechazan órdenes duplicados con `409` y un mensaje específico, tanto al crear como al editar.
- El cliente API acepta `FormData`; la matrícula CSV funciona desde el navegador con archivo o texto pegado y muestra el resumen y las incidencias por línea.
- Nuevas vistas `frontend/js/views/teacher/{dashboard,courses,course,world}.js`, rutas `/cursos`, `/cursos/:id` y `/mundos/:id`, navegación docente y estilos de tabla.
- Verificación por API: curso nuevo con 7 mundos y 21 ejercicios, 409 ante orden duplicado y curso demo con 3 ejercicios por mundo. `npm test`: 52 pruebas, 0 fallos, 5 omitidas por requerir `RUN_DB_TESTS`; la prueba de integración del bloque 4 se ejecutó aparte y pasó.
- Pendiente de comprobación visual en navegador de escritorio y móvil dentro del bloque 9.

Referencias: `backend/routes/cursoRoutes.js`, `backend/routes/ejercicioRoutes.js`, `backend/routes/mundoRoutes.js`, `backend/controllers/cursoController.js`, `backend/controllers/ejercicioController.js`, `database/seeds.sql`, `frontend/js/api.js`.

Verificación: crear curso, cargar contenido, matricular estudiantes y comprobar visibilidad desde sus cuentas; verificar CSV con filas válidas e inválidas y permisos por curso.

Criterio de finalización: un docente prepara un curso y sus estudiantes pueden abrir ejercicios reales.

### Bloque 5 — Gemini real y progresión del estudiante

Dependencias: bloques 3A y 4.

Objetivo: verificar el núcleo educativo completo con el proveedor real.

- [ ] Configurar una clave real de Gemini mediante el entorno.
- [ ] Verificar el modelo disponible para la cuenta y configurar `GEMINI_MODEL`.
- [ ] Asegurar una cuota docente vigente y suficiente.
- [ ] Verificar que código sintácticamente inválido no invoque IA ni consuma tokens.
- [ ] Verificar evaluación real de código válido, respuesta estructurada e historial persistido.
- [ ] Comprobar imputación del consumo y liberación de reservas cuando corresponda.
- [ ] Verificar XP, niveles, logros y desbloqueo secuencial.
- [ ] Verificar que reintentos no dupliquen llamadas confirmadas, consumo ni recompensas.
- [ ] Revisar mensajes de falta de cuota, indisponibilidad y timeout.
- [ ] Verificar conservación del trabajo del estudiante ante interrupciones.
- [ ] Recorrer el contenido de los siete mundos con soluciones de referencia.

Límite de alcance: el validador existente verifica sintaxis básica; no es un intérprete PSeInt completo. Si la entrega exige ejecución automática con entradas y salidas, se debe acordar y planificar ese motor adicional.

Referencias: `backend/services/pseintValidator.js`, `backend/services/geminiService.js`, `backend/controllers/evaluationController.js`, `backend/services/tokenService.js`, `backend/services/gamificationService.js`, `backend/services/achievementService.js`, `frontend/js/views/student/workspace.js`, `PHASE3_EVALUATION_RUNBOOK.md`.

Verificación: usar pruebas controladas para errores e idempotencia y una prueba acotada con Gemini real para validar credenciales, modelo y contrato externo.

Criterio de finalización: el estudiante recibe una evaluación real y su avance se conserva de forma coherente y sin recompensas duplicadas.

### Bloque 6 — Kahoot desde el navegador

Dependencias: bloque 4. Puede desarrollarse de manera independiente del bloque 5.

Objetivo: completar una partida multijugador con interfaces de docente y estudiante.

#### 6A. Docente anfitrión

- [x] Crear formulario de preguntas, opciones, tiempos y puntuación.
- [x] Crear o abrir una sala con las APIs y eventos existentes.
- [x] Mostrar PIN, participantes y estado de conexión.
- [x] Iniciar partida y controlar el avance de preguntas.
- [x] Mostrar cronómetro sincronizado con el servidor y conteo de respuestas.
- [x] Mostrar estadísticas, ranking y podio final.
- [x] Recuperar el control de la sala tras reconexión.

#### 6B. Estudiante participante

- [x] Entrar mediante PIN y apodo.
- [x] Mostrar lobby y estado de conexión.
- [x] Mostrar preguntas y botones táctiles accesibles para responder.
- [x] Mostrar recepción de respuesta sin revelar anticipadamente el acierto.
- [x] Mostrar resultado, posición y XP al recibir los eventos correspondientes.
- [x] Recuperar estado tras reconexión.
- [x] Gestionar sala cancelada, sesión reemplazada y docente desconectado.

#### 6C. Integración

- [x] Cargar el cliente Socket.IO de forma compatible con la CSP.
- [x] Autenticar conexiones con el JWT y limpiar suscripciones al salir de la vista.
- [x] Verificar que no se exponga la respuesta correcta antes del cierre de la pregunta.
- [x] Integrar acceso a las salas en la navegación de cada rol.

Restricción operativa: una sola instancia del servidor. Las salas activas se coordinan en memoria; el arranque cancela salas persistidas que quedaron activas y no pueden recuperarse desde esa memoria.

Estado: **completado el 2026-11-17**.

Evidencia:
- Nuevo cliente `frontend/js/socket.js` que importa el bundle ESM servido por el backend (`/socket.io/socket.io.esm.min.js`) y autentica con el JWT de `sessionStorage`.
- Vistas docentes `salas.js` (listado, historial y constructor de preguntas) y `host.js` (lobby, PIN, participantes, cuenta regresiva, pregunta, estadísticas, podio y reconexión con `room:host`).
- Vistas estudiantes `play.js` (PIN, apodo y salas activas) y `play-room.js` (lobby, pregunta, respuesta, resultado, podio, reconexión, sesión reemplazada y sala cancelada). El XP de la barra superior se refresca al recibir el podio.
- Rutas `#/salas`, `#/salas/:pin`, `#/jugar` y `#/jugar/:pin`, con navegación por rol y estilos de botones táctiles, cronómetro y podio.
- La respuesta correcta solo se revela en `question:results` (docente) y `answer:result` (estudiante); las preguntas no incluyen `es_correcta`.
- Prueba de interfaz con Chrome headless: login docente y estudiante, creación de sala, lobby, inicio, pregunta, respuesta, estadísticas, podio e historial con detalle. Sin errores de consola.
- `npm test`: 52 pruebas, 0 fallos, 5 omitidas. Las integraciones `teacher-content` y `kahoot-realtime` se ejecutaron por separado y pasaron.

Referencias: `backend/routes/salaRoutes.js`, `backend/services/salaService.js`, `backend/sockets/kahootHandler.js`, `PHASE4_KAHOOT_RUNBOOK.md`.

Verificación: docente y varios estudiantes en navegadores separados; respuestas simultáneas, intento de doble respuesta, timeout, reconexión y cierre de partida.

Criterio de finalización: una partida completa se juega desde las interfaces y guarda resultados y XP una sola vez.

### Bloque 7 — Sílabos y generación de contenido

Dependencias: bloques 4 y 5.

Objetivo: convertir un sílabo en contenido revisable e incorporable al curso.

- [ ] Definir el contrato de carga, procesamiento y confirmación de contenido.
- [ ] Implementar API y pantalla de carga de PDF.
- [ ] Validar archivo y tamaño y almacenar el documento.
- [ ] Extraer texto y gestionar documentos sin texto extraíble con un estado comprensible.
- [ ] Mostrar estados de carga, procesamiento, finalización y error.
- [ ] Integrar generación de propuestas de mundos y ejercicios con IA.
- [ ] Aplicar cuota, reserva, registro de uso e idempotencia a esta operación.
- [ ] Permitir revisión y confirmación del docente antes de incorporar contenido.
- [ ] Gestionar reintentos y evitar contenido duplicado.
- [ ] Definir cómo se integran los mundos generados con la progresión existente.

Situación inicial: este bloque requiere backend y frontend nuevos; la existencia de tablas o referencias a `generacion_mundo` no demuestra que el flujo esté implementado.

Verificación: PDF válido, documento sin texto, fallo del proveedor, cuota insuficiente y reintento; comprobar aislamiento del curso e incorporación confirmada.

Criterio de finalización: el docente carga un sílabo y confirma contenido generado que queda disponible en el curso con su consumo registrado.

### Bloque 8 — Analíticas académicas

Dependencias: bloques 4, 5 y 6.

Objetivo: facilitar seguimiento del avance y de las dificultades de los estudiantes.

- [x] Implementar consultas y endpoints de rendimiento por curso.
- [x] Mostrar avance por estudiante y mundo.
- [x] Mostrar ejercicios aprobados, intentos y resultados.
- [x] Resumir categorías de error de las evaluaciones.
- [x] Mostrar resultados históricos de salas.
- [x] Mostrar consumo IA del docente reutilizando las APIs existentes donde corresponda.
- [x] Añadir filtros pertinentes y estados sin datos.
- [x] Asegurar consultas autorizadas y coherencia entre tablas, gráficos y detalle.

Estado: **completado el 2026-11-17**.

Evidencia:
- Nuevo módulo `/api/analiticas` con resumen de cursos, detalle por curso y detalle por estudiante; protegido para docentes y superadministradores y aislado con `getAuthorizedCourse`.
- Agregados de estudiantes, avance por mundo, ejercicios aprobados, envíos, promedios, categorías de error y últimas 20 salas del curso.
- Vistas `teacher/analytics.js` y `teacher/analytics-course.js` con filtros de curso, pestañas de mundos, estudiantes, errores y salas, detalle de estudiante y consumo IA reutilizando `/api/ia/consumo`.
- Verificación headless con datos sintéticos: avance, promedio, errores, envíos, salas y consumo. Los datos se eliminaron y el progreso se restauró.
- Prueba de integración `analytics.integration.test.js` ejecutada y aprobada.

Verificación: comparar agregados con registros de referencia y comprobar que un docente no acceda a cursos ajenos.

Criterio de finalización: el docente identifica avance, estudiantes que necesitan apoyo y errores frecuentes mediante datos verificables.

### Bloque 9 — Verificación final, documentación y entrega

Dependencias: todos los bloques comprometidos para la entrega.

Objetivo: entregar una aplicación reproducible y demostrable.

- [x] Ejecutar las suites existentes y corregir fallos.
- [ ] Ejecutar integración con PostgreSQL sobre una base separada.
- [x] Completar pruebas de permisos entre roles, cursos e instituciones.
- [ ] Acordar la cantidad objetivo de participantes y probar concurrencia y reconexión.
- [ ] Verificar escritorio, móvil, teclado, foco y mensajes de error.
- [ ] Documentar API REST y eventos Socket.IO.
- [x] Actualizar `PLAN_CODEINT.md` y runbooks con el estado real.
- [x] Preparar datos y guion de demostración.
- [ ] Verificar instalación desde cero y restauración de la base de entrega.
- [x] Revisar los archivos preparados, modificados y sin seguimiento antes de organizar la entrega en Git.

Estado: **en curso**. La entrega se definió como demostración local; el despliegue público queda fuera de alcance.

Evidencia:
- `RUN_DB_TESTS=1 npm test`: 54 pruebas, 0 fallos, 0 omitidas.
- `npm run db:audit` sin hallazgos y `npm run test:db` exitoso.
- Guion de demostración en [`DEMO_GUION.md`](DEMO_GUION.md).
- Permisos verificados en pruebas de integración y recorridos headless para docente, estudiante, superadministrador, instituciones inactivas y analíticas.
- Pendientes: integración sobre una base separada, revisión visual/accesible en navegador real, documentación REST completa, concurrencia acordada e instalación desde cero/restauración.

#### Si la entrega incluye publicación en Internet

- [ ] Elegir entorno compatible con el proceso Node.js y Socket.IO de larga duración.
- [ ] Configurar dominio, HTTPS y ejecución persistente con reinicio del proceso.
- [ ] Configurar secretos, correo, URLs y orígenes permitidos del entorno publicado.
- [ ] Comprobar WebSocket y reconexión a través del proxy.
- [ ] Verificar copias de seguridad, restauración y monitoreo.
- [ ] Ejecutar `npm run security:production-check`.
- [ ] Verificar también servicios externos y flujos completos: ese comando no sustituye pruebas funcionales ni de despliegue.

Criterio de finalización: instalación reproducible, pruebas acordadas aprobadas y demostración completa del alcance comprometido.

## 6. Forma de trabajar cada bloque

1. Revisar el código, configuración y cambios locales implicados.
2. Precisar el alcance de la entrega del bloque y cualquier decisión pendiente.
3. Implementar reutilizando contratos y componentes existentes.
4. Verificar las condiciones de aceptación y las regresiones relevantes.
5. Mostrar un recorrido funcional del resultado.
6. Actualizar casillas y registrar evidencia de las comprobaciones.
7. Continuar con el siguiente bloque cuando los pendientes bloqueantes estén resueltos.

Un bloque no se considera terminado solo por tener archivos o pantallas: debe cumplir su criterio de finalización con datos reales o pruebas controladas apropiadas para ese escenario.

## 7. Decisiones pendientes

- [x] Confirmar si la entrega es una demostración local o un despliegue público. → Demostración local; el despliegue público queda fuera de alcance.
- [ ] Confirmar cantidad objetivo de participantes simultáneos para la sala.
- [x] Confirmar si se exige un intérprete PSeInt o basta el flujo de validación básica y evaluación IA previsto. → Validación sintáctica y evaluación con IA, sin intérprete.
- [x] Elegir cómo se carga el catálogo base de ejercicios en cursos nuevos. → Catálogo en `backend/config/baseContent.js`, copiado por `createCurso`, replicado en seeds y con script de sincronización idempotente.
- [ ] Definir revisión e incorporación de contenido generado desde sílabos y su relación con los siete mundos.

Estas decisiones se resuelven antes del bloque que afecten; no impiden comenzar el bloque 1.

## 8. Primer paso de implementación

Comenzar por el **bloque 1**, con foco en:

1. Estado de migraciones y reproducibilidad de la base.
2. Separación del usuario de runtime PostgreSQL.
3. Enlaces de invitación y recuperación compatibles con puerto y router.
4. Guía verificada de instalación y arranque.

Para modificar el proyecto se debe cambiar del agente de planificación al agente de implementación. Este archivo se guarda en la carpeta de planes permitida durante el modo planificación; al cambiar de agente puede incorporarse a la raíz del proyecto como `CODEINT_PLAN_IMPLEMENTACION.md`.
