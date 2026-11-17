# Operación de base de datos e identidad

Estado validado: 2026-10-27.

## Reglas vigentes

- Solo puede existir un `superadministrador` y su correo exacto es `admin@codeintcorp.com`.
- El superadministrador no puede eliminarse, desactivarse, cambiar de correo, recibir una institución ni ser creado mediante el registro público.
- Solo el superadministrador crea, revoca y consulta invitaciones.
- Una invitación fija el correo, la institución y el rol (`docente` o `estudiante`). El formulario público no puede decidir esos campos.
- Los docentes y estudiantes deben pertenecer a un dominio activo de su institución. PostgreSQL también hace cumplir esta regla aunque se intente insertar directamente.
- El dominio inicial es `utp.edu.pe`.
- El género permitido actualmente es únicamente `femenino` o `masculino`.
- Los tokens de invitación y recuperación se guardan como SHA-256, son de un solo uso y vencen.
- Los JWT duran 30 minutos y contienen `token_version`; cambiar la contraseña, cerrar todas las sesiones o desactivar una cuenta revoca sesiones anteriores.
- La API usa `codeint_app`, sin `SUPERUSER`, `CREATEDB`, `CREATEROLE` ni permiso para crear tablas. La cuenta propietaria queda reservada para migraciones.

## Instalación nueva

La guía paso a paso con verificación de arranque está en [README.md](README.md).

1. Crear la base y aplicar el esquema base:
   ```powershell
   npm run db:create
   npm run db:schema
   ```
   `db:create` no es destructivo. `db:schema` aplica [database/schema.sql](database/schema.sql) sobre una base vacía. El volcado incluye 25 tablas de dominio, `schema_migration`, el registro de las 9 migraciones que ya incorpora, funciones, índices y triggers.
2. Solo en desarrollo, ejecutar `npm run db:seed`.
3. Crear o rotar el superadministrador con una contraseña ingresada de forma oculta:

   ```powershell
   npm run db:bootstrap-superadmin:prompt
   ```

4. Separar la cuenta de runtime de la cuenta propietaria:

   ```powershell
   npm run db:provision-app-role
   ```

5. Confirmar migraciones e integridad:

   ```powershell
   npm run db:migrate
   npm run db:audit
   ```

`database/seeds.sql` está marcado como desarrollo, no crea al superadministrador y no puede ejecutarse cuando `NODE_ENV=production` mediante `npm run db:seed`.

## Flujo de invitaciones

1. El superadministrador inicia sesión.
2. Crea una invitación con `POST /api/auth/admin/invitations` indicando `id_institucion`, `email`, `rol` y opcionalmente `expira_en_horas` (1–168).
3. El destinatario consulta el enlace con `POST /api/auth/invitation/inspect`.
4. Completa `POST /api/auth/register` enviando solo `invitation_token`, `nombre`, `apellido`, `password` y `genero`.
5. El backend toma correo, rol e institución desde la invitación bloqueada dentro de una transacción.

En desarrollo, si `EMAIL_PROVIDER=disabled` y `ALLOW_DEV_INVITATION_TOKEN_RESPONSE=true`, la respuesta administrativa incluye `dev_invitation_url` para pruebas manuales. En producción esta opción debe estar deshabilitada; si el correo no puede entregarse, la invitación se revoca.

Las URLs de correo deben apuntar al frontend con router por hash, por ejemplo `http://localhost:3000/#/registro`. El servicio agrega el token como `?token=...` dentro de la ruta, de modo que el router lo lea correctamente.

## Correo transaccional

La implementación admite Cloudflare Email Service mediante:

- `EMAIL_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_EMAIL_API_TOKEN`
- `EMAIL_FROM_ADDRESS`
- `EMAIL_FROM_NAME`
- `FRONTEND_INVITATION_URL`
- `FRONTEND_PASSWORD_RESET_URL`

Las credenciales reales deben configurarse en el entorno o gestor de secretos, nunca en el repositorio.

Sin correo configurado (`EMAIL_PROVIDER=disabled`) y con `ALLOW_DEV_PASSWORD_RESET_TOKEN_RESPONSE=true`, la solicitud de recuperación devuelve `dev_reset_url` para probar el flujo localmente. Esta opción debe permanecer deshabilitada en cualquier entorno compartido y el chequeo de producción la rechaza.

## Verificación antes de producción

Ejecutar:

```powershell
npm run security:production-check
```

El control falla de forma intencional si el entorno sigue en desarrollo, hay cuentas demo, falta el proveedor de correo, CORS contiene localhost, están habilitados tokens de prueba o la conexión PostgreSQL conserva privilegios administrativos.

También deben resolverse fuera del código: TLS y proxy del despliegue, copia/restauración probada, monitoreo, rotación de secretos y MFA del superadministrador mediante el proveedor de identidad elegido.

## Pruebas realizadas

- 17 pruebas de Node pasaron, incluida integración real login/perfil con PostgreSQL.
- Flujo real completo validado: login administrativo, creación e inspección de invitación, registro, perfil y revocación del JWT.
- 18 verificaciones de integridad de base de datos quedaron en cero hallazgos.
- Se verificó que `codeint_app` recibe error `42501` al intentar crear una tabla o modificar `schema_migration`.
- Se recreó una base temporal desde `schema.sql` y `seeds.sql`: 26 tablas totales (25 de dominio más metadatos), 9 migraciones registradas, 2 usuarios demo y 1 dominio activo.
