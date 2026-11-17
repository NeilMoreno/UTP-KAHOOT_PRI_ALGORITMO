# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El usuario principal de esta etapa es el estudiante de la UTP que practica algoritmos y pseudocodigo en PSeInt. El sistema tambien contempla docentes que gestionan cursos y salas, y superadministradores que gobiernan instituciones, identidades y cuotas de IA.

## Product Purpose

codeInt convierte el aprendizaje progresivo de algoritmos en una experiencia practica: el estudiante recorre mundos, resuelve ejercicios, valida PSeInt, recibe evaluacion asistida por IA y participa en partidas multijugador. El exito significa que puede reconocer su siguiente actividad, practicar sin perder su trabajo y ver un progreso academico comprensible.

## Positioning

El producto une una ruta curricular de PSeInt, evaluacion local previa a la IA, progresion por mundos y dinamicas tipo Kahoot dentro de una misma identidad y cuenta institucional.

## Operating Context

La aplicacion se usa en navegador, en sesiones de clase y estudio individual. Los estudiantes alternan entre el panel de progreso, el mapa del curso, listas de ejercicios y un editor de pseudocodigo; docentes y administradores usan flujos de gestion respaldados por la API.

## Capabilities and Constraints

- Frontend existente en HTML, CSS y JavaScript modular sin framework.
- Backend Express con PostgreSQL, JWT, Socket.IO y rutas REST bajo `/api`.
- Los datos academicos, la gamificacion, la identidad y las salas provienen del backend; la interfaz no debe sustituirlos con datos ficticios.
- La personalizacion de personaje se implementa inicialmente como preferencia visual local y reversible; su persistencia en servidor queda como decision futura.
- El rediseño se aplica primero a la experiencia completa del estudiante. Las vistas aun no implementadas para otros roles deben declarar honestamente su estado.

## Brand Commitments

- Nombre del producto: codeInt.
- Referencia visual aportada por el usuario: `C:\Users\HP\Downloads\codeInt-personajes.html`.
- La referencia establece un campus de programacion con identidad espacial, personajes, azul como color principal y morado como color secundario.
- La interfaz debe conservar una voz educativa directa, energica y en español.

## Evidence on Hand

- Implementacion real en `frontend/`, `backend/`, `database/` y `tests/`.
- Documentacion academica y tecnica en el repositorio.
- Prototipo funcional autocontenido aportado por el usuario; sus datos de demostracion no constituyen evidencia de funciones productivas.
- No hay ilustraciones raster ni fotografias oficiales. Los personajes del prototipo son vectores propios embebidos.

## Product Principles

1. El siguiente paso del estudiante siempre debe ser evidente.
2. La motivacion visual nunca debe ocultar el estado academico real.
3. El progreso, la cuota de IA y los bloqueos se explican con datos y acciones concretas.
4. El trabajo escrito por el estudiante se preserva ante interrupciones y errores.
5. Las funciones incompletas se presentan con honestidad, sin simular resultados.

## Accessibility & Inclusion

La experiencia debe funcionar con teclado, foco visible, nombres accesibles, contraste WCAG AA, objetivos tactiles de al menos 44 px y una composicion util en escritorio y movil. El movimiento debe respetar `prefers-reduced-motion`.
