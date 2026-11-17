'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('un curso nuevo nace con siete mundos y su contenido base', { skip: !enabled }, async () => {
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');
    const { BASE_WORLDS } = require('../backend/config/baseContent');

    let idCurso = null;

    try {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' })
            .expect(200);

        const auth = { Authorization: `Bearer ${login.body.token}` };
        const suffix = randomUUID().slice(0, 6).toUpperCase();

        const created = await request(app)
            .post('/api/cursos')
            .set(auth)
            .send({
                nombre: 'Curso de verificación de contenido',
                codigo_curso: `TST-${suffix}`,
                periodo: '2026-TEST'
            })
            .expect(201);

        idCurso = created.body.data.id_curso;

        const detail = await request(app)
            .get(`/api/cursos/${idCurso}`)
            .set(auth)
            .expect(200);

        assert.equal(detail.body.data.mundos.length, BASE_WORLDS.length);
        for (const mundo of detail.body.data.mundos) {
            const base = BASE_WORLDS.find((item) => item.orden === mundo.orden);
            assert.ok(base, `El mundo ${mundo.orden} debe existir en el catálogo base`);
            assert.equal(Number(mundo.total_ejercicios), base.ejercicios.length);
        }

        const mundo4 = detail.body.data.mundos.find((mundo) => mundo.orden === 4);
        await request(app)
            .post('/api/ejercicios')
            .set(auth)
            .send({
                id_mundo: mundo4.id_mundo,
                titulo: 'Ejercicio con orden duplicado',
                enunciado: 'No debe crearse porque el orden 1 ya existe.',
                orden: 1
            })
            .expect(409);
    } finally {
        if (idCurso) {
            await migrationPool.query('DELETE FROM ejercicio WHERE id_curso = $1;', [idCurso]);
            await migrationPool.query('DELETE FROM mundo WHERE id_curso = $1;', [idCurso]);
            await migrationPool.query('DELETE FROM curso WHERE id_curso = $1;', [idCurso]);
        }
        await pool.end();
        await migrationPool.end();
    }
});
