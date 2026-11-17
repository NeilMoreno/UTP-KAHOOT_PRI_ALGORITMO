# 🚀 Plan Maestro de Desarrollo e Implementación: codeInt

> **Plataforma Web Gamificada e Inteligente para el Aprendizaje de Algoritmos en PSeInt con Salas Multijugador Síncronas (tipo Kahoot) y Evaluación por IA**
> **Versión del Plan:** 2.0 (Post-Auditoría del Avance II)  
> **Sistema Gestor de Base de Datos (SGBD):** PostgreSQL  
> **Stack Objetivo:** Node.js (Express + Socket.io) + PostgreSQL + HTML5/CSS3/JavaScript (Modular / Modern UI) + Google Gemini API  

---

## 📌 1. Información General y Contexto del Proyecto

* **Nombre del Sistema:** `codeInt` (también referenciado en documentos preliminares como *PSeInt-Play*).
* **Institución Educativa:** Universidad Tecnológica del Perú (UTP).
* **Facultad y Carrera:** Facultad de Ingeniería de Sistemas e Informática.
* **Curso:** Herramientas de Desarrollo (Sección 27450).
* **Año Académico:** 2026.
* **Problema Central:** Elevadas tasas de deserción y desaprobación en los primeros cursos de algoritmos debido a la naturaleza abstracta del pseudocódigo, la retroalimentación tardía manual y la falta de dinámicas interactivas para evaluar lógica en tiempo real.
* **Solución codeInt:** Plataforma EdTech SaaS multi-institucional que combina progresión de aprendizaje por 7 mundos temáticos, editor de pseudocódigo con validación sintáctica y evaluación pedagógica mediante Google Gemini IA, salas multijugador síncronas estilo Kahoot con ranking en vivo, y un motor de gamificación integral (XP, niveles, logros e insignias).

---

## 🎨 2. Identidad Visual y Sistema de Diseño (Design System)

Toda IA o desarrollador que implemente interfaces de `codeInt` debe seguir obligatoriamente la paleta y directrices visuales aprobadas en la documentación:

| Color | Hex | Significado y Rol en la UI | Usos Principales |
|---|---|---|---|
| **Azul Tecnológico** | `#2563EB` | Confianza, tecnología, estabilidad | Color primario, barras de navegación, botones de acción principal, encabezados. |
| **Morado Innovación** | `#7C3AED` | Inteligencia Artificial, creatividad, modernidad | Indicadores de evaluación por IA (Gemini), botones de análisis de sílabos, chips de IA. |
| **Verde Progreso** | `#10B981` | Aprendizaje, avance, éxito | Insignias desbloqueadas, mundos completados, respuestas correctas, mensajes de éxito. |
| **Amarillo Energía** | `#FBBF24` | Gamificación, energía, diversión | Puntos de experiencia (XP), copas/trofeos, podio de Kahoot, barra de nivel, rankings. |
| **Rojo Alerta** | `#EF4444` | Corrección, advertencia, fallos | Mensajes de error sintáctico, opciones incorrectas, alertas de cuota de tokens. |
| **Fondo Principal** | `#F8FAFC` | Claridad y legibilidad (Light) / `#0F172A` (Dark) | Fondo base de las vistas y paneles principales. |
| **Fondo Secundario** | `#E2E8F0` | Estructuración y contraste / `#1E293B` (Dark) | Tarjetas (Cards), contenedores de ejercicios, paneles laterales. |
| **Texto Principal** | `#1E293B` | Alto contraste / `#F8FAFC` (Dark) | Tipografía principal, títulos y datos numéricos. |
| **Texto Secundario** | `#64748B` | Información complementaria / `#94A3B8` (Dark) | Metadatos, fechas, leyendas secundarias. |

---

## 🗄️ 3. Especificación de Base de Datos (PostgreSQL — 21 Tablas Normalizadas en 3FN)

El sistema cuenta con un esquema de base de datos normalizado en **Tercera Forma Normal (3FN)** con claves primarias tipo **UUID** (`gen_random_uuid()`), extensiones `pgcrypto` y `btree_gist`, y restricciones estrictas `CHECK` y `UNIQUE`:

