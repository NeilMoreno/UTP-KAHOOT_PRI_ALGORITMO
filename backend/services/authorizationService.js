'use strict';

const { query } = require('../config/database');
const { httpError } = require('../utils/httpError');
const { isUuid } = require('../utils/validation');
const { getValidatedWorlds } = require('./diagnosticService');

const getAuthorizedCourse = async (idCurso, user, { write = false } = {}) => {
    if (!isUuid(idCurso)) throw httpError(400, 'El identificador del curso no tiene un formato válido.', 'INVALID_ID');

    const result = await query(`
        SELECT c.id_curso, c.id_institucion, c.id_docente, c.estado,
               EXISTS (
                   SELECT 1 FROM matricula m
                   WHERE m.id_curso = c.id_curso
                     AND m.id_estudiante = $2
                     AND m.estado = 'activa'
               ) AS esta_matriculado
        FROM curso c
        WHERE c.id_curso = $1
        LIMIT 1;
    `, [idCurso, user.id_usuario]);

    if (result.rowCount === 0) throw httpError(404, 'Curso no encontrado.', 'COURSE_NOT_FOUND');
    const course = result.rows[0];

    if (user.rol === 'superadministrador') return course;

    if (user.rol === 'docente') {
        if (course.id_docente !== user.id_usuario || course.id_institucion !== user.id_institucion) {
            throw httpError(403, 'No tiene permisos sobre este curso.', 'COURSE_FORBIDDEN');
        }
        return course;
    }

    if (write || user.rol !== 'estudiante' || !course.esta_matriculado) {
        throw httpError(403, 'No tiene acceso a este curso.', 'COURSE_FORBIDDEN');
    }

    return course;
};

const getAuthorizedWorld = async (idMundo, user, options = {}) => {
    if (!isUuid(idMundo)) throw httpError(400, 'El identificador del mundo no tiene un formato válido.', 'INVALID_ID');
    const result = await query(
        'SELECT id_mundo, id_curso, orden, nombre, descripcion FROM mundo WHERE id_mundo = $1 LIMIT 1;',
        [idMundo]
    );
    if (result.rowCount === 0) throw httpError(404, 'Mundo no encontrado.', 'WORLD_NOT_FOUND');
    const world = result.rows[0];
    await getAuthorizedCourse(world.id_curso, user, options);
    const validated = options.enforceSequence && user.rol === 'estudiante' && world.orden > 1
        ? await getValidatedWorlds(world.id_curso, user.id_usuario) : 0;
    if (options.enforceSequence && user.rol === 'estudiante' && world.orden > 1 && world.orden - 1 > validated) {
        const previous = await query(`
            SELECT
                count(DISTINCT e.id_ejercicio)::integer AS total,
                count(DISTINCT CASE WHEN ev.puntaje >= 70 THEN e.id_ejercicio END)::integer AS aprobados
            FROM mundo m
            LEFT JOIN ejercicio e ON e.id_mundo = m.id_mundo
            LEFT JOIN matricula ma
              ON ma.id_curso = m.id_curso
             AND ma.id_estudiante = $2
             AND ma.estado = 'activa'
            LEFT JOIN envio_ejercicio ee
              ON ee.id_ejercicio = e.id_ejercicio
             AND ee.id_matricula = ma.id_matricula
            LEFT JOIN evaluacion_ia ev ON ev.id_envio_ejercicio = ee.id_envio_ejercicio
            WHERE m.id_curso = $1 AND m.orden = $3;
        `, [world.id_curso, user.id_usuario, world.orden - 1]);
        const progress = previous.rows[0];
        if (!progress || progress.total === 0 || progress.aprobados < progress.total) {
            throw httpError(403, 'Este mundo está bloqueado. Complete primero el mundo anterior.', 'WORLD_LOCKED');
        }
    }
    return world;
};

const getAuthorizedExercise = async (idEjercicio, user, options = {}) => {
    if (!isUuid(idEjercicio)) throw httpError(400, 'El identificador del ejercicio no tiene un formato válido.', 'INVALID_ID');
    const result = await query(
        'SELECT id_ejercicio, id_mundo, id_curso FROM ejercicio WHERE id_ejercicio = $1 LIMIT 1;',
        [idEjercicio]
    );
    if (result.rowCount === 0) throw httpError(404, 'Ejercicio no encontrado.', 'EXERCISE_NOT_FOUND');
    const exercise = result.rows[0];
    await getAuthorizedCourse(exercise.id_curso, user, options);
    return exercise;
};

module.exports = { getAuthorizedCourse, getAuthorizedWorld, getAuthorizedExercise };
