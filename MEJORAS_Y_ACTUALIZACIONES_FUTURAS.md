# codeInt — Mejoras y actualizaciones futuras

Repositorio revisado: `NeilMoreno/UTP-KAHOOT_PRI_ALGORITMO`
Fecha de la revisión: 20 de noviembre de 2026

---

## 0. Alcance y límites de esta revisión

Este documento se basa en lo que está **documentado** en el repositorio:

- `README.md`
- `CODEINT_PLAN_IMPLEMENTACION.md` (plan y estado por bloques)
- `BACKEND_SECURITY_AUDIT.md`
- La estructura de carpetas y archivos de la raíz

**No se revisó el código fuente** (`backend/`, `frontend/`, `database/`, `tests/`). Por eso:

- Las observaciones sobre código concreto son **hipótesis a verificar**, no hallazgos confirmados.
- Algunas mejoras pueden estar ya resueltas en el código aunque la documentación no lo diga.
- Cada punto indica su origen: **[Doc]** = respaldado por la documentación del repo, **[Sugerencia]** = propuesta de la revisión.

---

## 1. Resumen ejecutivo

codeInt es una plataforma EdTech gamificada para aprender a programar (PSeInt, Python, JavaScript, Java y C/C++), con evaluación asistida por IA (Gemini) y salas multijugador estilo Kahoot. Stack: Node.js 22, Express, Socket.IO, PostgreSQL 16+ y frontend HTML/CSS/JS modular sin build.

**Lo que está bien resuelto**

- Seguridad de identidad: invitaciones de un solo uso, tokens hasheados, revocación de JWT, rol PostgreSQL de runtime sin privilegios, auditoría inmutable, CORS/Helmet/rate limiting.
- Integridad de datos: triggers de integridad relacional, idempotencia en cuotas IA y XP.
- Documentación abundante: runbooks, diccionario de datos, guion de demo, plan por bloques con evidencia.
- Pruebas: unitarias, integración con base separada (`codeint_test`) y e2e con Playwright; CI con `npm audit`.
- Funcionalidad pedagógica amplia: diagnóstico, teoría por mundo, ejercicios variados, racha, misiones, logros, informe de integridad, analíticas.

**Las cinco brechas más importantes**

1. La evaluación con Gemini real **nunca fue verificada de extremo a extremo** (bloque 5 sin completar).
2. No hay **ejecución real de código**: solo validación sintáctica de PSeInt + juicio de la IA.
3. Solo PSeInt tiene contenido base; los otros cuatro lenguajes "existen" pero nacen vacíos.
4. Hay **credenciales demo publicadas** en el README y un `.zip` con una base de datos en la raíz.
5. Faltan piezas para producción: correo real, observabilidad, backups, API documentada, pruebas de carga.

---

## 2. Prioridades

| Prioridad | Significado |
| --- | --- |
| **P0** | Corregir antes de cualquier demo pública o uso con estudiantes reales |
| **P1** | Alto valor; cierra pendientes ya declarados en el plan |
| **P2** | Mejora importante de producto o calidad |
| **P3** | Evolución a mediano/largo plazo |

---

## 3. P0 — Antes de exponer el sistema

### 3.1 Credenciales y datos en el repositorio público [Doc]

- El `README.md` publica las cuentas demo (`docente.demo@utp.edu.pe`, `estudiante.demo@utp.edu.pe`) con la contraseña `codeint123`, y menciona además un superadministrador de pruebas (`admin@codeintcorp.com` / `codeint123`).
- `BACKEND_SECURITY_AUDIT.md` reconoce que hay una "contraseña administrativa conocida del entorno demo" que debe rotarse antes de un despliegue público.
- En la raíz hay un archivo `codeint-base-datos-pruebas-2026-10-27.zip`. Un volcado de base de datos no debería vivir en un repositorio público.

**Acciones**

