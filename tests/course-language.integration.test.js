'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('curso con lenguaje: PSeInt trae 7 mundos, los demás nacen vacíos y el lenguaje se bloquea con contenido', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    const created = [];
    try {
        const login = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        assert.equal(login.status, 200);
        const auth = { Authorization: `Bearer ${login.body.token}` };
        const name = (label) => `Test ${label} ${randomUUID().slice(0, 6)}`;

        const bad = await request(app).post('/api/cursos').set(auth).send({ nombre: name('cobol'), periodo: '2026-II', lenguaje: 'cobol' });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.error, 'INVALID_LANGUAGE');

        const python = await request(app).post('/api/cursos').set(auth).send({ nombre: name('py'), periodo: '2026-II', lenguaje: 'python' });
        assert.equal(python.status, 201, JSON.stringify(python.body));
        created.push(python.body.data.id_curso);
        assert.equal(python.body.data.lenguaje, 'python');
        const pyWorlds = await request(app).get(`/api/mundos/curso/${python.body.data.id_curso}`).set(auth).expect(200);
        assert.equal(pyWorlds.body.data.length, 0, 'un curso que no es PSeInt empieza sin mundos');
        assert.equal(pyWorlds.body.curso.lenguaje, 'python');

        const pseint = await request(app).post('/api/cursos').set(auth).send({ nombre: name('ps'), periodo: '2026-II' });
        assert.equal(pseint.status, 201);
        created.push(pseint.body.data.id_curso);
        assert.equal(pseint.body.data.lenguaje, 'pseint');
        const psWorlds = await request(app).get(`/api/mundos/curso/${pseint.body.data.id_curso}`).set(auth).expect(200);
        assert.equal(psWorlds.body.data.length, 7);

        // Curso vacío: el lenguaje aún se puede cambiar. Con ejercicios: bloqueado.
        const change = await request(app).put(`/api/cursos/${python.body.data.id_curso}`).set(auth).send({ lenguaje: 'java' });
        assert.equal(change.status, 200);
        assert.equal(change.body.data.lenguaje, 'java');
        const locked = await request(app).put(`/api/cursos/${pseint.body.data.id_curso}`).set(auth).send({ lenguaje: 'python' });
        assert.equal(locked.status, 409);
        assert.equal(locked.body.error, 'LANGUAGE_LOCKED');
    } finally {
        if (created.length > 0) {
            // El curso queda inactivo (la auditoría impide borrarlo).
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = ANY($1::uuid[])`, [created]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
