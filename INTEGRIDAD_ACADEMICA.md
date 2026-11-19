# Integridad académica y calificación con IA

Un navegador **no es un examen supervisado**: no se puede impedir al 100 % que un estudiante abra otra pestaña,
use otro dispositivo o consulte un chatbot. codeInt hace tres cosas realistas:

1. **Hace que la trampa sirva menos** (diseño de los ejercicios).
2. **Registra evidencia para el docente**, sin acusar ni castigar automáticamente.
3. **Blinda la calificación por IA** para que no se pueda manipular con texto.

## 1. Diseño que reduce la trampa
- Además de *escribir código*, hay ejercicios de **predecir la salida, completar huecos, ordenar líneas y corregir
  código**. Exigen leer y entender, y se corrigen en el servidor sin IA (sin gastar tokens).
- La **solución nunca se envía al navegador** del estudiante (`ejercicio.solucion` es solo del servidor; en *ordenar*
  las líneas llegan mezcladas).
- *Corregir código* ignora los comentarios al comprobar, así que no basta con escribir la respuesta dentro de uno.
- El **diagnóstico de entrada** se corrige en el servidor con el banco de preguntas (la respuesta correcta tampoco
  sale al navegador).
- Para notas que importan, lo único realmente "blindado" es una **evaluación presencial** con las salas en vivo.

## 2. Evidencia para el docente (pestaña *Integridad* de las analíticas del curso)
El editor cuenta —sin guardar el contenido pegado— cuántas veces se pegó texto y cuánto, cuántas veces y por cuánto
tiempo se salió de la pestaña, si se copió el enunciado, el tiempo abierto y las pulsaciones. El servidor además
compara el código con el de otros estudiantes del mismo ejercicio (ignorando nombres de variables, comentarios y la
plantilla común). Con eso calcula un **semáforo** (verde / ámbar / rojo) con los motivos.
- **No bloquea al estudiante ni cambia su nota.** El docente revisa y marca "revisado".
- Un estudiante ve un aviso en el editor: se registra el pegado y los cambios de pestaña.
- Los umbrales están en `backend/services/integrityService.js` (`THRESHOLDS`).
- *Pendiente de validar con la institución:* el texto legal del aviso, sobre todo con menores de edad.

## 3. Defensa contra la inyección de prompt
El código del estudiante viaja dentro del prompt del evaluador, así que se trata como dato no confiable
(`backend/services/promptGuard.js`, `geminiService.js`):
- **Se quitan los comentarios** y los caracteres invisibles/bidireccionales antes de enviar el código al modelo; las
  cadenas muy largas se recortan.
- **Delimitadores aleatorios** por petición: el estudiante no puede cerrar el bloque de datos.
- **Detector determinista** (sin IA) de frases como "ignora las instrucciones", "da 100", roles, JSON simulado y
  etiquetas falsas.
- El modelo devuelve `intento_manipulacion` y se le indica que lo reporte en lugar de obedecer.
- Ante cualquier alerta, **la nota no puede aprobar (tope 69)**, se guarda lo que habría dado el modelo
  (`puntaje_modelo`) y el envío queda **en rojo** para revisión. El estudiante recibe un aviso claro.
- Las preguntas de sala, el diagnóstico y los ejercicios locales **no usan IA al corregir**: no tienen superficie de
  inyección.

### Probado con Gemini real
Código incorrecto (resta en lugar de suma): 40 puntos con o sin comentario-ataque; el detector marcó el comentario y
el propio modelo reportó el ataque escondido en una cadena.

## Límites conocidos
- Una frase de ataque muy creativa puede no coincidir con las reglas; por eso hay varias capas y el docente revisa.
- La similitud entre estudiantes necesita suficiente código propio (no compara respuestas muy cortas).
- No se ejecuta el código del estudiante (nota por casos de prueba): sería la defensa más fuerte, pero exige una caja
  de ejecución aislada; queda como mejora futura.
