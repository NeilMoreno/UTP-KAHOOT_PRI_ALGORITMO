# Despliegue de pruebas (Render + Neon + Mailtrap)

Para demostraciones y pruebas con **datos ficticios**. No es un despliegue de producción real:
las salas en vivo viven en la memoria del servidor (una sola instancia) y los correos llegan a una
bandeja de pruebas, no a personas.

## Qué necesitas (todo con nivel gratuito, sin facturación obligatoria)
| Servicio | Para qué | Dato que vas a copiar |
|---|---|---|
| [Neon](https://neon.tech) | Base PostgreSQL | Cadena de conexión (`postgresql://…?sslmode=require`) |
| [Mailtrap](https://mailtrap.io) | Bandeja de correos de prueba (Email Testing) | API token + ID de la bandeja (*Inbox ID*) |
| [Google AI Studio](https://aistudio.google.com/apikey) | IA (sílabo y corrección) | API key de Gemini |
| [Render](https://render.com) | Servidor Node con WebSockets | — |

## Pasos
1. **Neon**: crea un proyecto y copia la cadena de conexión. Con una sola cuenta de base de datos sirve
   para la app y para migrar (`DATABASE_URL`).
2. **Mailtrap**: *Email Testing → Inboxes → tu bandeja → API*: copia el token y el *Inbox ID*.
3. **Render**: *New → Blueprint* y elige este repositorio (usa `render.yaml`). Completa las variables
   marcadas como `sync: false`:
   - `DATABASE_URL`: la cadena de Neon.
   - `CORS_ORIGINS`: `https://<tu-servicio>.onrender.com`
   - `FRONTEND_INVITATION_URL`: `https://<tu-servicio>.onrender.com/#/registro`
   - `FRONTEND_PASSWORD_RESET_URL`: `https://<tu-servicio>.onrender.com/#/restablecer-password`
   - `MAILTRAP_API_TOKEN` y `MAILTRAP_INBOX_ID`
   - `GEMINI_API_KEY`
   - `DEMO_USER_PASSWORD`: una contraseña **propia** (10+ caracteres con mayúscula, minúscula y número).
     Reemplaza la contraseña pública `codeint123` de las cuentas demo.
4. El primer despliegue ejecuta `npm run deploy:setup`: crea el esquema, aplica las migraciones y carga los
   datos ficticios (solo si la base está vacía).
5. Comprueba `https://<tu-servicio>.onrender.com/api/health`.

## Después del primer despliegue
- Pon `DEPLOY_SEED_DEMO=false` si no quieres recargar datos nunca más (ya no lo hace con la base con usuarios).
- **Cuota de IA**: el superadmin (`admin@codeintcorp.com`) debe asignar una cuota de tokens al docente demo en
  *Cuotas de IA*; acótala para que una URL pública no agote tu clave de Gemini.
- Los correos (invitaciones, recuperación de contraseña) aparecen en la bandeja de Mailtrap.
- Cambia/rota las claves compartidas en chats o capturas antes de publicar la URL.

## Limitaciones conocidas
- Plan gratuito de Render: el servicio se duerme tras unos minutos sin tráfico (el primer acceso tarda).
  Una sala en vivo se pierde si el servicio se reinicia.
- Una sola instancia: no escales el servicio (las salas no se comparten entre instancias).
- Gemini gratuito se satura a veces (error 503): el sistema reintenta y, si persiste, pide intentar luego.
- La sesión usa una cookie `HttpOnly` de refresco (7 días) servida por HTTPS.
