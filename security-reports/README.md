# Pruebas locales de seguridad

Fecha: 2026-10-23 (America/Lima)

## Alcance y reglas

Las pruebas se ejecutaron exclusivamente contra `http://127.0.0.1:3000`, con autorización del propietario del proyecto. Se usaron perfiles de bajo impacto: un solo hilo para sqlmap, `level=1`, `risk=1`, técnica boolean-based, y una selección explícita de plantillas HTTP firmadas de Nuclei. Se excluyeron OAST/Interactsh, fuerza bruta, fuzzing, DoS, headless, JavaScript, ejecución de código y protocolos no HTTP.

No se debe reutilizar esta configuración contra sistemas de terceros sin autorización expresa.

## Instalación verificada

- sqlmap: `.security-tools/sqlmap`, versión `1.10.10.19#dev`, commit `c9745f883d2a5b70de8b786fcd3451e9b991da8a`.
- Nuclei (fuente): `.security-tools/nuclei`, commit `25c4b0d623c9675da153f26a274207f4c8f6d8a7`.
- Nuclei (binario oficial Windows x64): `.security-tools/nuclei-bin/nuclei.exe`, versión `3.11.1`.
- SHA-256 del ZIP de Nuclei validado: `bb6cb9ff8939b753f6fcab06fd30a15f5bc61d8382a597871334c007a85ff9d2`.
- Plantillas oficiales de Nuclei: versión `10.5.1`, 14 432 archivos descargados y verificados.

Las herramientas y salidas crudas se ignoran en Git mediante `.gitignore`; este informe sí queda disponible en el proyecto.

## Resultados

### Backend y PostgreSQL

- Suite completa con integración real habilitada: 12 pruebas aprobadas, 0 fallos, 0 omitidas.
- Auditoría de integridad de PostgreSQL: 5 controles aprobados (correos duplicados, coherencia de docentes, matrículas, ejercicios y progreso).
- Health check: HTTP 200, sin `X-Powered-By`, con CSP, HSTS, `nosniff`, controles de framing, COOP y CORP.

### sqlmap

- `GET /api/auth/instituciones?probe=1`: no se detectó inyección en `probe`.
- `POST /api/auth/login`, campo JSON `email`: no se detectó inyección con el perfil limitado.
- El login respondió 9 veces con HTTP 401 y 8 veces con HTTP 429, confirmando que autenticación y rate limiting permanecieron activos durante el escaneo.

Estos resultados reducen el riesgo observado, pero una prueba dinámica limitada no demuestra ausencia absoluta de SQLi en todos los estados y rutas. Se complementa con las pruebas unitarias de consultas parametrizadas y validación de entradas del repositorio.

### Nuclei

Primera pasada (11 plantillas seleccionadas, 120 solicitudes): dos avisos informativos por cabeceras ausentes:

- `Permissions-Policy`.
- `Cross-Origin-Embedder-Policy`.

Se corrigieron con una política de permisos restrictiva y COEP `credentialless`. Después de la corrección:

- `/api/health`: 2 plantillas, 25 solicitudes, 0 resultados.
- Raíz del servicio: 11 plantillas, 120 solicitudes, 0 resultados.
- No se detectó CORS permisivo, Swagger/OpenAPI expuesto, `.env`, `.git`, modo de desarrollo de Express, `robots.txt` o sitemap expuestos por las plantillas seleccionadas.

## Verificación manual

```powershell
C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe .security-tools\sqlmap\sqlmap.py --version
.security-tools\nuclei-bin\nuclei.exe -version
$env:RUN_DB_TESTS='1'; npm test
npm run db:audit
```

Los logs detallados se generan localmente en `security-reports/` y están ignorados por Git para evitar versionar artefactos de ejecución.