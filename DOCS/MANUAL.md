# Manual de codeInt por rol

Cuentas de demostración (solo desarrollo y pruebas; la contraseña `codeint123` es pública, **no la uses en un entorno compartido**):
`estudiante.demo@utp.edu.pe`, `docente.demo@utp.edu.pe` y `admin@codeintcorp.com`.

---

## Estudiante

### Entrar y registrarse
- El registro es **solo por invitación** (enlace por correo). Pide nombre, contraseña (con la lista de requisitos en vivo), **fecha de nacimiento** y la aceptación de los **términos y la privacidad**. Si eres menor de 18 años también hace falta el **consentimiento de tu apoderado o tutor**.
- Puedes unirte a una sala en vivo con el **PIN** desde la página principal (te pedirá iniciar sesión).

### Mis cursos
- **Unirme con un código:** en el centro de misiones, "Unirme a un curso". Solo funcionan los cursos de **tu institución**. Si el mismo código existe en dos periodos, te pedirá el periodo. Si tu docente te retiró del curso o cerró el ingreso por código, debe matricularte él.
- Cada curso tiene un **lenguaje** (PSeInt, Python, JavaScript, Java o C/C++) y se recorre por **mundos** en orden.
- **Diagnóstico de entrada (opcional):** 1 pregunta por mundo, un solo intento. Si dominas los primeros mundos quedan **convalidados** y empiezas más adelante. No hace falta estudiar.
- **Lección:** al abrir un mundo con lección, léela (3 a 5 tarjetas cortas) y responde la pregunta de comprobación. No da nota ni XP.

### Ejercicios
| Tipo | Qué haces | Cómo se corrige |
|---|---|---|
| Escribir código | Escribes tu solución en el editor | La IA, con la rúbrica del docente. Antes puedes usar **Revisar código** (gratis) |
| Predecir la salida | Lees un programa y escribes qué imprime | Al instante, sin IA |
| Completar el código | Rellenas los huecos | Al instante, sin IA |
| Ordenar las líneas | Ordenas con las flechas | Al instante; solo aprueba el orden exacto |
| Corregir el código | Arreglas un código con errores | Al instante; los comentarios no cuentan |

- Apruebas con **70 o más**. El XP de cada ejercicio se otorga **una sola vez**.
- **Pedir pista:** hasta **3 pistas** por ejercicio de escribir código, después de tu primer intento (la pista se basa en lo que escribiste y nunca da la solución). Hay un tope diario.
- **Defensa del código:** si apruebas, puede aparecer una pregunta sobre **tu propio código**. Es opcional, de un solo intento y no cambia tu nota.
- **Refuerzo:** si fallas 3 veces el mismo tipo de error, el panel te sugiere repasar la lección del mundo y practicar con ejercicios automáticos.
- Al enviar, el sistema registra si **pegaste texto** o **saliste de la pestaña** para que tu docente pueda revisar. No bloquea nada.
- **No escribas instrucciones dirigidas a la IA** en tu código (pedir nota, "ignora las reglas"): la nota queda limitada a 69 y tu docente revisará el envío.

### Progreso y juego
- **XP, niveles, racha diaria, misiones semanales, logros, ranking del curso** y **avatar pixel** personalizable (las piezas se desbloquean con nivel o misiones).
- La **campana** de la barra superior avisa de logros, mundos completados y salas preparadas.
- **Salas en vivo:** entra con el PIN; la posición del podio solo cuenta si sumaste puntos.

---

## Docente

### Cursos
- **Nuevo curso:** elige el **lenguaje**. PSeInt nace con 7 mundos base; los demás nacen **vacíos** y se llenan con el sílabo. El **código del curso** se genera del nombre (puedes escribir uno propio). El lenguaje se puede cambiar solo mientras no haya ejercicios ni entregas.
- **Editar el curso:** activo/inactivo y la opción **"los estudiantes de mi institución pueden unirse con el código"** (desmárcala para matricular tú).
- **Matrícula:** individual por correo o por CSV. Un estudiante retirado no vuelve a entrar por código.

### Sílabo con IA (flujo principal)
1. **Sube el PDF** del sílabo (máx. 10 MB). Es un documento no confiable: la IA no obedece instrucciones que contenga.
2. **Generar con IA:** crea unidades con 3 ejercicios (básico, intermedio y reto) con rúbrica y plantilla en el lenguaje del curso, y preguntas para salas.
3. **Generar lecciones y ejercicios con IA:** agrega una lección de teoría por unidad y ejercicios extra de corrección automática (predecir, completar, ordenar, corregir). **Verifica las respuestas** de esos ejercicios: se muestran con la solución.
4. **Revisa y edita todo** (rúbricas, unidades, lecciones, preguntas) y **publica**. Si ya hay entregas, lo nuevo se añade al final sin borrar nada.
- Cada generación consume tokens de **tu cuota de IA** (la asigna el superadministrador). Los ejercicios automáticos no consumen tokens.

### Mundos y ejercicios
- Puedes crear ejercicios de cualquier tipo a mano (formulario "Nuevo ejercicio"). En los automáticos defines la solución y **nunca llega al navegador del estudiante**.

### Salas Kahoot
- Crea una sala con tus preguntas o **importa del banco del curso** (preguntas del sílabo). Se abre desde el panel del anfitrión.

### Analíticas
- Por curso: mundos, estudiantes, errores, **integridad** y salas. **Exportar CSV** del avance de los estudiantes.
- **Integridad:** lista los envíos con señales de riesgo (pegado, salidas de pestaña, parecido con otro estudiante, intento de manipular la nota, defensa fallida) en **ámbar o rojo**. Son **señales, no pruebas**: decide tú y márcalo como revisado. Más detalle en `INTEGRIDAD_ACADEMICA.md`.
- La **campana** avisa de envíos para revisar y de estudiantes que se unen con el código.

---

## Superadministrador
- **Usuarios, invitaciones, instituciones y dominios** (el registro por invitación deriva rol e institución).
- **Licencias y cuotas de IA** por docente (periodo y tokens) con el consumo registrado.
- **Perfil demográfico** (rangos de edad y género) con grupos pequeños ocultos (<5) para no identificar a menores.
- Cuentas e historial de auditoría no se borran: se **desactivan**.

---

## Preguntas frecuentes
- **"Mi docente no tiene cuota de IA":** puedes seguir usando "Revisar código" y los ejercicios automáticos; avisa al docente.
- **"Gemini no respondió":** el servicio gratuito se satura a veces; el sistema reintenta y no descuenta tu intento. Prueba de nuevo en unos segundos.
- **Sesión:** se renueva sola mientras uses la plataforma; "Cerrar sesión" la cierra en este navegador.
