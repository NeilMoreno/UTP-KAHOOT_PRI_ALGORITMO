---
name: codeInt
description: Campus nocturno de misiones para aprender algoritmos con datos académicos reales.
colors:
  ground: "#080A0F"
  surface: "#11141B"
  raised: "#1A1E27"
  active: "#222733"
  border: "#252A35"
  control: "#3A4353"
  text: "#F7F8FB"
  muted: "#B5BDCC"
  faint: "#929CAD"
  primary: "#FFFFFF"
  primary-ink: "#090B10"
  accent: "#5EA0FF"
  accent-strong: "#2F76E8"
  accent-soft: "#14223A"
  positive: "#42C992"
  positive-soft: "#122B23"
  negative: "#F06A78"
  negative-soft: "#321B22"
  warning: "#F3C969"
  warning-soft: "#302817"
  light-ground: "#F2F5F9"
  light-surface: "#FFFFFF"
  light-text: "#111827"
  light-accent: "#245FCE"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.35rem, 2.2vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.18
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 650
    lineHeight: 1.5
rounded:
  card: "16px"
  card-mobile: "14px"
  control: "9px"
  chip: "999px"
spacing:
  compact: "8px"
  gap: "16px"
  card: "20px"
  page: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "42px"
---

# Design System: codeInt

## Overview

**Creative North Star: "El Campus Nocturno de Misiones"**

codeInt combina la claridad de una herramienta educativa con la sensación espacial de un campus digital nocturno. La interfaz es compacta, directa y orientada a la siguiente acción: misión, mundo, ejercicio y editor. Los personajes vectoriales aportan identidad, pero nunca sustituyen ni ocultan el progreso académico real.

La profundidad nace de pasos discretos de luminosidad, no de decoraciones brillantes. El azul codeInt aparece en selección, avance y estados informativos; el resto de la interfaz conserva un campo negro frío y superficies sobrias. El modo claro mantiene los mismos roles semánticos con contraste invertido.

**Key Characteristics:**

- Campus oscuro y plano con jerarquía tonal.
- Siguiente misión visible antes que cualquier dato secundario.
- Personajes vectoriales nítidos como firma visual.
- Datos, bloqueos y estados siempre vinculados al backend.
- Editor de código monoespaciado; interfaz general en sans serif.

## Colors

La paleta usa negros fríos, blancos suaves y un azul limpio reservado para información activa; verde, rojo y amarillo tienen significado funcional.

### Primary

- **Azul codeInt**: selección, progreso, enlaces y foco visible.
- **Blanco de acción**: controles primarios de alto contraste sobre el campus oscuro.

### Secondary

- **Verde de avance**: aprobación y éxito confirmado.
- **Rojo de corrección**: errores y estados que requieren recuperación.
- **Ámbar de experiencia**: XP, advertencias y progreso especial.

### Neutral

- **Noche fría**: fondo de aplicación y editor.
- **Superficie de aula**: tarjetas, paneles y listas.
- **Texto principal, secundario y tenue**: tres niveles constantes de lectura.

**The Data Color Rule.** El color se reserva para selección, progreso y estados; una superficie en reposo se diferencia por luminosidad, no por saturación.

## Typography

**Display Font:** system UI sans serif
**Body Font:** system UI sans serif
**Label/Mono Font:** UI monospace únicamente para código y referencias de línea

**Character:** Una sans serif compacta mantiene el ritmo de aplicación y permite que las ilustraciones sean la voz expresiva. El peso, la escala y el espacio construyen jerarquía sin titulares ornamentales.

### Hierarchy

- **Display** (700, escala fluida hasta 2.6rem, 1.18): misión principal del estudiante.
- **Headline** (700, escala fluida hasta 1.75rem, 1.18): título de cada vista.
- **Title** (700, 1.1rem, 1.18): paneles, tarjetas y grupos de datos.
- **Body** (400, 14px, 1.5): instrucciones y contenido académico.
- **Label** (650, 0.8rem): metadatos, estados y controles compactos.