```
               [ INSTITUCION ]
                      |
         +------------+------------+
         |                         |
    [ USUARIO ]                [ CURSO ]
         |                         |
         +------+                  +------+------+
         |      |                  |      |      |
  [ ASIGNACION_TOKENS ]     [ MATRICULA ] |   [ SILABO ]
         |                         |      |      |
     [ USO_IA ]                    |   [ MUNDO ]-+
         |                         |      |
  [ EVALUACION_IA ]                |  [ EJERCICIO ]
         |                         |      |
  [ ENVIO_EJERCICIO ] <------------+------+
         |                         |
  [ XP_MOVIMIENTO ]         [ PROGRESO_MUNDO ]
         |
  [ NIVEL ]  [ LOGRO ] --- [ ESTUDIANTE_LOGRO ]

  [ SALA_MULTIJUGADOR ] --- [ PREGUNTA ] --- [ OPCION ]
         |                         |           |
  [ PARTICIPANTE_SALA ] -----------+-----------+
         |
  [ RESPUESTA_SALA ]
```

### Detalle de las 21 Entidades Relacionales

1. **`institucion`**: Organización educativa cliente (SaaS). Campos: `id_institucion` (UUID PK), `nombre`, `codigo_licencia`, `estado` (`activa`, `inactiva`), `fecha_creacion`.
2. **`usuario`**: Cuentas con roles (`estudiante`, `docente`, `superadministrador`). Campos: `id_usuario` (UUID PK), `id_institucion` (FK, NULL para superadmin), `nombre`, `apellido`, `email` (UNIQUE lower), `password_hash`, `rol`, `estado` (`pendiente`, `activo`, `inactivo`), `correo_verificado`, `fecha_creacion`.
3. **`asignacion_tokens`**: Cuota de tokens de IA para docentes por periodos de vigencia sin solapamientos (`EXCLUDE USING gist`). Campos: `id_asignacion_tokens` (UUID PK), `id_docente_beneficiario` (FK), `id_superadmin_asignador` (FK), `limite_tokens`, `fecha_inicio`, `fecha_fin`.
4. **`curso`**: Curso impartido por un docente en una institución. Campos: `id_curso` (UUID PK), `id_institucion` (FK), `id_docente` (FK), `nombre`, `codigo_curso`, `periodo`, `estado` (`activo`, `inactivo`), `fecha_creacion`. UNIQUE (`id_institucion`, `codigo_curso`, `periodo`).
5. **`matricula`**: Inscripción de estudiantes en cursos. Campos: `id_matricula` (UUID PK), `id_curso` (FK), `id_estudiante` (FK), `fecha_matricula`, `estado` (`activa`, `retirada`). UNIQUE (`id_curso`, `id_estudiante`).
6. **`silabo`**: Documentos curriculares PDF procesados. Campos: `id_silabo` (UUID PK), `id_curso` (FK), `nombre_archivo`, `ruta_archivo`, `fecha_carga`, `estado_procesamiento` (`cargado`, `procesando`, `procesado`, `error`).
7. **`mundo`**: Unidades temáticas (7 oficiales o generadas). Campos: `id_mundo` (UUID PK), `id_curso` (FK), `id_silabo` (FK opcional), `orden`, `nombre`, `descripcion`, `tipo_origen` (`base`, `personalizado`). UNIQUE (`id_curso`, `orden`).
8. **`ejercicio`**: Retos de lógica en PSeInt. Campos: `id_ejercicio` (UUID PK), `id_mundo` (FK), `id_curso` (FK), `titulo`, `enunciado`, `plantilla_pseint`, `orden`, `xp_recompensa`. UNIQUE (`id_mundo`, `orden`).
9. **`progreso_mundo`**: Avance y desbloqueo secuencial de cada alumno. Campos: `id_progreso_mundo` (UUID PK), `id_matricula` (FK), `id_mundo` (FK), `id_curso` (FK), `estado` (`bloqueado`, `en_progreso`, `completado`), `fecha_inicio`, `fecha_completado`.
10. **`envio_ejercicio`**: Entregas de pseudocódigo. Campos: `id_envio_ejercicio` (UUID PK), `id_matricula` (FK), `id_estudiante` (FK), `id_ejercicio` (FK), `id_curso` (FK), `codigo_pseint`, `sintaxis_valida`, `mensaje_sintaxis`, `fecha_envio`.
11. **`evaluacion_ia`**: Calificación cualitativa y cuantitativa de Gemini IA. Campos: `id_evaluacion` (UUID PK), `id_envio_ejercicio` (FK UNIQUE), `id_estudiante` (FK), `id_curso` (FK), `puntaje` (0–100), `retroalimentacion`, `categoria_error`, `fecha_evaluacion`.
12. **`uso_ia`**: Auditoría e imputación de consumo de tokens. Campos: `id_uso_ia` (UUID PK), `id_operacion` (UUID UNIQUE idempotencia), `id_docente` (FK), `id_institucion` (FK), `id_envio_ejercicio` (FK opcional), `id_silabo` (FK opcional), `tipo_operacion` (`evaluacion`, `generacion_mundo`), `tokens_reservados`, `tokens_consumidos`, `estado_consumo`, `resultado_operacion`, `fecha_uso`, snapshots históricos.
13. **`xp_movimiento`**: Movimiento transaccional de experiencia. Campos: `id_xp_movimiento` (UUID PK), `id_estudiante` (FK), `id_curso` (FK), `id_evaluacion` (FK opcional), `id_participante_sala` (FK opcional), `cantidad` (> 0), `origen` (`evaluacion_ia`, `participante_sala`), `fecha`.
14. **`nivel`**: Catálogo de niveles. Campos: `id_nivel` (UUID PK), `numero` (UNIQUE > 0), `nombre` (UNIQUE), `xp_requerido` (UNIQUE >= 0).
15. **`logro`**: Catálogo de medallas e insignias. Campos: `id_logro` (UUID PK), `nombre`, `descripcion`, `tipo` (`logro`, `insignia`), `tipo_condicion` (`xp_acumulado`, `mundos_completados`, `partidas_participadas`, `ejercicios_aprobados`), `valor_umbral`.
16. **`estudiante_logro`**: Desbloqueo de logros por estudiante. Campos: `id_estudiante_logro` (UUID PK), `id_estudiante` (FK), `id_logro` (FK), `fecha_obtencion`. UNIQUE (`id_estudiante`, `id_logro`).
17. **`sala_multijugador`**: Partida Kahoot en vivo. Campos: `id_sala` (UUID PK), `id_curso` (FK), `pin_sala` (CHAR(6)), `estado` (`espera`, `en_curso`, `finalizada`, `cancelada`), `id_pregunta_activa` (FK opcional), `fecha_apertura_pregunta`, `fecha_creacion`, `fecha_inicio`, `fecha_fin`.
18. **`participante_sala`**: Alumnos conectados a la sala. Campos: `id_participante` (UUID PK), `id_sala` (FK), `id_matricula` (FK), `id_estudiante` (FK), `id_curso` (FK), `fecha_ingreso`, `puntaje_final`, `posicion_final`.
19. **`pregunta`**: Preguntas de opción múltiple proyectadas en la partida. Campos: `id_pregunta` (UUID PK), `id_sala` (FK), `orden`, `enunciado`, `tiempo_limite_seg`, `puntos_base`. UNIQUE (`id_sala`, `orden`).
20. **`opcion`**: Respuestas A, B, C, D de cada pregunta. Campos: `id_opcion` (UUID PK), `id_pregunta` (FK), `etiqueta` (VARCHAR(10)), `texto`, `es_correcta` (BOOLEAN). UNIQUE (`id_pregunta`, `etiqueta`).
21. **`respuesta_sala`**: Respuestas de participantes en tiempo real. Campos: `id_respuesta_sala` (UUID PK), `id_participante` (FK), `id_pregunta` (FK), `id_opcion` (FK), `id_sala` (FK), `tiempo_respuesta`, `puntaje_obtenido`.