- [ ] Revisar el contenido del `.zip`. Si contiene correos, hashes o datos reales, tratarlo como filtración: eliminarlo del historial (`git filter-repo` o BFG) y rotar lo que corresponda.
- [ ] Sacar el `.zip` del repo (usar un release privado, almacenamiento externo o un script que regenere los datos).
- [ ] Reemplazar en el README las contraseñas literales por "ver `DEMO_GUION.md`" y/o generarlas por script.
- [ ] Mantener el bloqueo de `db:seed` en producción y añadir un chequeo en `security:production-check` que falle si existen cuentas `*.demo@*`.
- [ ] Activar **GitHub secret scanning** y **push protection** en el repositorio.
- [ ] Confirmar que ninguna versión histórica de `.env` fue commiteada.

### 3.2 Documentos con datos locales o internos [Doc]

- `CODEINT_PLAN_IMPLEMENTACION.md` incluye una ruta local (`C:\xampp\htdocs\kahoot`) y un párrafo final sobre "agente de planificación / agente de implementación" que es ruido de proceso y no pertenece a la documentación del producto.
- Los reportes en `security-reports/` (sqlmap, Nuclei) deben revisarse para confirmar que no incluyan URLs internas, tokens ni cabeceras de sesión.

- [ ] Limpiar rutas locales y notas de proceso de los documentos.
- [ ] Revisar `security-reports/` antes de mantenerlos públicos.

### 3.3 Correo real [Doc]

El registro es **solo por invitación** y la recuperación de contraseña depende del correo. El bloque 2 deja pendiente configurar y verificar `EMAIL_PROVIDER=cloudflare` con credenciales reales.

- [ ] Configurar el proveedor y verificar recepción de invitación y recuperación.
- [ ] Configurar SPF, DKIM y DMARC del dominio remitente.
- [ ] Plantillas de correo en español con texto claro, caducidad visible y aviso de "si no fuiste tú".
- [ ] Mantener las variables `ALLOW_DEV_*_TOKEN_RESPONSE` apagadas fuera de local (ya existe el chequeo; añadirlo también como prueba de CI sobre la config de producción).

---

## 4. P1 — Cerrar lo que el plan ya declara pendiente

### 4.1 Verificar Gemini real de extremo a extremo (Bloque 5) [Doc]

Es el corazón del producto y ninguna casilla del bloque 5 está marcada.

- [ ] Configurar clave real y fijar `GEMINI_MODEL` (el README recomienda un modelo `flash-lite` por saturación de `flash` en el plan gratuito).
- [ ] Probar: código inválido **no** llama a IA ni consume tokens; código válido sí, con respuesta estructurada persistida.
- [ ] Probar idempotencia de reintentos (sin doble consumo ni doble XP).
- [ ] Probar mensajes de falta de cuota, timeout e indisponibilidad del proveedor.
- [ ] Recorrer los 7 mundos con soluciones de referencia y registrar el resultado.
- [ ] Crear un **conjunto de evaluación ("golden set")**: soluciones correctas, casi correctas e incorrectas con la nota esperada, para medir la consistencia de la IA cuando se cambie de modelo o de prompt.

> Nota de privacidad: el README sugiere la clave gratuita de Google AI Studio. Conviene verificar en los términos vigentes si el contenido enviado en el plan gratuito puede usarse para mejorar los productos del proveedor. Si se procesa código de estudiantes reales, evaluar un plan con condiciones adecuadas y avisarlo en el consentimiento.

### 4.2 Sílabos → contenido generado (Bloque 7) [Doc]

Sin iniciar. Decisión pendiente: cómo se revisa e incorpora el contenido generado y cómo se relaciona con los siete mundos.

- [ ] Definir el contrato: carga de PDF → extracción → borrador → edición → publicación.
- [ ] Manejar PDF escaneado (sin texto extraíble) con un estado claro; considerar OCR opcional.
- [ ] Reservar/confirmar cuota de IA de forma idempotente (reutilizar `tokenService`).
- [ ] Evitar duplicados al reintentar.
- [ ] Marcar el contenido generado como "borrador de IA" hasta que el docente lo apruebe.

