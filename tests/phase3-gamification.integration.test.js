'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('fase 3: logros, consumo de IA y recuperación de envíos atascados', { skip: !enabled }, async () => {
    const gemini = require('../backend/services/geminiService');
    const originalEvaluate = gemini.evaluatePseIntWithGemini;
    gemini.evaluatePseIntWithGemini = async () => ({
        evaluation: {
            puntaje: 90,
            categoria_error: 'ninguno',
            retroalimentacion: 'La solución cumple el enunciado y la estructura es correcta.',
            sugerencias: ['Agrega comentarios breves.'],
            eficiencia_algoritmica: 'La complejidad es constante.',
            codigo_sugerido_mejora: 'Escribir "ok"'
        },
        usage: { prompt_tokens: 100, response_tokens: 50, thinking_tokens: 0, total_tokens: 150 },
        model: 'gemini-mock-test',
        response_id: 'mock-response-fase3'
    });

    const request = require('supertest');
    const { app } = require('../backend/server');
    const { query, pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    const approvedOperation = randomUUID();
    const staleOperation = randomUUID();
    const submissionIds = [];
    let quotaId = null;
    let studentId = null;
    let enrollmentId = null;
    let achievementsBefore = [];
    let progressBefore = [];

    try {
        const [adminLogin, teacherLogin, studentLogin] = await Promise.all([
            request(app).post('/api/auth/login').send({ email: 'admin@codeintcorp.com', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' })
        ]);
        assert.equal(adminLogin.status, 200);
        assert.equal(teacherLogin.status, 200);
        assert.equal(studentLogin.status, 200);
        studentId = studentLogin.body.user.id_usuario;

        const context = await query(`
            SELECT e.id_ejercicio, c.id_docente, ma.id_matricula
              FROM ejercicio e
              JOIN mundo m ON m.id_mundo = e.id_mundo
              JOIN curso c ON c.id_curso = e.id_curso
              JOIN matricula ma ON ma.id_curso = c.id_curso
             WHERE ma.id_estudiante = $1 AND ma.estado = 'activa' AND m.orden = 1
             ORDER BY e.orden
             LIMIT 1;
        `, [studentId]);
        assert.equal(context.rowCount, 1);
        const exercise = context.rows[0];
        enrollmentId = exercise.id_matricula;
        assert.equal(exercise.id_docente, teacherLogin.body.user.id_usuario);

        // Estado inicial limpio para que las aserciones sean deterministas; se restaura al final.
        achievementsBefore = (await migrationPool.query(
            'SELECT * FROM estudiante_logro WHERE id_estudiante = $1;', [studentId]
        )).rows;
        progressBefore = (await migrationPool.query(
            'SELECT * FROM progreso_mundo WHERE id_matricula = $1;', [enrollmentId]
        )).rows;
        await migrationPool.query('DELETE FROM estudiante_logro WHERE id_estudiante = $1;', [studentId]);

        const quota = await request(app)
            .post('/api/ia/cuotas')
            .set('Authorization', `Bearer ${adminLogin.body.token}`)
            .send({
                id_docente: exercise.id_docente,
                limite_tokens: 100000,
                fecha_inicio: new Date(Date.now() - 60000).toISOString(),
                fecha_fin: new Date(Date.now() + 3600000).toISOString()
            });
        assert.equal(quota.status, 201);
        quotaId = quota.body.data.id_asignacion_tokens;

        // 1. Evaluación aprobada: desbloquea logros y devuelve el resumen de gamificación.
        const code = 'Algoritmo Fase3\n    Escribir "ok"\nFinAlgoritmo';
        const approved = await request(app)
            .post(`/api/ejercicios/${exercise.id_ejercicio}/envios`)
            .set('Authorization', `Bearer ${studentLogin.body.token}`)
            .set('Idempotency-Key', approvedOperation)
            .send({ codigo_pseint: code });
        assert.equal(approved.status, 201);
        submissionIds.push(approved.body.data.id_envio_ejercicio);
        const unlocked = approved.body.data.logros_desbloqueados.map((l) => l.nombre);
        assert.ok(unlocked.includes('Primer Paso'), `logros: ${unlocked.join(', ')}`);
        assert.ok(approved.body.data.gamificacion.nivel_actual >= 1);

        const stored = await query(
            'SELECT count(*)::integer AS total FROM estudiante_logro WHERE id_estudiante = $1;', [studentId]
        );
        assert.equal(stored.rows[0].total, unlocked.length);

        // Repetir con la misma clave no vuelve a otorgar logros ni a cobrar tokens.
        const repeated = await request(app)
            .post(`/api/ejercicios/${exercise.id_ejercicio}/envios`)
            .set('Authorization', `Bearer ${studentLogin.body.token}`)
            .set('Idempotency-Key', approvedOperation)
            .send({ codigo_pseint: code });
        assert.equal(repeated.status, 200);
        assert.equal(repeated.body.data.logros_desbloqueados, undefined);

        // 2. Consulta de consumo: el docente ve su cuota y la operación; otros roles no.
        const consumption = await request(app)
            .get('/api/ia/consumo')
            .set('Authorization', `Bearer ${teacherLogin.body.token}`);
        assert.equal(consumption.status, 200);
        const { cuota_vigente: current, operaciones, resumen } = consumption.body.data;
        assert.equal(Number(current.limite_tokens), 100000);
        assert.ok(Number(current.tokens_consumidos) >= 150);
        assert.equal(
            Number(current.tokens_disponibles),
            100000 - Number(current.tokens_consumidos) - Number(current.tokens_reservados)
        );
        assert.ok(resumen.exitosas >= 1);
        const operation = operaciones.find((o) => o.id_operacion === approvedOperation);
        assert.ok(operation);
        assert.equal(operation.estado_consumo, 'confirmado');
        assert.equal(Number(operation.tokens_consumidos), 150);

        const asStudent = await request(app)
            .get('/api/ia/consumo')
            .set('Authorization', `Bearer ${studentLogin.body.token}`);
        assert.equal(asStudent.status, 403);
        const adminWithoutTeacher = await request(app)
            .get('/api/ia/consumo')
            .set('Authorization', `Bearer ${adminLogin.body.token}`);
        assert.equal(adminWithoutTeacher.status, 400);
        const adminWithTeacher = await request(app)
            .get(`/api/ia/consumo?id_docente=${exercise.id_docente}`)
            .set('Authorization', `Bearer ${adminLogin.body.token}`);
        assert.equal(adminWithTeacher.status, 200);

        // 3. Envío abandonado en "procesando" con tokens reservados: se marca fallido y se libera la reserva.
        const stale = await migrationPool.query(`
            INSERT INTO envio_ejercicio (
                id_operacion, id_matricula, id_estudiante, id_ejercicio, id_curso,
                codigo_pseint, sintaxis_valida, mensaje_sintaxis, estado_evaluacion, fecha_envio
            )
            SELECT $1, $2, $3, e.id_ejercicio, e.id_curso, $5, true, '{}', 'procesando', now() - interval '1 day'
              FROM ejercicio e WHERE e.id_ejercicio = $4
            RETURNING id_envio_ejercicio;
        `, [staleOperation, enrollmentId, studentId, exercise.id_ejercicio, code + '\n']);
        const staleId = stale.rows[0].id_envio_ejercicio;
        submissionIds.push(staleId);
        await migrationPool.query(
            `SELECT * FROM reservar_uso_ia($1, $2, 'evaluacion', 16000, $3, NULL);`,
            [exercise.id_docente, staleOperation, staleId]
        );

        const recovered = await request(app)
            .post(`/api/ejercicios/${exercise.id_ejercicio}/envios`)
            .set('Authorization', `Bearer ${studentLogin.body.token}`)
            .set('Idempotency-Key', staleOperation)
            .send({ codigo_pseint: code + '\n' });
        assert.equal(recovered.status, 409);
        assert.equal(recovered.body.data.estado_evaluacion, 'fallido');
        const released = await query(
            'SELECT estado_consumo FROM uso_ia WHERE id_operacion = $1;', [staleOperation]
        );
        assert.equal(released.rows[0].estado_consumo, 'fallido');
    } finally {
        gemini.evaluatePseIntWithGemini = originalEvaluate;
        if (submissionIds.length > 0) {
            await migrationPool.query(`
                DELETE FROM xp_movimiento
                 WHERE id_evaluacion IN (SELECT id_evaluacion FROM evaluacion_ia WHERE id_envio_ejercicio = ANY($1::uuid[]));
            `, [submissionIds]);
            await migrationPool.query('DELETE FROM evaluacion_ia WHERE id_envio_ejercicio = ANY($1::uuid[]);', [submissionIds]);
            await migrationPool.query('DELETE FROM uso_ia WHERE id_envio_ejercicio = ANY($1::uuid[]);', [submissionIds]);
            await migrationPool.query('DELETE FROM envio_ejercicio WHERE id_envio_ejercicio = ANY($1::uuid[]);', [submissionIds]);
        }
        if (studentId) {
            await migrationPool.query('DELETE FROM estudiante_logro WHERE id_estudiante = $1;', [studentId]);
            for (const row of achievementsBefore) {
                await migrationPool.query(
                    `INSERT INTO estudiante_logro (id_estudiante_logro, id_estudiante, id_logro, fecha_obtencion)
                     VALUES ($1, $2, $3, $4);`,
                    [row.id_estudiante_logro, row.id_estudiante, row.id_logro, row.fecha_obtencion]
                );
            }
        }
        if (enrollmentId) {
            await migrationPool.query('DELETE FROM progreso_mundo WHERE id_matricula = $1;', [enrollmentId]);
            for (const row of progressBefore) {
                await migrationPool.query(`
                    INSERT INTO progreso_mundo (
                        id_progreso_mundo, id_matricula, id_mundo, id_curso, estado, fecha_inicio, fecha_completado
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
                `, [
                    row.id_progreso_mundo, row.id_matricula, row.id_mundo, row.id_curso,
                    row.estado, row.fecha_inicio, row.fecha_completado
                ]);
            }
        }
        if (quotaId) {
            await migrationPool.query('DELETE FROM asignacion_tokens WHERE id_asignacion_tokens = $1;', [quotaId]);
        }
        await pool.end();
        await migrationPool.end();
    }
});