---

## 🗺️ 4. Los 7 Mundos de Aprendizaje de PSeInt

Cada curso inicializa la progresión secuencial con los 7 mundos base:

```
[Mundo 1: Fundamentos] ➡️ [Mundo 2: Condicionales] ➡️ [Mundo 3: Bucles] ➡️ [Mundo 4: Vectores]
                                                                                ⬇️
[Mundo 7: Algoritmos]  ⬅️ [Mundo 6: Subprocesos]  ⬅️ [Mundo 5: Matrices] ⬅️-----+
```

1. **Mundo 1: Fundamentos**
   * *Temas:* Estructura de algoritmo, variables, tipos de datos (Entero, Real, Caracter, Logico), operadores aritméticos y lógicos, comandos `Escribir` y `Leer`.
   * *Ejercicios tipo:* Cálculo de promedio, conversión de monedas, cálculo de área y perímetro.
2. **Mundo 2: Condicionales**
   * *Temas:* `Si - Entonces`, `Si - Entonces - Sino`, condicionales anidados, estructura de selección múltiple `Segun`.
   * *Ejercicios tipo:* Determinación de mayoría de edad, cálculo de descuentos escalonados, calculadora de menú con `Segun`.
3. **Mundo 3: Bucles (Estructuras Repetitivas)**
   * *Temas:* Ciclos `Mientras`, `Repetir - Hasta Que`, `Para` con paso, acumuladores y contadores.
   * *Ejercicios tipo:* Tabla de multiplicar, factorial de un número, validación de contraseñas con intentos limitados.