### 4.3 Cierre del Bloque 9 [Doc]

- [ ] Integración sobre base separada ejecutada y registrada.
- [ ] Revisión visual y de accesibilidad en navegador real (escritorio y móvil).
- [ ] **Documentación REST y de eventos Socket.IO completa** (ver 6.3).
- [ ] Definir el número objetivo de participantes simultáneos en una sala y probar concurrencia y reconexión.
- [ ] Instalación desde cero + restauración de base verificadas.

### 4.4 Documentación desactualizada [Doc]

Hay contradicciones entre documentos, señal de que se están desfasando:

| Documento | Dice | Otro documento dice |
| --- | --- | --- |
| `BACKEND_SECURITY_AUDIT.md` | La base tiene **7** migraciones | `CODEINT_PLAN_IMPLEMENTACION.md`: **9** migraciones |
| `BACKEND_SECURITY_AUDIT.md` | Salas multijugador, frontend de administración y PSeInt están **pendientes** | El plan los marca como **completados** |
| `BACKEND_SECURITY_AUDIT.md` | 17 pruebas Node | El plan: 54 pruebas con `RUN_DB_TESTS=1` |

- [ ] Actualizar `BACKEND_SECURITY_AUDIT.md` con una fecha y estado reales.
- [ ] Añadir un **`CHANGELOG.md`** (formato "Keep a Changelog") y dejar de usar el plan como historial.
- [ ] Mover los resultados de pruebas a un solo lugar en lugar de copiarlos en varios `.md`.

---

## 5. P2 — Producto y experiencia

### 5.1 Ejecución real de código y evaluación híbrida [Doc + Sugerencia]

Hoy el validador PSeInt revisa sintaxis básica y no es un intérprete; la nota depende de la IA. El plan lo acepta como decisión de alcance, pero tiene consecuencias: la IA puede aprobar código incorrecto o reprobar código válido, y no hay forma objetiva de comprobarlo.

**Propuesta**

- [ ] Añadir **casos de prueba** (entradas → salidas esperadas) a los ejercicios de "escribir código".
- [ ] Ejecutar el código del estudiante en un entorno aislado y usar la IA solo para la **retroalimentación pedagógica**, no para decidir si funciona.
- [ ] Opciones de ejecución, de menor a mayor complejidad:
  - Intérprete de PSeInt propio o existente en un worker aislado.
  - Python en el navegador con Pyodide, y JavaScript en un Web Worker, sin riesgo para el servidor.
  - Servicio de ejecución remota en contenedor (por ejemplo Judge0 o Piston) con límites de CPU, memoria, tiempo y sin red.
- [ ] Nunca ejecutar código de estudiantes directamente en el proceso del backend.

### 5.2 Cursos multilenguaje con contenido real [Doc]

El README indica que se soportan PSeInt, Python, JavaScript, Java y C/C++, pero **solo PSeInt nace con los 7 mundos base**. Un docente que cree un curso de Python empieza con una estructura vacía.

- [ ] Catálogos base por lenguaje (aunque sean 3 mundos al inicio).
- [ ] Mostrar en la interfaz qué lenguajes tienen contenido base y cuáles dependen de la generación por sílabo.
- [ ] El editor debería adaptar resaltado de sintaxis y validación por lenguaje.

### 5.3 Experiencia del estudiante [Sugerencia]

- [ ] **Pistas graduales** en ejercicios (sin penalizar la primera) y explicación de la solución tras N intentos.
- [ ] **Repaso espaciado**: reaparición de ejercicios fallados o antiguos.
- [ ] **Ruta adaptativa** usando el diagnóstico inicial y las categorías de error ya registradas.
- [ ] **Modo práctica sin XP** para experimentar sin presión.
- [ ] Guardado automático del borrador del editor (el plan lo menciona como pendiente de verificar en el bloque 5).
- [ ] Notificaciones opcionales de racha y misiones.
- [ ] PWA / uso móvil mejorado: las salas Kahoot ya se juegan desde el móvil, pero el editor de código en móvil suele ser el punto débil.

