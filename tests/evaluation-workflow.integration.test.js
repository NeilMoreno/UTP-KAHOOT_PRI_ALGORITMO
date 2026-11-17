'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('flujo de evaluación idempotente registra una sola evaluación y el uso real', { skip: !enabled }, async () => {
    const gemini = require('../backend/services/geminiService');
    const originalEvaluate = gemini.evaluatePseIntWithGemini;
    gemini.evaluatePseIntWithGemini = async () => ({
        evaluation: {
            puntaje: 65,
            categoria_error: 'logica',
            retroalimentacion: 'La estructura es válida, pero la solución aún no cumple todo el enunciado.',
            sugerencias: ['Revisa la condición principal.'],
            eficiencia_algoritmica: 'La complejidad es lineal.',
            codigo_sugerido_mejora: 'Escribir "Revisar"'
        },
        usage: { prompt_tokens: 120, response_tokens: 70, thinking_tokens: 20, total_tokens: 210 },
        model: 'gemini-mock-test',
        response_id: 'mock-response'
    });

    const request = require('supertest');
    const { app } = require('../backend/server');
    const { query, pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');
    const operationId = randomUUID();
    let quotaId = null;
    let submissionId = null;
    let enrollmentId = null;
    let worldId = null;
    let progressBefore = null;

    try {
        const [adminLogin, studentLogin] = await Promise.all([
            request(app).post('/api/auth/login').send({ email: 'admin@codeintcorp.com', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' })
        ]);
        assert.equal(adminLogin.status, 200);
        assert.equal(studentLogin.status, 200);

        const context = await query(`
            SELECT e.id_ejercicio, e.id_mundo, c.id_docente, ma.id_matricula
              FROM ejercicio e
              JOIN mundo m ON m.id_mundo = e.id_mundo
              JOIN curso c ON c.id_curso = e.id_curso
              JOIN matricula ma ON ma.id_curso = c.id_curso
             WHERE ma.id_estudiante = $1 AND ma.estado = 'activa' AND m.orden = 1
             ORDER BY e.orden DESC
             LIMIT 1;
        `, [studentLogin.body.user.id_usuario]);
        assert.equal(context.rowCount, 1);
        const exercise = context.rows[0];
        enrollmentId = exercise.id_matricula;
        worldId = exercise.id_mundo;

        const priorProgress = await query(
            'SELECT * FROM progreso_mundo WHERE id_matricula = $1 AND id_mundo = $2;',
            [enrollmentId, worldId]
        );
        progressBefore = priorProgress.rows[0] || null;

        const quota = await request(app)
            .post('/api/ia/cuotas')
            .set('Authorization', `Bearer ${adminLogin.body.token}`)
            .send({
                id_docente: exercise.id_docente,
                limite_tokens: 50000,
                fecha_inicio: new Date(Date.now() - 60000).toISOString(),
                fecha_fin: new Date(Date.now() + 3600000).toISOString()
            });
        assert.equal(quota.status, 201);
        quotaId = quota.body.data.id_asignacion_tokens;

        const code = 'Algoritmo FlujoCompleto\n    Escribir "prueba"\nFinAlgoritmo';
        const first = await request(app)
            .post(`/api/ejercicios/${exercise.id_ejercicio}/envios`)
            .set('Authorization', `Bearer ${studentLogin.body.token}`)
            .set('Idempotency-Key', operationId)
            .send({ codigo_pseint: code });
        assert.equal(first.status, 201);
        submissionId = first.body.data.id_envio_ejercicio;
        assert.equal(first.body.data.estado_evaluacion, 'completado');
        assert.equal(first.body.data.puntaje, 65);

        const repeated = await request(app)
            .post(`/api/ejercicios/${exercise.id_ejercicio}/envios`)
            .set('Authorization', `Bearer ${studentLogin.body.token}`)
            .set('Idempotency-Key', operationId)
            .send({ codigo_pseint: code });
        assert.equal(repeated.status, 200);

        const counts = await query(`
            SELECT
                (SELECT count(*) FROM envio_ejercicio WHERE id_operacion = $1)::integer AS envios,
                (SELECT count(*) FROM uso_ia WHERE id_operacion = $1
                    AND estado_consumo = 'confirmado' AND tokens_consumidos = 210)::integer AS usos,
                (SELECT count(*) FROM evaluacion_ia WHERE id_envio_ejercicio = $2)::integer AS evaluaciones;
        `, [operationId, submissionId]);
        assert.deepEqual(counts.rows[0], { envios: 1, usos: 1, evaluaciones: 1 });
    } finally {
        gemini.evaluatePseIntWithGemini = originalEvaluate;
        if (submissionId) {
            await migrationPool.query(
                'DELETE FROM xp_movimiento WHERE id_evaluacion IN (SELECT id_evaluacion FROM evaluacion_ia WHERE id_envio_ejercicio = $1);',
                [submissionId]
            );
            await migrationPool.query('DELETE FROM evaluacion_ia WHERE id_envio_ejercicio = $1;', [submissionId]);
            await migrationPool.query('DELETE FROM uso_ia WHERE id_envio_ejercicio = $1;', [submissionId]);
            await migrationPool.query('DELETE FROM envio_ejercicio WHERE id_envio_ejercicio = $1;', [submissionId]);
        }
        if (enrollmentId && worldId) {
            if (progressBefore) {
                await migrationPool.query(`
                    UPDATE progreso_mundo
                       SET estado = $3, fecha_inicio = $4, fecha_completado = $5
                     WHERE id_matricula = $1 AND id_mundo = $2;
                `, [
                    enrollmentId,
                    worldId,
                    progressBefore.estado,
                    progressBefore.fecha_inicio,
                    progressBefore.fecha_completado
                ]);
            } else {
                await migrationPool.query(
                    'DELETE FROM progreso_mundo WHERE id_matricula = $1 AND id_mundo = $2;',
                    [enrollmentId, worldId]
                );
            }
        }
        if (quotaId) {
            await migrationPool.query('DELETE FROM asignacion_tokens WHERE id_asignacion_tokens = $1;', [quotaId]);
        }
        await pool.end();
        await migrationPool.end();
    }
});
