-- ==============================================================
-- codeInt - Datos Semilla de desarrollo (PROHIBIDO EN PRODUCCION)
-- Universidad Tecnológica del Perú (UTP) - 2026
-- Usuarios con contraseña "codeint123" hasheada con bcrypt (10 rounds)
-- Hash: $2b$10$kYpqHfPmjqXhXiw1X6m.7.sVxnrfb7Mc2OhGq4YH.uDJo.VKxXGVi
-- ==============================================================

-- 1. Institución demo
INSERT INTO institucion (nombre, codigo_licencia, estado) VALUES
    ('Universidad Tecnológica del Perú', 'UTP-2026-DEMO-001', 'activa')
ON CONFLICT DO NOTHING;

-- Dominio institucional demo. El superadministrador se agrega después por bootstrap.
INSERT INTO institucion_dominio (
    id_institucion, dominio, estado, verificado_en, creado_por
)
SELECT id_institucion, 'utp.edu.pe', 'activo', now(), NULL
FROM institucion
WHERE codigo_licencia = 'UTP-2026-DEMO-001'
ON CONFLICT (dominio) DO NOTHING;

-- 2. Usuarios demo (password: "codeint123" hasheada)
-- El superadministrador nunca se crea como dato demo; use db:bootstrap-superadmin.
-- Docente demo
INSERT INTO usuario (id_institucion, nombre, apellido, email, password_hash, rol, genero, estado, correo_verificado, correo_verificado_en)
SELECT i.id_institucion,
       'Miranda', 'Saldaña', 'docente.demo@utp.edu.pe',
       '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W',
       'docente', 'femenino', 'activo', true, now()
FROM   institucion i WHERE i.codigo_licencia = 'UTP-2026-DEMO-001'
ON CONFLICT DO NOTHING;

-- Estudiante demo
INSERT INTO usuario (id_institucion, nombre, apellido, email, password_hash, rol, genero, estado, correo_verificado, correo_verificado_en)
SELECT i.id_institucion,
       'Neil', 'Moreno', 'estudiante.demo@utp.edu.pe',
       '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W',
       'estudiante', 'masculino', 'activo', true, now()
FROM   institucion i WHERE i.codigo_licencia = 'UTP-2026-DEMO-001'
ON CONFLICT DO NOTHING;

-- 3. Curso demo
INSERT INTO curso (id_institucion, id_docente, nombre, codigo_curso, periodo, estado)
SELECT i.id_institucion,
       d.id_usuario,
       'Algoritmos y Lógica de Programación',
       'ALPR-001',
       '2026-II',
       'activo'
FROM   institucion i
JOIN   usuario d ON d.email = 'docente.demo@utp.edu.pe'
WHERE  i.codigo_licencia = 'UTP-2026-DEMO-001'
ON CONFLICT DO NOTHING;

-- 4. Matrícula del estudiante demo al curso demo
INSERT INTO matricula (id_curso, id_estudiante, estado)
SELECT c.id_curso, e.id_usuario, 'activa'
FROM   curso c
JOIN   usuario e ON e.email = 'estudiante.demo@utp.edu.pe'
WHERE  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 5. Los 7 Mundos Base del curso demo
INSERT INTO mundo (id_curso, orden, nombre, descripcion, tipo_origen)
SELECT c.id_curso, m.orden, m.nombre, m.descripcion, 'base'
FROM   curso c,
       (VALUES
           (1, 'Fundamentos',      'Variables, tipos de datos, entrada y salida con Leer y Escribir, operadores básicos'),
           (2, 'Condicionales',    'Estructuras Si-Entonces, Si-Entonces-Sino, anidados y la instrucción Segun'),
           (3, 'Bucles',           'Estructuras repetitivas: Mientras, Repetir-Hasta-Que, Para con paso, acumuladores y contadores'),
           (4, 'Vectores',         'Arreglos unidimensionales: declaración con Dimension, recorrido, búsqueda y ordenamiento básico'),
           (5, 'Matrices',         'Arreglos bidimensionales: lectura, escritura, suma de filas y columnas, diagonal principal'),
           (6, 'Subprocesos',      'Modularidad con SubProceso y Funcion, paso de parámetros por valor y por referencia'),
           (7, 'Algoritmos',       'Algoritmos clásicos: Burbuja, Búsqueda Binaria e integración de estructuras complejas')
       ) AS m(orden, nombre, descripcion)