### 5.4 Salas Kahoot [Sugerencia]

- [ ] Más tipos de pregunta: verdadero/falso, respuesta múltiple con varias correctas, ordenar, completar código, "¿qué imprime este código?".
- [ ] Preguntas con imagen o bloque de código con resaltado.
- [ ] Modo equipos y modo "a tu ritmo" (asincrónico) para tarea.
- [ ] Vista de proyector para el docente (ranking grande, sin controles).
- [ ] Importar/exportar banco de preguntas (CSV/JSON) y compartir bancos entre docentes del mismo curso o institución.
- [ ] Reportes de sala descargables.
- [ ] Defensas contra abuso: límites por IP/usuario al unirse, moderación de apodos, expulsión de participantes.
- [ ] Escalabilidad: las salas viven **en memoria de una sola instancia** [Doc]. Si se necesita más de una instancia, usar el adaptador Redis de Socket.IO y mover el estado de salas a Redis.

### 5.5 Panel docente [Sugerencia]

- [ ] Alertas de "estudiantes en riesgo" (sin actividad, muchos intentos fallidos, categorías de error repetidas).
- [ ] Comentarios manuales del docente sobre una entrega, además de la evaluación de IA.
- [ ] Rúbricas configurables por ejercicio.
- [ ] Posibilidad de **revisar y anular** una nota de la IA (con registro de auditoría).
- [ ] Exportación a XLSX además de CSV.
- [ ] Integración con un LMS (por ejemplo vía LTI 1.3) para notas y accesos. Evaluar qué LMS usa realmente la institución antes de invertir en esto.

### 5.6 Integridad académica [Doc + Sugerencia]

El sistema ya registra pegado, salidas de pestaña, parecido entre estudiantes e intentos de manipular la IA.

- [ ] Documentar el **umbral de parecido** y su tasa de falsos positivos esperada; en ejercicios cortos y comunes, dos estudiantes honestos pueden producir código casi idéntico.
- [ ] Presentar estas señales al docente como **indicios, no como prueba** (ya sugerido por `INTEGRIDAD_ACADEMICA.md`; reforzar en la interfaz).
- [ ] Informar claramente al estudiante qué se registra (transparencia) y permitirle ver su propio informe.
- [ ] Definir un periodo de retención de estos datos.

### 5.7 Accesibilidad e internacionalización [Sugerencia]

- [ ] Auditoría con axe/Lighthouse y prueba manual con teclado y lector de pantalla (pendiente en el bloque 9).
- [ ] Contraste y tamaño de texto en el avatar pixel y los elementos de gamificación.
- [ ] Soporte para reducir animaciones (`prefers-reduced-motion`).
- [ ] Preparar i18n si se piensa abrir fuera del ámbito hispanohablante.

---

## 6. P2 — Ingeniería y operación

### 6.1 Autenticación y sesión [Doc + Sugerencia]

- El JWT dura **30 minutos** y la documentación indica que el cliente lo guarda en `sessionStorage`. Un XSS podría robarlo; el CSP y Helmet mitigan, pero no eliminan el riesgo.
- [ ] Evaluar cookies `HttpOnly; Secure; SameSite` con un esquema de **refresh token rotativo**, en lugar de JWT en `sessionStorage`.
- [ ] Sin refresh, el usuario es expulsado cada 30 minutos aunque esté jugando una sala; verificar el comportamiento en una partida larga.
- [ ] **MFA** para docentes y superadministrador (la propia auditoría lo menciona).
- [ ] Política de bloqueo progresivo tras intentos fallidos, además del rate limiting.
- [ ] **SSO institucional** (Microsoft Entra / Google Workspace) para reducir la fricción del registro por invitación y delegar la verificación de identidad. Mantener las invitaciones como alternativa.

### 6.2 Seguridad adicional [Sugerencia]

