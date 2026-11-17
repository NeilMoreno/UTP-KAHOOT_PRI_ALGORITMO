# Auditoría de backend y base de datos

Fecha de actualización: 2026-10-27.

## Resultado actual

La fase de identidad y privilegios fue implementada y probada. La base activa tiene 7 migraciones, un único superadministrador fijo, dominio institucional obligatorio, invitaciones de un solo uso, recuperación/cambio de contraseña, revocación de JWT, auditoría de seguridad y un rol PostgreSQL de runtime sin privilegios administrativos.

No se declara el sistema «invulnerable». El backend y la base están listos para continuar el desarrollo funcional; un despliegue público todavía exige configurar correo real, rotar la contraseña administrativa conocida del entorno demo, eliminar cuentas demo, gestionar secretos, habilitar controles de infraestructura y considerar MFA.

## Controles implementados

- Consultas parametrizadas y pruebas de payloads de inyección SQL.
- Restricciones PostgreSQL para nombre, apellido, correo, hash bcrypt, rol, estado y género (`femenino`/`masculino`).
- Superadministrador único e inmutable en `admin@codeintcorp.com`, sin institución y fuera del registro público.
- Invitaciones creadas únicamente por el superadministrador; correo, rol e institución se derivan en servidor.
- Dominios institucionales activos reforzados por trigger para cualquier docente o estudiante.
- Verificación de correo implícita al consumir la invitación entregada al buzón exacto.
- Tokens opacos almacenados como hash SHA-256, con vencimiento, revocación y uso único.
- Recuperación y cambio de contraseña con revocación de sesiones anteriores.
- JWT HS256 con secreto obligatorio, emisor, audiencia, 30 minutos y `token_version`.
- CORS por allowlist, Helmet, rate limiting y cuerpos limitados.
- Auditoría inmutable desde la cuenta de runtime para invitaciones, contraseñas, sesiones, dominios y cambios de estado.
- Integridad relacional de cursos, matrículas, envíos, evaluaciones IA, consumo IA y movimientos XP mediante triggers.
- Reserva/confirmación idempotente de cuota IA y unicidad de XP por origen.
- Rol `codeint_app` sin privilegios administrativos, sin creación de esquema y sin escritura al historial de migraciones.
- Esquema canónico reproducible y seeds bloqueados en producción.

## Evidencia automatizada

- 17 pruebas Node aprobadas.
- Flujo de identidad real de extremo a extremo aprobado.
- 18 consultas de auditoría con cero hallazgos.
- Restauración temporal de `schema.sql` + `seeds.sql` aprobada.
- DDL e intento de escritura de migraciones bloqueados con SQLSTATE `42501` para `codeint_app`.
- Los resultados históricos de sqlmap y Nuclei están en `security-reports/`.

## Comandos operativos

```powershell
+npm run db:migrate
+npm run db:audit
+npm run db:bootstrap-superadmin:prompt
+npm run db:provision-app-role
+npm run security:production-check
+```

La suite habitual es `npm test`. En el sandbox actual, que bloquea los procesos trabajadores de `node --test`, los archivos se ejecutaron individualmente con `node tests/<archivo>.test.js`.

## Pendientes funcionales de próximas fases

- Validación y ejecución segura de PSeInt.
- Integración Gemini consumiendo obligatoriamente las funciones de reserva/confirmación de cuota.
- Salas multijugador completas y autenticación/autorización de sockets.
- Frontend para invitaciones, recuperación de contraseña y panel administrativo.
- OpenAPI, carga/concurrencia, observabilidad y operación de backups.

La guía operativa vigente está en `DATABASE_AND_IDENTITY_RUNBOOK.md`.