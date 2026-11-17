# codeInt

Plataforma EdTech gamificada para aprender algoritmos en PSeInt, con evaluación asistida por IA y salas multijugador síncronas estilo Kahoot.

- Frontend: HTML, CSS y JavaScript modular (sin build, servido por el backend).
- Backend: Node.js, Express, Socket.IO y PostgreSQL.
- Estado y plan de cierre: [`CODEINT_PLAN_IMPLEMENTACION.md`](CODEINT_PLAN_IMPLEMENTACION.md).

## Requisitos

- Node.js 22 o superior.
- PostgreSQL 16 o superior (validado con PostgreSQL 18).
- `psql` disponible en el `PATH`.
- PowerShell en Windows para el bootstrap interactivo del superadministrador.

## Instalación local

### 1. Dependencias y variables de entorno

```powershell
npm install
Copy-Item .env.example .env
```

Edita `.env` con las credenciales reales de PostgreSQL. Las URLs del frontend deben usar el router por hash:

```dotenv
FRONTEND_INVITATION_URL=http://localhost:3000/#/registro
FRONTEND_PASSWORD_RESET_URL=http://localhost:3000/#/restablecer-password
```

### 2. Crear la base de datos y aplicar el esquema

```powershell
npm run db:create
npm run db:schema
```

`db:create` crea la base si no existe y no modifica una existente. `db:schema` aplica `database/schema.sql` únicamente sobre una base vacía.

`schema.sql` es el volcado canónico completo. Registra las migraciones que ya incorpora, así que `db:migrate` puede ejecutarse sin reaplicarlas.

> `database/create_db.sql` es la variante destructiva para `psql`: **elimina** la base `codeint_db` si ya existe. No la uses sobre datos que quieras conservar.

### 3. Migraciones y datos demo

```powershell
npm run db:migrate
npm run db:seed
```

`db:seed` falla intencionalmente con `NODE_ENV=production`. Las cuentas demo son:

| Rol | Correo | Contraseña |
|---|---|---|
| Docente | `docente.demo@utp.edu.pe` | `codeint123` |
| Estudiante | `estudiante.demo@utp.edu.pe` | `codeint123` |

Si actualizas una instalación existente que ya tenía los siete mundos creados pero sin el contenido de los mundos 4 a 7, ejecuta `npm run db:sync-base-content`. El script es idempotente y no sobrescribe ejercicios personalizados.

El superadministrador **no** se crea con los seeds.

### 4. Crear el superadministrador

```powershell
npm run db:bootstrap-superadmin:prompt
```

El correo fijo es `admin@codeintcorp.com`. La contraseña se solicita de forma oculta y debe cumplir la política de la aplicación.

### 5. Separar la cuenta de runtime de la cuenta propietaria

```powershell
npm run db:provision-app-db-role
```

Crea o rota `codeint_app` con privilegios mínimos y actualiza `.env` sin mostrar la contraseña. La API usa `DATABASE_URL`; las migraciones usan `MIGRATION_DATABASE_URL`.

> Si `DATABASE_URL` no está definida, la API cae a `DB_HOST`/`DB_USER`/... y mostrará una advertencia si esa conexión es superusuario.

### 6. Verificar y arrancar

```powershell
npm run db:audit
npm run test:db
npm start
```

- Aplicación: <http://localhost:3000>
- API: <http://localhost:3000/api>
- Health check: <http://localhost:3000/api/health>

Para desarrollo con recarga automática: `npm run dev`.

## Configuración relevante

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de la API. Tiene prioridad sobre `DB_*`. |
| `MIGRATION_DATABASE_URL` | Conexión propietaria para migraciones y scripts. Tiene prioridad sobre `MIGRATION_DB_*`. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y vigencia de sesiones. |
| `FRONTEND_INVITATION_URL` | URL del frontend para invitaciones; admite rutas con `#/`. |
| `FRONTEND_PASSWORD_RESET_URL` | URL del frontend para recuperación de contraseña. |
| `EMAIL_PROVIDER` | `disabled` en local; `cloudflare` para correo real. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Evaluación con IA. Sin clave real, el envío a IA no funciona. |
| `ALLOW_DEV_INVITATION_TOKEN_RESPONSE` | Solo desarrollo: devuelve el enlace de invitación en la API. |
| `ALLOW_DEV_PASSWORD_RESET_TOKEN_RESPONSE` | Solo desarrollo y con `EMAIL_PROVIDER=disabled`: devuelve `dev_reset_url`. Nunca debe activarse en un entorno compartido. |

Referencia completa: [`.env.example`](.env.example).

## Scripts

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor. |
| `npm run dev` | Inicia con recarga automática. |
| `npm run test:db` | Prueba la conexión de runtime. |
| `npm run db:create` | Crea la base si no existe (no destructivo). |
| `npm run db:schema` | Aplica `database/schema.sql` sobre una base vacía. |
| `npm run db:migrate` | Aplica migraciones pendientes. |
| `npm run db:seed` | Carga datos demo (solo desarrollo). |
| `npm run db:sync-base-content` | Completa los ejercicios base faltantes en cursos existentes. |
| `npm run db:audit` | Audita integridad de datos. |
| `npm run db:provision-app-role` | Crea o rota `codeint_app`. |
| `npm run db:bootstrap-superadmin:prompt` | Crea o rota el superadministrador. |
| `npm run security:production-check` | Comprueba requisitos de producción. |
| `npm test` | Pruebas unitarias. |
| `$env:RUN_DB_TESTS='1'; npm test` | Pruebas de integración con PostgreSQL. |

> Las pruebas de integración usan la base configurada y crean registros temporales. Usa una base de pruebas, no la de demostración.

## Documentación

- [`DATABASE_AND_IDENTITY_RUNBOOK.md`](DATABASE_AND_IDENTITY_RUNBOOK.md): identidad, invitaciones y roles PostgreSQL.
- [`PHASE3_EVALUATION_RUNBOOK.md`](PHASE3_EVALUATION_RUNBOOK.md): evaluación PSeInt e IA.
- [`PHASE4_KAHOOT_RUNBOOK.md`](PHASE4_KAHOOT_RUNBOOK.md): eventos REST y Socket.IO de las salas.
- [`BACKEND_SECURITY_AUDIT.md`](BACKEND_SECURITY_AUDIT.md): auditoría de seguridad.
- [`PRODUCT.md`](PRODUCT.md) y [`DESIGN.md`](DESIGN.md): producto y sistema de diseño.

## Problemas frecuentes

- **`ECONNREFUSED 127.0.0.1:5432`**: el servicio PostgreSQL no está iniciado.
- **`password authentication failed`**: revisa `DATABASE_URL` y `MIGRATION_DATABASE_URL`; son las cadenas que realmente usa cada proceso.
- **`La base no tiene el esquema base`**: ejecuta `npm run db:schema` antes de `db:migrate`.
- **El enlace de invitación abre una vista sin token**: las URLs deben usar `#/registro` y `#/restablecer-password`, no `/registro`.
- **`EADDRINUSE` en el puerto 3000**: cierra el proceso anterior o cambia `PORT`.