WHERE  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 6. Ejercicios del Mundo 1: Fundamentos
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Promedio de 3 notas',
     'Crea un algoritmo que lea 3 notas de un estudiante (valores del 0 al 20) y calcule e imprima su promedio con 2 decimales.',
     E'Algoritmo CalcularPromedio\n\tDefinir nota1, nota2, nota3, promedio Como Real\n\t// Lee las tres notas\n\tEscribir "Ingresa la nota 1:"\n\tLeer nota1\n\t// Completa el resto...\nFinAlgoritmo',
     50),
    (2,
     'Área y Perímetro del Rectángulo',
     'Dado el largo y el ancho de un rectángulo, calcula e imprime el área (largo × ancho) y el perímetro (2 × (largo + ancho)).',
     E'Algoritmo AreaRectangulo\n\tDefinir largo, ancho, area, perimetro Como Real\n\t// Completa aquí...\nFinAlgoritmo',
     60),
    (3,
     'Conversor de Temperatura',
     'Convierte una temperatura de Celsius a Fahrenheit usando la fórmula: F = (C × 9/5) + 32. Imprime el resultado.',
     E'Algoritmo ConversorTemp\n\tDefinir celsius, fahrenheit Como Real\n\t// Completa aquí...\nFinAlgoritmo',
     70)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 1
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 7. Ejercicios del Mundo 2: Condicionales
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Mayor de Edad',
     'Lee la edad de una persona. Si es mayor o igual a 18 imprime "Mayor de edad", en caso contrario imprime "Menor de edad".',
     E'Algoritmo MayorEdad\n\tDefinir edad Como Entero\n\tLeer edad\n\t// Tu solución aquí...\nFinAlgoritmo',
     60),
    (2,
     'Calculadora con Segun',
     'Lee dos números y un operador (+, -, *, /). Usando Segun, realiza la operación correspondiente e imprime el resultado.',
     E'Algoritmo Calculadora\n\tDefinir a, b, resultado Como Real\n\tDefinir op Como Caracter\n\t// Usa Segun op Hacer...\nFinAlgoritmo',
     80),
    (3,
     'Categoría de Nota',
     'Lee una nota del 0 al 20. Clasifícala en: Excelente (18-20), Bueno (14-17), Regular (11-13), Desaprobado (0-10).',
     E'Algoritmo CategoriaNota\n\tDefinir nota Como Entero\n\t// Completa los condicionales...\nFinAlgoritmo',
     90)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 2
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 8. Ejercicios del Mundo 3: Bucles
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Factorial con Para',
     'Calcula el factorial de un número N (donde N >= 0) usando la estructura Para. Muestra el resultado.',
     E'Algoritmo Factorial\n\tDefinir n, fact, i Como Entero\n\tfact <- 1\n\t// Usa: Para i <- 1 Hasta n Hacer\nFinAlgoritmo',
     70),
    (2,
     'Tabla de Multiplicar',
     'Lee un número del 1 al 12 y muestra su tabla de multiplicar completa (del 1 al 12) usando un bucle Para.',
     E'Algoritmo TablaMultiplicar\n\tDefinir num, i Como Entero\n\tLeer num\n\tPara i <- 1 Hasta 12 Con Paso 1 Hacer\n\t// Completa aquí...\n\tFinPara\nFinAlgoritmo',
     80),
    (3,
     'Validador con Mientras',
     'Pide al usuario que ingrese un número entre 1 y 10. Mientras el número esté fuera del rango, vuelve a pedirlo.',
     E'Algoritmo Validador\n\tDefinir num Como Entero\n\tEscribir "Ingresa un número entre 1 y 10:"\n\tLeer num\n\tMientras (num < 1 O num > 10) Hacer\n\t// Completa aquí...\n\tFinMientras\nFinAlgoritmo',
     90)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 3
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 8.1 Ejercicios del Mundo 4: Vectores
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Registro de calificaciones',
     'Lee 5 calificaciones, guárdalas en un vector y muestra el promedio, la nota mayor y la nota menor.',
     E'Algoritmo PromedioVector\n\tDefinir notas Como Real\n\tDimension notas[5]\n\tDefinir i, suma, mayor, menor Como Real\n\t// Lee las 5 notas con un bucle Para\n\t// Calcula promedio, mayor y menor\nFinAlgoritmo',
     70),
    (2,
     'Búsqueda secuencial',
     'Lee 8 números en un vector y luego un número a buscar. Indica en qué posición se encuentra o si no existe.',
     E'Algoritmo BuscarVector\n\tDefinir numeros Como Entero\n\tDimension numeros[8]\n\tDefinir buscado, i, posicion Como Entero\n\tposicion <- -1\n\t// Llena el vector y recórrelo comparando cada elemento\nFinAlgoritmo',
     80),
    (3,
     'Invertir un vector',
     'Lee 6 números en un vector y muéstralos en orden inverso al ingresado.',
     E'Algoritmo InvertirVector\n\tDefinir numeros Como Entero\n\tDimension numeros[6]\n\tDefinir i Como Entero\n\t// Llena el vector y recórrelo desde la última posición\nFinAlgoritmo',
     90)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 4
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 8.2 Ejercicios del Mundo 5: Matrices
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Suma de matrices 3x3',
     'Lee dos matrices de 3x3 y muestra una tercera matriz con la suma elemento a elemento de ambas.',
     E'Algoritmo SumaMatrices\n\tDefinir a, b, c Como Entero\n\tDimension a[3,3]\n\tDimension b[3,3]\n\tDimension c[3,3]\n\tDefinir i, j Como Entero\n\t// Recorre filas y columnas para leer y sumar\nFinAlgoritmo',
     80),
    (2,
     'Matriz identidad',
     'Genera y muestra una matriz identidad de 4x4, con 1 en la diagonal principal y 0 en el resto.',
     E'Algoritmo MatrizIdentidad\n\tDefinir m Como Entero\n\tDimension m[4,4]\n\tDefinir i, j Como Entero\n\t// Usa bucles anidados y compara i con j\nFinAlgoritmo',
     90),
    (3,
     'Diagonal y filas',
     'Lee una matriz de 3x3 y muestra la suma de la diagonal principal y la suma de cada fila.',
     E'Algoritmo DiagonalMatriz\n\tDefinir m Como Entero\n\tDimension m[3,3]\n\tDefinir i, j, sumaDiagonal, sumaFila Como Entero\n\t// Recorre la matriz y acumula los valores pedidos\nFinAlgoritmo',
     100)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 5
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 8.3 Ejercicios del Mundo 6: Subprocesos
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Función factorial',
     'Define una Funcion factorial(n) que devuelva el factorial de un número y úsala para calcular el factorial de un valor leído.',
     E'Algoritmo UsarFactorial\n\tDefinir n, resultado Como Entero\n\tLeer n\n\tresultado <- factorial(n)\n\tEscribir resultado\nFinAlgoritmo\n\nFuncion resultado <- factorial(n)\n\tDefinir i, acumulado Como Entero\n\t// Completa la función\nFinFuncion',
     90),
    (2,
     'SubProceso para mostrar',
     'Crea un SubProceso que reciba un vector de 5 números y lo imprima separado por comas. Úsalo después de llenar el vector.',
     E'Algoritmo MostrarVector\n\tDefinir numeros Como Entero\n\tDimension numeros[5]\n\t// Llena el vector y llama al subproceso\nFinAlgoritmo\n\nSubProceso mostrar(numeros)\n\tDefinir i Como Entero\n\t// Recorre e imprime el vector\nFinSubProceso',
     100),
    (3,
     'Función esPar',
     'Define una Funcion esPar(numero) que devuelva Verdadero si el número es par y Falso si es impar. Úsala para clasificar un número leído.',
     E'Algoritmo ClasificarPar\n\tDefinir num Como Entero\n\tLeer num\n\tSi esPar(num) Entonces\n\t\tEscribir "Es par"\n\tSino\n\t\tEscribir "Es impar"\n\tFinSi\nFinAlgoritmo\n\nFuncion resultado <- esPar(numero)\n\t// Completa la función\nFinFuncion',
     100)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 6
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 8.4 Ejercicios del Mundo 7: Algoritmos
INSERT INTO ejercicio (id_mundo, id_curso, titulo, enunciado, plantilla_pseint, orden, xp_recompensa)
SELECT mu.id_mundo, c.id_curso, ej.titulo, ej.enunciado, ej.plantilla, ej.orden, ej.xp
FROM   mundo mu
JOIN   curso c ON c.id_curso = mu.id_curso
CROSS JOIN (VALUES
    (1,
     'Ordenamiento burbuja',
     'Lee 6 números en un vector y ordénalos de menor a mayor usando el método de la burbuja. Muestra el vector ordenado.',
     E'Algoritmo Burbuja\n\tDefinir numeros Como Entero\n\tDimension numeros[6]\n\tDefinir i, j, aux Como Entero\n\t// Llena el vector y aplica el intercambio burbuja\nFinAlgoritmo',
     100),
    (2,
     'Búsqueda binaria',
     'Con un vector ordenado de 8 números, busca un valor usando búsqueda binaria e indica su posición o que no existe.',
     E'Algoritmo BusquedaBinaria\n\tDefinir numeros Como Entero\n\tDimension numeros[8]\n\tDefinir buscado, inicio, fin, medio Como Entero\n\t// Asume el vector ordenado y ajusta inicio/fin en cada paso\nFinAlgoritmo',
     110),
    (3,
     'Ranking de estudiantes',
     'Lee los puntajes de 5 estudiantes, ordénalos de mayor a menor y muestra el podio con los tres primeros puestos.',
     E'Algoritmo RankingPuntajes\n\tDefinir puntajes Como Entero\n\tDimension puntajes[5]\n\tDefinir i, j, aux Como Entero\n\t// Llena, ordena de mayor a menor y muestra el podio\nFinAlgoritmo',
     120)
) AS ej(orden, titulo, enunciado, plantilla, xp)
WHERE  mu.orden = 7
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- 9. Catálogo de Niveles
INSERT INTO nivel (numero, nombre, xp_requerido) VALUES
    (1, 'Novato',          0),
    (2, 'Aprendiz',        300),
    (3, 'Programador',     700),
    (4, 'Desarrollador',   1500),
    (5, 'Arquitecto',      3000),
    (6, 'Maestro',         6000)