4. **Mundo 4: Vectores (Arreglos Unidimensionales)**
   * *Temas:* Declaración `Dimension`, llenado, recorrido secuencial, cálculo de mayor y menor, conteo de elementos.
   * *Ejercicios tipo:* Registro de calificaciones, búsqueda de un número en el vector, inversión de elementos.
5. **Mundo 5: Matrices (Arreglos Bidimensionales)**
   * *Temas:* Declaración multidimensional, recorridos con bucles anidados, suma de filas y columnas, diagonal principal.
   * *Ejercicios tipo:* Matriz identidad, suma de dos matrices, tablero de juego sencillo.
6. **Mundo 6: Subprocesos y Funciones**
   * *Temas:* Modularidad, definición de `SubProceso` y `Funcion`, retorno de valor, paso de parámetros por valor y referencia.
   * *Ejercicios tipo:* Función matemática personalizada, subproceso para ordenar o mostrar datos.
7. **Mundo 7: Algoritmos e Integración**
   * *Temas:* Métodos de ordenamiento (Burbuja, Inserción), búsqueda secuencial y binaria, resolución integral de casos reales.
   * *Ejercicios tipo:* Sistema de inventario básico, ranking de estudiantes ordenado por puntaje.

---

## 🎮 5. Especificación del Motor Kahoot Multijugador en Tiempo Real

### Flujo Operativo y Eventos WebSocket (Socket.io)

```
[Docente / Proyector]                               [Servidor Socket.io]                               [Estudiante / Móvil]
         |                                                   |                                                   |
         | --- 1. room:create { cursoId, preguntas } ------> |                                                   |
         | <--- 2. room:created { pin: "849201" } ---------- |                                                   |
         |                                                   | <--- 3. room:join { pin, estudianteId, nick } --- |
         | <--- 4. player:joined { nick, totalPlayers } ---- | --- 4b. room:joined_success --------------------> |
         |                                                   |                                                   |
         | --- 5. game:start ------------------------------> |                                                   |
         | <--- 6. question:countdown (3, 2, 1) ------------ | ---> 6. question:countdown ---------------------> |
         | <--- 7. question:show { enunciado, tiempo } ---- | ---> 7. question:show { opciones A,B,C,D } -----> |
         |                                                   | <--- 8. answer:submit { opcionId, tiempoMs } ---- |
         | <--- 9. answers:update_count -------------------- |                                                   |
         |                                                   |                                                   |
         | --- 10. question:timeout / all_answered --------> |                                                   |
         | <--- 11. question:results { stats, ranking } ---- | ---> 11. answer:result { correct, pts, pos } ----> |
         |                                                   |                                                   |
         | --- 12. game:finish ----------------------------> |                                                   |
         | <--- 13. game:podium { top3, allPlayers } ------- | ---> 13. game:podium { tuPuesto, xpGanado } ------>|
```