- [ ] Dependabot (o Renovate) para dependencias y GitHub Actions.
- [ ] CodeQL en CI.
- [ ] Un `SECURITY.md` con el canal para reportar vulnerabilidades.
- [ ] Revisar que el modelo de **prompt injection** (documentado en `INTEGRIDAD_ACADEMICA.md`) tenga pruebas automáticas con un conjunto de ataques conocidos.
- [ ] Cabeceras de seguridad verificadas en el despliegue real, no solo en local (el chequeo `production-check` no reemplaza pruebas funcionales, como el propio plan advierte).
- [ ] Rotación documentada de `JWT_SECRET` (qué pasa con las sesiones activas).

### 6.3 API documentada [Doc]

La auditoría y el plan listan OpenAPI como pendiente.

- [ ] Generar una especificación **OpenAPI 3.1** (idealmente desde los esquemas de validación para que no se desincronice).
- [ ] Documentar los **eventos de Socket.IO** (hoy en `PHASE4_KAHOOT_RUNBOOK.md`) con un formato tipo AsyncAPI.
- [ ] Publicar una colección de ejemplo (Bruno/Postman).

### 6.4 Calidad de código y pruebas [Sugerencia]

- [ ] Medir **cobertura** y fijar un umbral mínimo en CI.
- [ ] ESLint + Prettier con verificación en CI.
- [ ] Mover progresivamente a **TypeScript** (o al menos JSDoc + `// @ts-check`) en servicios críticos: `tokenService`, `gamificationService`, `salaService`, `evaluationController`.
- [ ] Ejecutar la suite e2e de Playwright en CI, no solo en local.
- [ ] La nota del audit menciona que `node --test` falló en un sandbox por procesos trabajadores; si pasa también en CI, conviene fijarlo con `--test-concurrency=1` o similar para que sea reproducible.
- [ ] Pruebas de **carga y concurrencia** para salas (por ejemplo con k6 o Artillery) una vez definido el número de participantes.

### 6.5 Observabilidad y operación [Doc + Sugerencia]

- [ ] Logs estructurados (por ejemplo `pino`) con `request_id` y sin datos sensibles.
- [ ] Métricas: latencia, errores, tiempo y costo de llamadas a Gemini, salas activas, conexiones WebSocket.
- [ ] Alertas ante saturación de cuota IA o fallos repetidos del proveedor.
- [ ] Estrategia de **backups** y prueba de restauración periódica (la auditoría lo lista como pendiente).
- [ ] `GET /api/health` ampliado con comprobación real de base de datos (readiness vs liveness).
- [ ] Apagado ordenado (graceful shutdown) que notifique a las salas activas.

### 6.6 Infraestructura y despliegue [Doc + Sugerencia]

- El despliegue previsto es de pruebas (Render + Neon + Mailtrap). El plan define la entrega como **demostración local**.
- [ ] Añadir un **`Dockerfile`** y `docker-compose.yml` (app + PostgreSQL) para que la instalación no dependa de PowerShell ni de `psql` en el PATH.
- [ ] Hoy el bootstrap interactivo del superadministrador requiere **PowerShell** (README): ofrecer una alternativa multiplataforma en Node.
- [ ] Si se publica en Internet: dominio, HTTPS, reinicio automático, prueba de WebSocket detrás del proxy y política de secretos (lista ya detallada en el bloque 9 del plan).
- [ ] Migraciones: documentar la estrategia para ejecutarlas sin tiempo de inactividad y cómo hacer rollback.

### 6.7 Base de datos [Sugerencia]

- [ ] Revisar índices con `EXPLAIN` en las consultas de analíticas y ranking cuando haya volumen.
- [ ] Particionar o archivar tablas de auditoría y envíos antiguos si crecen.
- [ ] Política de **retención y borrado** de datos de estudiantes (ver 7).
- [ ] Mantener el diccionario de datos generado (`npm run docs:dictionary`) dentro de CI para que no quede obsoleto.

---

## 7. Privacidad y cumplimiento [Sugerencia]

