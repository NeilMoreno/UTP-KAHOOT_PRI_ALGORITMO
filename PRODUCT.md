# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Estudiantes de cursos de programación (hoy en una universidad; el diseño contempla también colegios), docentes que gestionan cursos, salas en vivo y analíticas, y superadministradores que gobiernan instituciones, invitaciones, cuotas de IA y estadísticas.

## Product Purpose

codeInt convierte el aprendizaje progresivo de la programación en una experiencia de juego con base académica real: el estudiante recorre mundos, resuelve ejercicios, recibe evaluación asistida por IA, mantiene una racha, completa misiones semanales, personaliza su avatar y compite en salas en vivo. El docente puede subir su **sílabo** y dejar que la IA proponga un curso a su medida que él revisa y publica. El éxito significa que el estudiante sabe qué hacer a continuación, practica sin perder su trabajo y ve un progreso comprensible.

## Positioning

Una misma cuenta institucional reúne una ruta curricular, evaluación local previa a la IA, gamificación (XP, niveles, logros, racha, misiones, ranking por curso) y dinámicas tipo Kahoot. Lo diferencial: el curso nace del sílabo del docente y la IA corrige con la rúbrica de ese sílabo.

## Operating Context

Navegador, en clase y en estudio individual (también móvil para las salas). Los datos académicos, la gamificación, la identidad y las salas vienen del backend (Express, PostgreSQL, JWT y Socket.IO); la interfaz no sustituye nada con datos ficticios.

## Capabilities and Constraints

- Frontend en HTML, CSS y JavaScript modular sin framework; fuentes autoalojadas (`npm run build:assets` solo para regenerarlas).
- El avatar se guarda en el servidor (`usuario.avatar_config`) y se valida contra un catálogo cerrado; las piezas se desbloquean por nivel o misión.
- La generación de cursos con IA usa Gemini; los borradores nunca se publican solos y consumen la cuota de IA del docente.
- Las salas en vivo viven en la memoria de una sola instancia del servidor (se cancelan al reiniciar).
- Hoy los cursos son de PSeInt; el soporte para Python, JavaScript, Java y C/C++ está planificado.
- Hoy el registro es solo por invitación; la fecha de nacimiento y la aceptación de términos están planificadas.

## Brand Commitments

- Nombre: codeInt. Voz educativa directa, enérgica y en español.
- Identidad: arcade de programación (violeta noche, amarillo de acción, Baloo 2 + Nunito, avatars pixel). Ver `DESIGN.md`.

## Product Principles

1. El siguiente paso del estudiante siempre debe ser evidente.
2. La motivación visual nunca debe ocultar el estado académico real.
3. El progreso, la cuota de IA y los bloqueos se explican con datos y acciones concretas.
4. El trabajo escrito por el estudiante se preserva ante interrupciones y errores.
5. La IA propone y el docente decide: nada generado llega al alumno sin revisión.
6. Las funciones incompletas se presentan con honestidad, sin simular resultados.
7. La competencia es sana: el ranking muestra el top y la propia posición, sin humillar al resto.

## Accessibility & Inclusion

Teclado completo, foco visible, nombres accesibles, contraste WCAG AA, objetivos táctiles de al menos 44 px, forma además de color en los estados y `prefers-reduced-motion` respetado.
