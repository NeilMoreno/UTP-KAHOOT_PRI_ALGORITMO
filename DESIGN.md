---
name: codeInt
description: Arcade de programación: misiones, avatars pixel y salas en vivo para aprender a programar con datos académicos reales.
colors:
  ground: "#100B2B"
  surface: "#1B1442"
  raised: "#271D5C"
  active: "#33267A"
  border: "#3A2E86"
  control: "#5646B0"
  text: "#FFFFFF"
  muted: "#CFC8F5"
  faint: "#A89FDB"
  primary: "#FFC83D"
  primary-ink: "#1A1038"
  accent: "#A99BFF"
  accent-strong: "#7B5CFF"
  accent-soft: "#2A2070"
  positive: "#3EDC9A"
  negative: "#FF6B81"
  warning: "#FFC83D"
  ai: "#6FD3FF"
  light-ground: "#F5F2FF"
  light-surface: "#FFFFFF"
  light-text: "#1A1038"
  light-primary: "#5B3FE0"
  answer-a: "#E0334F"
  answer-b: "#2F7BF0"
  answer-c: "#F2B01E"
  answer-d: "#1F9D55"
typography:
  display:
    fontFamily: "Baloo 2, Nunito, system-ui, sans-serif"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "ui-monospace, Cascadia Code, Consolas, monospace"
rounded:
  card: "20px"
  control: "12px"
  chip: "999px"
  avatar: "radio proporcional al tamaño (cuadrado pixelado)"
spacing:
  gap: "16px"
  card: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.control}"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

# Design System: codeInt

## Visión

**Idea guía: "El arcade de programación".** codeInt se siente como un videojuego pensado para clase: color vivo, tipografía con carácter, avatars de pixel art y botones que se hunden al pulsarlos. La diversión nunca oculta el estado académico real: el siguiente paso del estudiante, su racha, su nivel y sus bloqueos salen del backend, no de datos de relleno.

Hay dos tonos dentro del mismo sistema:
- **Zona de juego** (alumno, salas en vivo, landing): vibrante, animada y con relieve.
- **Zona de gestión** (docente y administración): mismos tokens, más contenida; tablas y formularios claros.

## Color

Fondo violeta noche con **amarillo** como color de acción y **violeta claro** para selección y avance. El tema claro usa el mismo violeta como acción. Verde, rojo y ámbar conservan significado funcional (éxito, error, XP/aviso); cian identifica a la IA.

- **Regla del color de respuesta:** las salas usan cuatro colores fijos (rojo, azul, ámbar, verde) **y** cuatro formas (triángulo, rombo, círculo, cuadrado): nunca solo color.
- El texto sobre el ámbar es oscuro para mantener contraste AA.
- Todo color sale de los tokens de `:root` y se redefine en `:root[data-theme="light"]`.

## Tipografía

- **Display: Baloo 2** (títulos, botones, PIN, cuenta atrás), autoalojada en `frontend/fonts/`.
- **Cuerpo: Nunito**, autoalojada. Ambas con `font-display: swap`; la CSP solo permite recursos propios.
- **Monoespaciada** solo para código, números de línea y terminales decorativas.
- Regenerar las fuentes: `npm run build:assets` (los `.woff2` ya están versionados).

## Forma y profundidad

Tarjetas de 20px, controles de 12px, cápsulas para chips. La profundidad es de **tipo sticker**: sombra inferior dura (`--lift`) en botones y tarjetas clave, que desaparece al pulsar (`translateY`). Las superficies en reposo se separan por luminosidad y borde de 2px; los escenarios de sala suman una rejilla sutil.

## Avatars pixel

Lienzo de 16×16 dibujado con matrices de caracteres (`frontend/js/avatar-parts.js`) y renderizado a SVG con `shape-rendering="crispEdges"`. Siete clases (Hacker, Vibecoder, DevOps, Backend, Frontend, Data Scientist, Pentester) más capas editables: piel, peinado, pelo, ropa, color de ropa, gafas, accesorio y fondo. Las piezas se desbloquean por **nivel** o por **misiones**; el servidor valida cada pieza contra un catálogo cerrado (`backend/utils/avatarCatalog.js`). Ningún texto del usuario llega al SVG.

## Componentes clave

- **Botón:** primario amarillo con sombra inferior; secundario/ghost sin sombra. Foco visible de 3px.
- **Avatar:** cuadrado con borde proporcional; anillo verde en lobbies, gris si está desconectado.
- **Landing y cuentas:** pantalla dividida con avatars en movimiento y una terminal que "escribe" código; se desactiva con `prefers-reduced-motion`.
- **Dashboard del alumno:** misión actual, progreso, racha de 7 días, misiones de la semana, cursos y logros.
- **Sala en vivo:** PIN gigante, respuestas tipo sticker con forma + color, temporizador con degradado, resultado con avatar que celebra o se sacude.
- **Editor de avatar:** vista previa grande, pestañas por capa, candados con "Nivel N" y reinicio por clase.

## Movimiento

Animaciones cortas (pop, bob de 4 pasos, parpadeo de estrellas) que **siempre** tienen versión sin movimiento bajo `prefers-reduced-motion`.

## Accesibilidad

Contraste AA en oscuro y claro, foco visible, objetivos táctiles ≥44px, `aria-live` para avisos, controles con nombre accesible y avatars decorativos con `aria-hidden`. Pendiente: restaurar el foco visible del editor de código y auditar el teclado en podio y mapa.

## Qué hacer y qué evitar

**Hacer:** mostrar la próxima acción y el estado real primero; usar forma además de color; mantener los datos vinculados al backend; usar los tokens de `:root`.
**Evitar:** simular progreso, resultados de IA o bloqueos; usar emoji como sistema de iconos; colores sueltos fuera de los tokens; animaciones sin versión reducida.
