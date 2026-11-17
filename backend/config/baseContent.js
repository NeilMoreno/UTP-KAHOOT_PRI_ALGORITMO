'use strict';

// ==============================================================
// codeInt - Catálogo base de mundos y ejercicios
// Universidad Tecnológica del Perú (UTP) - 2026
//
// Fuente única para inicializar cursos nuevos. El mismo contenido se
// replica en database/seeds.sql para instalaciones desde cero y en
// scripts/sync-base-content.js para bases ya existentes.
// ==============================================================

const BASE_WORLDS = [
    {
        orden: 1,
        nombre: 'Fundamentos',
        descripcion: 'Variables, tipos de datos, entrada y salida con Leer y Escribir, operadores básicos',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Promedio de 3 notas',
                enunciado: 'Crea un algoritmo que lea 3 notas de un estudiante (valores del 0 al 20) y calcule e imprima su promedio con 2 decimales.',
                plantilla_pseint: 'Algoritmo CalcularPromedio\n\tDefinir nota1, nota2, nota3, promedio Como Real\n\t// Lee las tres notas\n\tEscribir "Ingresa la nota 1:"\n\tLeer nota1\n\t// Completa el resto...\nFinAlgoritmo',
                xp_recompensa: 50
            },
            {
                orden: 2,
                titulo: 'Área y Perímetro del Rectángulo',
                enunciado: 'Dado el largo y el ancho de un rectángulo, calcula e imprime el área (largo × ancho) y el perímetro (2 × (largo + ancho)).',
                plantilla_pseint: 'Algoritmo AreaRectangulo\n\tDefinir largo, ancho, area, perimetro Como Real\n\t// Completa aquí...\nFinAlgoritmo',
                xp_recompensa: 60
            },
            {
                orden: 3,
                titulo: 'Conversor de Temperatura',
                enunciado: 'Convierte una temperatura de Celsius a Fahrenheit usando la fórmula: F = (C × 9/5) + 32. Imprime el resultado.',
                plantilla_pseint: 'Algoritmo ConversorTemp\n\tDefinir celsius, fahrenheit Como Real\n\t// Completa aquí...\nFinAlgoritmo',
                xp_recompensa: 70
            }
        ]
    },
    {
        orden: 2,
        nombre: 'Condicionales',
        descripcion: 'Estructuras Si-Entonces, Si-Entonces-Sino, anidados y la instrucción Segun',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Mayor de Edad',
                enunciado: 'Lee la edad de una persona. Si es mayor o igual a 18 imprime "Mayor de edad", en caso contrario imprime "Menor de edad".',
                plantilla_pseint: 'Algoritmo MayorEdad\n\tDefinir edad Como Entero\n\tLeer edad\n\t// Tu solución aquí...\nFinAlgoritmo',
                xp_recompensa: 60
            },
            {
                orden: 2,
                titulo: 'Calculadora con Segun',
                enunciado: 'Lee dos números y un operador (+, -, *, /). Usando Segun, realiza la operación correspondiente e imprime el resultado.',
                plantilla_pseint: 'Algoritmo Calculadora\n\tDefinir a, b, resultado Como Real\n\tDefinir op Como Caracter\n\t// Usa Segun op Hacer...\nFinAlgoritmo',
                xp_recompensa: 80
            },
            {
                orden: 3,
                titulo: 'Categoría de Nota',
                enunciado: 'Lee una nota del 0 al 20. Clasifícala en: Excelente (18-20), Bueno (14-17), Regular (11-13), Desaprobado (0-10).',
                plantilla_pseint: 'Algoritmo CategoriaNota\n\tDefinir nota Como Entero\n\t// Completa los condicionales...\nFinAlgoritmo',
                xp_recompensa: 90
            }
        ]
    },
    {
        orden: 3,
        nombre: 'Bucles',
        descripcion: 'Estructuras repetitivas: Mientras, Repetir-Hasta-Que, Para con paso, acumuladores y contadores',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Factorial con Para',
                enunciado: 'Calcula el factorial de un número N (donde N >= 0) usando la estructura Para. Muestra el resultado.',
                plantilla_pseint: 'Algoritmo Factorial\n\tDefinir n, fact, i Como Entero\n\tfact <- 1\n\t// Usa: Para i <- 1 Hasta n Hacer\nFinAlgoritmo',
                xp_recompensa: 70
            },
            {
                orden: 2,
                titulo: 'Tabla de Multiplicar',
                enunciado: 'Lee un número del 1 al 12 y muestra su tabla de multiplicar completa (del 1 al 12) usando un bucle Para.',
                plantilla_pseint: 'Algoritmo TablaMultiplicar\n\tDefinir num, i Como Entero\n\tLeer num\n\tPara i <- 1 Hasta 12 Con Paso 1 Hacer\n\t// Completa aquí...\n\tFinPara\nFinAlgoritmo',
                xp_recompensa: 80
            },
            {
                orden: 3,
                titulo: 'Validador con Mientras',
                enunciado: 'Pide al usuario que ingrese un número entre 1 y 10. Mientras el número esté fuera del rango, vuelve a pedirlo.',
                plantilla_pseint: 'Algoritmo ValidarRango\n\tDefinir num Como Entero\n\t// Usa Mientras para repetir la lectura\nFinAlgoritmo',
                xp_recompensa: 90
            }
        ]
    },
    {
        orden: 4,
        nombre: 'Vectores',
        descripcion: 'Arreglos unidimensionales: declaración con Dimension, recorrido, búsqueda y ordenamiento básico',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Registro de calificaciones',
                enunciado: 'Lee 5 calificaciones, guárdalas en un vector y muestra el promedio, la nota mayor y la nota menor.',
                plantilla_pseint: 'Algoritmo PromedioVector\n\tDefinir notas Como Real\n\tDimension notas[5]\n\tDefinir i, suma, mayor, menor Como Real\n\t// Lee las 5 notas con un bucle Para\n\t// Calcula promedio, mayor y menor\nFinAlgoritmo',
                xp_recompensa: 70
            },
            {
                orden: 2,
                titulo: 'Búsqueda secuencial',
                enunciado: 'Lee 8 números en un vector y luego un número a buscar. Indica en qué posición se encuentra o si no existe.',
                plantilla_pseint: 'Algoritmo BuscarVector\n\tDefinir numeros Como Entero\n\tDimension numeros[8]\n\tDefinir buscado, i, posicion Como Entero\n\tposicion <- -1\n\t// Llena el vector y recórrelo comparando cada elemento\nFinAlgoritmo',
                xp_recompensa: 80
            },
            {
                orden: 3,
                titulo: 'Invertir un vector',
                enunciado: 'Lee 6 números en un vector y muéstralos en orden inverso al ingresado.',
                plantilla_pseint: 'Algoritmo InvertirVector\n\tDefinir numeros Como Entero\n\tDimension numeros[6]\n\tDefinir i Como Entero\n\t// Llena el vector y recórrelo desde la última posición\nFinAlgoritmo',
                xp_recompensa: 90
            }
        ]
    },
    {
        orden: 5,
        nombre: 'Matrices',
        descripcion: 'Arreglos bidimensionales: lectura, escritura, suma de filas y columnas, diagonal principal',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Suma de matrices 3x3',
                enunciado: 'Lee dos matrices de 3x3 y muestra una tercera matriz con la suma elemento a elemento de ambas.',
                plantilla_pseint: 'Algoritmo SumaMatrices\n\tDefinir a, b, c Como Entero\n\tDimension a[3,3]\n\tDimension b[3,3]\n\tDimension c[3,3]\n\tDefinir i, j Como Entero\n\t// Recorre filas y columnas para leer y sumar\nFinAlgoritmo',
                xp_recompensa: 80
            },
            {
                orden: 2,
                titulo: 'Matriz identidad',
                enunciado: 'Genera y muestra una matriz identidad de 4x4, con 1 en la diagonal principal y 0 en el resto.',
                plantilla_pseint: 'Algoritmo MatrizIdentidad\n\tDefinir m Como Entero\n\tDimension m[4,4]\n\tDefinir i, j Como Entero\n\t// Usa bucles anidados y compara i con j\nFinAlgoritmo',
                xp_recompensa: 90
            },
            {
                orden: 3,
                titulo: 'Diagonal y filas',
                enunciado: 'Lee una matriz de 3x3 y muestra la suma de la diagonal principal y la suma de cada fila.',
                plantilla_pseint: 'Algoritmo DiagonalMatriz\n\tDefinir m Como Entero\n\tDimension m[3,3]\n\tDefinir i, j, sumaDiagonal, sumaFila Como Entero\n\t// Recorre la matriz y acumula los valores pedidos\nFinAlgoritmo',
                xp_recompensa: 100
            }
        ]
    },
    {
        orden: 6,
        nombre: 'Subprocesos',
        descripcion: 'Modularidad con SubProceso y Funcion, paso de parámetros por valor y por referencia',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Función factorial',
                enunciado: 'Define una Funcion factorial(n) que devuelva el factorial de un número y úsala para calcular el factorial de un valor leído.',
                plantilla_pseint: 'Algoritmo UsarFactorial\n\tDefinir n, resultado Como Entero\n\tLeer n\n\tresultado <- factorial(n)\n\tEscribir resultado\nFinAlgoritmo\n\nFuncion resultado <- factorial(n)\n\tDefinir i, acumulado Como Entero\n\t// Completa la función\nFinFuncion',
                xp_recompensa: 90
            },
            {
                orden: 2,
                titulo: 'SubProceso para mostrar',
                enunciado: 'Crea un SubProceso que reciba un vector de 5 números y lo imprima separado por comas. Úsalo después de llenar el vector.',
                plantilla_pseint: 'Algoritmo MostrarVector\n\tDefinir numeros Como Entero\n\tDimension numeros[5]\n\t// Llena el vector y llama al subproceso\nFinAlgoritmo\n\nSubProceso mostrar(numeros)\n\tDefinir i Como Entero\n\t// Recorre e imprime el vector\nFinSubProceso',
                xp_recompensa: 100
            },
            {
                orden: 3,
                titulo: 'Función esPar',
                enunciado: 'Define una Funcion esPar(numero) que devuelva Verdadero si el número es par y Falso si es impar. Úsala para clasificar un número leído.',
                plantilla_pseint: 'Algoritmo ClasificarPar\n\tDefinir num Como Entero\n\tLeer num\n\tSi esPar(num) Entonces\n\t\tEscribir "Es par"\n\tSino\n\t\tEscribir "Es impar"\n\tFinSi\nFinAlgoritmo\n\nFuncion resultado <- esPar(numero)\n\t// Completa la función\nFinFuncion',
                xp_recompensa: 100
            }
        ]
    },
    {
        orden: 7,
        nombre: 'Algoritmos',
        descripcion: 'Algoritmos clásicos: Burbuja, Búsqueda Binaria e integración de estructuras complejas',
        ejercicios: [
            {
                orden: 1,
                titulo: 'Ordenamiento burbuja',
                enunciado: 'Lee 6 números en un vector y ordénalos de menor a mayor usando el método de la burbuja. Muestra el vector ordenado.',
                plantilla_pseint: 'Algoritmo Burbuja\n\tDefinir numeros Como Entero\n\tDimension numeros[6]\n\tDefinir i, j, aux Como Entero\n\t// Llena el vector y aplica el intercambio burbuja\nFinAlgoritmo',
                xp_recompensa: 100
            },
            {
                orden: 2,
                titulo: 'Búsqueda binaria',
                enunciado: 'Con un vector ordenado de 8 números, busca un valor usando búsqueda binaria e indica su posición o que no existe.',
                plantilla_pseint: 'Algoritmo BusquedaBinaria\n\tDefinir numeros Como Entero\n\tDimension numeros[8]\n\tDefinir buscado, inicio, fin, medio Como Entero\n\t// Asume el vector ordenado y ajusta inicio/fin en cada paso\nFinAlgoritmo',
                xp_recompensa: 110
            },
            {
                orden: 3,
                titulo: 'Ranking de estudiantes',
                enunciado: 'Lee los puntajes de 5 estudiantes, ordénalos de mayor a menor y muestra el podio con los tres primeros puestos.',
                plantilla_pseint: 'Algoritmo RankingPuntajes\n\tDefinir puntajes Como Entero\n\tDimension puntajes[5]\n\tDefinir i, j, aux Como Entero\n\t// Llena, ordena de mayor a menor y muestra el podio\nFinAlgoritmo',
                xp_recompensa: 120
            }
        ]
    }
];

module.exports = { BASE_WORLDS };