**The Literal Code Rule.** La tipografía monoespaciada solo aparece en código PSeInt, sugerencias de código y números de línea.

## Layout

En escritorio, una barra lateral fija de 232px y una cabecera de 64px enmarcan un contenedor fluido de hasta 1360px. La separación base es de 16px; los paneles usan entre 20px y 34px según su importancia. El panel del estudiante combina misión y progreso en la parte superior, y cursos y logros debajo.

A 1100px, las composiciones dobles pasan a una columna. A 900px, la barra lateral se convierte en una hoja lateral controlada desde la cabecera. A 640px, el relleno de página baja a 16px, los personajes se presentan en una columna y la constelación usa dos nodos por fila. Todos los altos de pantalla usan unidades dinámicas.

## Elevation & Depth

El sistema es plano por defecto. La profundidad se comunica mediante `ground`, `surface`, `raised` y `active`; no hay sombras en tarjetas en reposo. Las sombras quedan limitadas a capas que realmente flotan: modal, notificación y navegación móvil. El foco del editor usa un anillo interior azul, no elevación.

**The Tonal Depth Rule.** Una superficie persistente cambia de luminosidad; una sombra implica una capa temporal por encima de la aplicación.

## Shapes

Las tarjetas usan esquinas suavemente redondeadas de 16px y bajan a 14px en móvil. Los controles usan 9px, los retratos internos 12px y las cápsulas quedan reservadas para etiquetas compactas y barras de progreso. Los avatares combinan geometría circular de fondo con personajes de silueta vectorial propia.

## Components

### Buttons

- **Shape:** rectángulo compacto de 9px y altura mínima de 40px.
- **Primary:** blanco sobre negro en tema oscuro; la acción se expresa por contraste, no por brillo.
- **Hover / Focus:** opacidad moderada al pasar el puntero y anillo azul de 3px para teclado.
- **Secondary / Ghost:** transparente, texto principal y borde de control.

### Chips

- **Style:** cápsula compacta sobre una superficie tonal semántica.
- **State:** azul para información, verde para éxito, rojo para error y ámbar para XP.

### Cards / Containers

- **Corner Style:** 16px en escritorio y 14px en móvil.
- **Background:** superficie plana; los paneles protagonistas pueden usar el escalón tonal inmediatamente superior.
- **Shadow Strategy:** ninguna en reposo.
- **Internal Padding:** 20px como base, con 34px en el bloque principal de misión.

### Inputs / Fields

- **Style:** fondo del campus, borde de control, altura mínima de 42px y radio de 9px.
- **Focus:** borde azul más el foco global visible.
- **Error / Disabled:** color semántico y opacidad reducida sin ocultar la etiqueta.

### Navigation

La navegación lateral muestra iconos SVG de un mismo trazo, texto directo y un estado activo por luminosidad. En móvil se convierte en una hoja lateral; la cabecera conserva contexto, XP, tema y salida.

### Character Roster

Cada personaje ocupa una tarjeta con retrato vectorial grande, nombre, rasgo, descripción y una única acción. La selección se confirma con un contorno del color propio del personaje y `aria-pressed`; es cosmética y se guarda localmente.

### World Constellation

La ruta del curso conserva siete estados reales y usa nodos escalonados conectados en escritorio. En pantallas estrechas se vuelve una cuadrícula legible sin cambiar orden, bloqueos ni progreso.

## Do's and Don'ts

### Do:

- **Do** mostrar la próxima acción y el estado académico real antes de contenido decorativo.
- **Do** usar pasos tonales para separar superficies persistentes.
- **Do** mantener iconos SVG consistentes, foco visible y objetivos táctiles útiles.
- **Do** conservar los avatares como acompañamiento de identidad, no como recompensa académica.

### Don't:

- **Don't** añadir gradientes, halos o sombras a tarjetas en reposo.
- **Don't** usar azul como relleno general; su rareza comunica selección y avance.
- **Don't** simular progreso, resultados de IA, cursos o bloqueos.
- **Don't** usar emoji o glifos Unicode como sistema de iconos.
- **Don't** aplicar monoespaciada fuera de código o medición técnica.
