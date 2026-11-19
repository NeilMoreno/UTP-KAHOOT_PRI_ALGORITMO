'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('integridad: las señales quedan registradas, el docente las ve y las marca como revisadas', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    let courseId = null;
    try {
        const teacher = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        const student = await request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' });
        assert.equal(teacher.status, 200);
        assert.equal(student.status, 200);
        const tAuth = { Authorization: `Bearer ${teacher.body.token}` };
        const sAuth = { Authorization: `Bearer ${student.body.token}` };

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test integ ${randomUUID().slice(0, 6)}`, periodo: '2026-II' });
        assert.equal(course.status, 201);
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);
        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(tAuth).expect(200)).body.data;
        const exercises = (await request(app).get(`/api/ejercicios/mundo/${worlds[0].id_mundo}`).set(tAuth).expect(200)).body.data;
        const exerciseId = exercises[0].id_ejercicio;

        // Código que no pasa la validación local (falta FinAlgoritmo): se guarda sin gastar IA, con sus señales.
        const code = ['Algoritmo Prueba', '    Escribir "hola"', ...Array(4).fill('// relleno para tener suficiente código')].join('\n');
        const signals = {
            pegados: 1, chars_pegados: code.length, max_pegado: code.length,
            cambios_foco: 9, segundos_fuera: 200, copias_enunciado: 1, segundos_abierto: 8, pulsaciones: 3, hack: 'x'
        };
        const sent = await request(app).post(`/api/ejercicios/${exerciseId}/envios`).set(sAuth)
            .set('Idempotency-Key', randomUUID()).send({ codigo_pseint: code, senales: signals });
        assert.equal(sent.status, 422, JSON.stringify(sent.body));

        const report = (await request(app).get(`/api/analiticas/curso/${courseId}/integridad`).set(tAuth).expect(200)).body;
        assert.equal(report.data.length, 1);
        const item = report.data[0];
        assert.equal(item.riesgo, 'rojo');
        assert.ok(item.motivos_riesgo.includes('PEGADO_GRANDE'));
        assert.ok(item.motivos_riesgo.includes('SALIO_DE_LA_PESTANA'));
        assert.equal('hack' in item.senales, false, 'las claves desconocidas no se guardan');
        assert.equal(report.resumen.rojos_pendientes, 1);

        // El estudiante no ve el informe ni lo modifica.
        await request(app).get(`/api/analiticas/curso/${courseId}/integridad`).set(sAuth).expect(403);
        await request(app).patch(`/api/analiticas/curso/${courseId}/integridad/${item.id_envio_ejercicio}`).set(sAuth).send({ revisado: true }).expect(403);

        // El docente lo marca como revisado: sale de pendientes y aparece con ?revisados=1.
        await request(app).patch(`/api/analiticas/curso/${courseId}/integridad/${item.id_envio_ejercicio}`).set(tAuth).send({ revisado: 'si' }).expect(400);
        await request(app).patch(`/api/analiticas/curso/${courseId}/integridad/${item.id_envio_ejercicio}`).set(tAuth).send({ revisado: true }).expect(200);
        const pending = (await request(app).get(`/api/analiticas/curso/${courseId}/integridad`).set(tAuth).expect(200)).body;
        assert.equal(pending.data.length, 0);
        assert.equal(pending.resumen.revisados, 1);
        const all = (await request(app).get(`/api/analiticas/curso/${courseId}/integridad?revisados=1`).set(tAuth).expect(200)).body;
        assert.equal(all.data.length, 1);
        assert.ok(all.data[0].revisado_en);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