ON CONFLICT DO NOTHING;

-- 10. Catálogo de Logros e Insignias
INSERT INTO logro (nombre, descripcion, tipo, tipo_condicion, valor_umbral) VALUES
    ('Primer Paso',        'Completa tu primer ejercicio aprobado.',            'insignia', 'ejercicios_aprobados',   1),
    ('Explorador',         'Completa 10 ejercicios aprobados.',                 'insignia', 'ejercicios_aprobados',  10),
    ('Maestro PSeInt',     'Aprueba 50 ejercicios de pseudocódigo.',            'logro',    'ejercicios_aprobados',  50),
    ('Mundo Desbloqueado', 'Completa tu primer mundo temático.',                'insignia', 'mundos_completados',     1),
    ('Explorador Global',  'Completa todos los 7 mundos del curso.',            'logro',    'mundos_completados',     7),
    ('Primer XP',          'Acumula tus primeros 100 puntos de experiencia.',   'insignia', 'xp_acumulado',         100),
    ('Centurión',          'Acumula 1000 puntos de experiencia.',               'logro',    'xp_acumulado',        1000),
    ('Legendario',         'Acumula 5000 puntos de experiencia.',               'logro',    'xp_acumulado',        5000),
    ('Competidor',         'Participa en tu primera sala Kahoot.',              'insignia', 'partidas_participadas',  1),
    ('Campeón',            'Participa en 20 salas Kahoot.',                     'logro',    'partidas_participadas', 20)
ON CONFLICT DO NOTHING;

-- 11. Progreso inicial del estudiante en los 7 mundos
-- (Mundo 1 en progreso, mundos 2-7 bloqueados)
INSERT INTO progreso_mundo (id_matricula, id_mundo, id_curso, estado, fecha_inicio)
SELECT mat.id_matricula, mu.id_mundo, c.id_curso,
       CASE WHEN mu.orden = 1 THEN 'en_progreso' ELSE 'bloqueado' END,
       CASE WHEN mu.orden = 1 THEN now() ELSE NULL END
FROM   matricula mat
JOIN   curso c     ON c.id_curso       = mat.id_curso
JOIN   mundo mu    ON mu.id_curso      = c.id_curso
JOIN   usuario est ON est.id_usuario   = mat.id_estudiante
WHERE  est.email = 'estudiante.demo@utp.edu.pe'
  AND  c.codigo_curso = 'ALPR-001' AND c.periodo = '2026-II'
ON CONFLICT DO NOTHING;

-- ==============================================================
-- FIN DE LOS SEEDS | codeInt
-- ==============================================================