### Fórmula Oficial de Puntuación de Kahoot
Para cada participante $i$ que responda correctamente la pregunta dentro del tiempo límite:
$$\text{puntaje} = \text{round}\left( \text{puntos\_base} \times \left( 1 - \frac{\text{tiempo\_respuesta\_seg}}{2 \times \text{tiempo\_limite\_seg}} \right) \right)$$
* Si la respuesta es incorrecta o excede el tiempo límite: $\text{puntaje} = 0$.
* Los primeros lugares del podio al finalizar la partida reciben una bonificación en **XP** registrada en `xp_movimiento`.

---

## 🤖 6. Pipeline de Validación de Sintaxis y Evaluación con Gemini IA

```
                   [ Estudiante envía código PSeInt ]
                                   │
                                   ▼
             [ Filtro 1: Validador Sintáctico PSeInt ]
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
        [ Sintaxis Inválida ]                     [ Sintaxis Válida ]
              │                                         │
              ▼                                         ▼
   * No consume tokens IA                  * Reserva cuota en `uso_ia`
   * Registra error local                  * Ejecuta Prompt Pedagógico en Gemini
   * Feedback sintáctico inmediato          * Calcula puntaje (0–100)
                                           * Extrae feedback y categoría de error
                                           * Imputa tokens reales consumidos
                                           * Otorga XP si puntaje >= umbral
                                           * Actualiza `progreso_mundo`
```

### Formato de Salida Esperado de Google Gemini (JSON Estricto)
```json
{
  "puntaje": 85,
  "categoria_error": "condicion_borde",
  "retroalimentacion": "Tu estructura condicional Si-Entonces está bien planteada, pero no contemplaste el caso cuando la variable edad es exactamente igual a 18.",
  "sugerencias": [
    "Revisa el operador de comparación: usa >= en lugar de >",
    "Prueba tu algoritmo con valores límites como 17, 18 y 19"
  ],
  "eficiencia_algoritmica": "Buena",
  "codigo_sugerido_mejora": "// Ejemplo de ajuste\nSi edad >= 18 Entonces\n    Escribir 'Mayor de edad';\nFinSi"
}
```

---

## 🗺️ 7. Hoja de Ruta de Implementación Paso a Paso (Fases de Desarrollo)

### Fase 1: Arquitectura de Persistencia y Base de Datos (PostgreSQL)
- [x] Crear script DDL `database/schema.sql` con 25 tablas de dominio más `schema_migration`, extensiones `pgcrypto` y `btree_gist`, claves primarias UUID, claves foráneas e índices.
- [x] Crear script de datos semilla `database/seeds.sql` con datos base:
  - 1 Institución demo (ej. *Universidad Tecnológica del Perú - UTP*).
  - 2 usuarios demo institucionales (`docente.demo@utp.edu.pe`, `estudiante.demo@utp.edu.pe`); el superadministrador se crea únicamente por bootstrap seguro.
  - 1 Curso demo (*Algoritmos y Estructuras de Datos I*).
  - Catálogo de los 7 Mundos oficiales con sus ejercicios de pseudocódigo iniciales.
  - Catálogo de Niveles (Novato, Aprendiz, Programador, Arquitecto, Maestro) y Logros.
- [x] Implementar un conector/adaptador de base de datos (`backend/config/database.js`) compatible con PostgreSQL, con modo de contingencia/memoria o SQLite local en caso de que el desarrollador no tenga un servicio de PostgreSQL activo temporalmente.