El sistema trata datos de estudiantes y envía su código a un proveedor externo de IA.

- [ ] Aviso de privacidad y consentimiento visibles al primer ingreso, indicando qué se envía a Gemini.
- [ ] Verificar con el área legal o institucional los requisitos aplicables (en Perú, la Ley de Protección de Datos Personales y su reglamento; confirmar vigencia y alcance con asesoría).
- [ ] Derecho de acceso, rectificación y eliminación: flujo de exportación y borrado de cuenta.
- [ ] Minimizar datos enviados a la IA (sin nombres ni correos en los prompts).
- [ ] Política de retención de evaluaciones, informes de integridad y auditoría.

---

## 8. P3 — Hoja de ruta a largo plazo

- Intérprete PSeInt completo con depuración paso a paso y visualización de variables.
- Modo "ejercicios generados por IA" bajo demanda del estudiante, con control de costo.
- Torneos entre cursos o instituciones y ligas semanales.
- Aplicación móvil nativa o PWA instalable con modo sin conexión para teoría.
- Analíticas predictivas (riesgo de abandono) con datos agregados y anonimizados.
- Marketplace de bancos de preguntas y cursos entre docentes.
- Multi-tenant real con branding por institución.

---

## 9. Orden de ejecución sugerido

1. **Semana 1 (P0):** limpiar credenciales y `.zip`, activar secret scanning, limpiar documentos, correo real.
2. **Semanas 2–3 (P1):** validar Gemini real con golden set, cerrar bloque 9, reconciliar documentación, añadir CHANGELOG.
3. **Semanas 4–6 (P1/P2):** casos de prueba y ejecución aislada para ejercicios, contenido base para Python y JavaScript, OpenAPI.
4. **Semanas 7–9 (P2):** sílabos (bloque 7), Docker, observabilidad, CI ampliado (cobertura, lint, CodeQL, e2e).
5. **Después:** MFA/SSO, tipos de pregunta nuevos, alertas docentes, LMS, escalado horizontal de salas.

---

## 10. Checklist rápido

**Seguridad y datos**
- [ ] `.zip` de base de datos fuera del repo
- [ ] Contraseñas demo fuera del README
- [ ] Secret scanning + push protection
- [ ] Rotar contraseña del superadministrador
- [ ] Correo real con SPF/DKIM/DMARC
- [ ] Revisar `security-reports/`

**Producto**
- [ ] Gemini real validado con golden set
- [ ] Ejercicios con casos de prueba y ejecución aislada
- [ ] Contenido base para otros lenguajes
- [ ] Sílabos → contenido generado
- [ ] Nuevos tipos de pregunta en salas

**Ingeniería**
- [ ] OpenAPI + AsyncAPI
- [ ] CI con lint, cobertura, CodeQL, e2e
- [ ] Dockerfile / docker-compose
- [ ] Logs estructurados y métricas
- [ ] Backups con restauración probada
- [ ] Pruebas de carga de salas

**Documentación**
- [ ] CHANGELOG.md
- [ ] Reconciliar auditoría y plan
- [ ] SECURITY.md y LICENSE
- [ ] Descripción y topics del repositorio en GitHub (hoy figura "No description, website, or topics provided")
- [ ] README: separar "uso rápido" de la referencia técnica extensa

**Organización del repositorio**
- [ ] Mover PDFs, `.docx`, `.drawio` y `.png` de la raíz a `DOCS/` (modelo relacional, normalización, diccionario, DER, avances)
- [ ] Unificar nombres de documentos (hoy conviven `PLAN_CODEINT.md`, `CODEINT_PLAN_IMPLEMENTACION.md` y varios runbooks `PHASE*`)
- [ ] Alinear el nombre del repositorio (`UTP-KAHOOT_PRI_ALGORITMO`) con el producto (`codeInt`)

---

*Documento generado a partir de la documentación pública del repositorio. Se recomienda contrastar cada punto con el código antes de planificarlo.*
