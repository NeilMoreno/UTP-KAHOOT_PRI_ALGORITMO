'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('unirse con código: misma institución, un solo registro, cierre del docente y retiro respetado', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    const courses = [];
    try {
        const teacher = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        const student = await request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' });
        const tAuth = { Authorization: `Bearer ${teacher.body.token}` };
        const sAuth = { Authorization: `Bearer ${student.body.token}` };
        const join = (body, auth = sAuth) => request(app).post('/api/cursos/unirse').set(auth).send(body);
        const create = async (extra = {}) => {
            const response = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test union ${randomUUID().slice(0, 6)}`, periodo: '2026-II', ...extra });
            assert.equal(response.status, 201, JSON.stringify(response.body));
            courses.push(response.body.data.id_curso);
            return response.body.data;
        };

        // Solo estudiantes; formato válido.
        await join({ codigo: 'ABC' }, tAuth).expect(403);
        await join({ codigo: '!!' }).expect(400);
        await join({}).expect(400);
        const none = await join({ codigo: 'ZZQ9' });
        assert.equal(none.status, 404);
        assert.equal(none.body.error, 'COURSE_CODE_NOT_FOUND');

        // Unión correcta: matrícula activa y el docente recibe un aviso.
        const course = await create();
        const first = await join({ codigo: course.codigo_curso.toLowerCase() });
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.equal(first.body.data.nuevo, true);
        const worlds = (await request(app).get(`/api/mundos/curso/${course.id_curso}`).set(sAuth).expect(200)).body.data;
        assert.equal(worlds.length, 7);
        assert.equal(worlds[0].desbloqueado, true);
        const again = await join({ codigo: course.codigo_curso });
        assert.equal(again.status, 200, 'repetir no duplica la matrícula');
        assert.equal(again.body.data.nuevo, false);
        const inbox = (await request(app).get('/api/notificaciones').set(tAuth).expect(200)).body.data;
        assert.ok(inbox.find((item) => item.tipo === 'matricula' && item.enlace === `#/cursos/${course.id_curso}`));

        // El docente cierra la unión por código.
        const closed = await create();
        await request(app).put(`/api/cursos/${closed.id_curso}`).set(tAuth).send({ union_por_codigo: false }).expect(200);
        const blocked = await join({ codigo: closed.codigo_curso });
        assert.equal(blocked.status, 403);
        assert.equal(blocked.body.error, 'JOIN_BY_CODE_DISABLED');

        // Un estudiante retirado por el docente no vuelve a entrar por código.
        const withdrawn = await create();
        await join({ codigo: withdrawn.codigo_curso }).expect(201);
        await migrationPool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [withdrawn.id_curso]);
        const rejoin = await join({ codigo: withdrawn.codigo_curso });
        assert.equal(rejoin.status, 403);
        assert.equal(rejoin.body.error, 'WITHDRAWN_BY_TEACHER');

        // Mismo código en dos periodos: hay que indicar el periodo.
        const code = `QX${Math.floor(Math.random() * 90 + 10)}`;
        await create({ codigo_curso: code, periodo: '2026-I' });
        const second = await create({ codigo_curso: code, periodo: '2026-II' });
        const ambiguous = await join({ codigo: code });
        assert.equal(ambiguous.status, 409);
        assert.deepEqual(ambiguous.body.periodos.sort(), ['2026-I', '2026-II']);
        const chosen = await join({ codigo: code, periodo: '2026-II' });
        assert.equal(chosen.status, 201);
        assert.equal(chosen.body.data.id_curso, second.id_curso);

        // Límite de intentos por usuario (10 por ventana): los que ya hicimos cuentan.
        let limited = null;
        for (let i = 0; i < 12 && !limited; i += 1) {
            const attempt = await join({ codigo: 'ZZQ9' });
            if (attempt.status === 429) limited = attempt;
        }
        assert.ok(limited, 'tras varios intentos se aplica el límite');
        assert.equal(limited.body.error, 'TOO_MANY_JOIN_ATTEMPTS');
    } finally {
        if (courses.length > 0) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = ANY($1::uuid[])`, [courses]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = ANY($1::uuid[])`, [courses]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