### Fase 2: Backend Core (API RESTful y Seguridad)
- [x] Inicializar proyecto Node.js (`package.json`) con dependencias: `express`, `socket.io`, `pg`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`, `multer`.
- [x] Módulo de Autenticación y RBAC (`/api/auth`): registro por invitación, login con JWT revocable, recuperación/cambio de contraseña y middleware de roles (`estudiante`, `docente`, `superadministrador`).
- [x] Módulo de Cursos y Matrículas (`/api/cursos`): CRUD de cursos por docente, consulta de inscripciones, endpoint para importación masiva vía CSV.
- [x] Módulo de Aprendizaje (`/api/mundos`, `/api/ejercicios`): Listado de mundos por curso con estado de desbloqueo, detalle de ejercicios y plantillas PSeInt.

### Fase 2.5: Gobierno de identidad y privilegios
- [x] Superadministrador único y fijo (`admin@codeintcorp.com`) creado/rotado por bootstrap fuera de los seeds.
- [x] Invitaciones de correo exacto con rol e institución definidos por el superadministrador.
- [x] Dominio institucional `utp.edu.pe` aplicado tanto en backend como en PostgreSQL.
- [x] Tokens de invitación/recuperación hasheados, JWT revocables y auditoría de seguridad.
- [x] Separación entre rol propietario de migraciones y `codeint_app` de privilegios mínimos.
- [x] Integridad atómica para reservas IA y movimientos XP antes de conectar Gemini.
### Fase 3: Motor de Evaluación PSeInt e IA Gemini
- [x] Servicio de validación sintáctica básica en backend (`backend/services/pseintValidator.js`) que identifique palabras clave no cerradas (`FinSi`, `FinPara`, `FinMientras`, `FinFuncion`), nombres de variables inválidos o errores léxicos.
- [x] Servicio de integración con Google Gemini (`backend/services/geminiService.js`):
  - Invocación con clave de API parametrizada (`GEMINI_API_KEY`).
  - Idempotencia y control de cuota de tokens por docente (`asignacion_tokens` y `uso_ia`).
  - Registro de evaluaciones en `evaluacion_ia` y asignación de XP en `xp_movimiento` (solo primer aprobado).
  - Endpoints RESTful para validación sintáctica gratuita, envíos protegidos con cuotas y consulta de consumo (`GET /api/ia/consumo`).
- [x] Desbloqueo transaccional de logros e insignias (`backend/services/achievementService.js`) y resumen de nivel en la respuesta de evaluación.
- [x] Recuperación de envíos abandonados en `pendiente`/`procesando` con liberación de la reserva de tokens.


### Fase 4: Servidor Multijugador Síncrono (WebSockets / Kahoot)
- [x] Configurar servidor Socket.io en `backend/sockets/kahootHandler.js`, conectado en `server.js` con la misma autenticación JWT del API REST (guía de eventos en `PHASE4_KAHOOT_RUNBOOK.md`).
- [x] Lógica de gestión de salas:
  - Generador de PIN único de 6 dígitos (reintento ante colisión sobre `uq_sala_pin_activa`).
  - Manejador de estados: `espera` ➡️ `countdown` ➡️ `pregunta` ➡️ `estadisticas_pregunta` ➡️ `finalizada` (o `cancelada`).
  - Conexión y reconexión de estudiantes con sus respectivos apodos (los avatares quedan para la Fase 5) y recuperación del anfitrión (`room:host`).
  - Cronómetro de servidor sincronizado para evitar trampas de tiempo.
  - Registro de respuestas en base de datos (`respuesta_sala`, `participante_sala`) y cierre transaccional con asignación de XP al podio y desbloqueo de logros.
  - API REST `/api/salas` con control de acceso por curso.

### Fase 5: Frontend Web App (Experiencia de Usuario codeInt)
- [x] **Estructura y Estilos Globales:** Crear `frontend/css/styles.css` aplicando el Design System con las variables de color oficiales, tipografía moderna (Inter / Outfit) y diseño completamente responsive (Mobile First).
- [ ] **Vistas del Estudiante** (SPA en `frontend/`, se sirve con `npm start` en http://localhost:3000; sin build, ES modules, compatible con la CSP estricta):
  - [x] *Dashboard del Alumno:* Tarjeta de nivel actual, barra de progreso a siguiente nivel, contador de XP, selector de cursos.
  - [x] *Mapa de Mundos:* Interfaz visual interactiva con los 7 mundos temáticos, caminos iluminados, iconos distintivos y candados de estado.
  - [x] *Workspace de Ejercicios PSeInt:* Editor de código con resaltado, botón de validación sintáctica, botón de envío a IA, modal con retroalimentación animada de Gemini.
  - [x] *Lobby y Partida Kahoot (Móvil):* Pantalla de ingreso de PIN, botones gigantes táctiles (Triángulo rojo, Rombo azul, Círculo amarillo, Cuadrado verde) y pantalla de resultados con animación de puntos.
- [ ] **Vistas del Docente:**
  - [x] *Panel de Control:* Resumen de cursos activos, estudiantes matriculados y promedio de avance.
  - [x] *Gestor de Cursos y Matrículas:* Creación de cursos, listado de estudiantes y botón para cargar CSV masivo.
  - [x] *Host de Salas Kahoot (Pantalla Gigante):* Proyección del PIN gigante, lista de alumnos uniéndose en tiempo real, proyección de la pregunta con contador regresivo animado, gráficos de barras con las respuestas elegidas y podio olímpico con confeti.
  - [ ] *Carga de Sílabos:* Formulario de subida de PDF con procesamiento simulado o real de IA para generar nuevos mundos.
  - [x] *Analíticas Académicas:* Gráficos de distribución de errores frecuentes y rendimiento grupal.
- [x] **Vistas del Superadministrador:**
  - [x] Gestión de instituciones educativas y códigos de licencia.
  - [x] Aprobación y activación de docentes registrados.
  - [x] Monitoreo del consumo de tokens y asignación de cuotas.

### Fase 6: Pruebas, Refactorización y Empaquetado
- [ ] Pruebas de integración de la base de datos con scripts SQL.
- [ ] Pruebas de concurrencia en la sala de Socket.io con múltiples participantes (hoy hay una partida de extremo a extremo y la carrera de doble respuesta de un mismo jugador).
- [ ] Documentación OpenAPI / Swagger y guía de ejecución local con un solo comando.

---

## 🛠️ 8. Instrucciones Técnicas para Otras IAs y Desarrolladores

Cualquier agente de IA o desarrollador que continúe el trabajo en este repositorio debe respetar estrictamente:
1. **Regla de Claves Primarias:** Nunca usar IDs autoincrementales enteros para las entidades principales; usar siempre **UUID** (`gen_random_uuid()`).
2. **Aislamiento Multi-institucional:** Toda consulta de cursos, estudiantes, matrículas y salas debe filtrar y validar la pertenencia a la institución educativa (`id_institucion`), salvo cuando el usuario actúe como `superadministrador`.
3. **No Guardar Datos Derivados:** Como estipula la normalización de codeInt, **no se almacenan en tablas fijas**:
   - El ranking de la sala o el ranking global (se calcula mediante `ORDER BY puntaje_obtenido DESC`).
   - El nivel actual (se calcula dinámicamente comparando la suma de XP en `xp_movimiento` con la tabla `nivel`).
   - El estado de bloqueo de un mundo posterior (se deriva validando si el mundo inmediatamente anterior tiene estado `completado` en `progreso_mundo`).
4. **Respeto a la Identidad Visual:** Utilizar rigurosamente las clases y variables CSS definidas en el sistema de diseño oficial (`#2563EB`, `#7C3AED`, `#10B981`, `#FBBF24`, `#EF4444`).
5. **Control de Consumo de IA:** Toda llamada a Gemini debe estar antecedida por una validación sintáctica local y debe registrar su consumo en `uso_ia` con una clave UUID de idempotencia (`id_operacion`).

---

*Documento generado y mantenido para la base de código de **codeInt** — Universidad Tecnológica del Perú (2026).*
