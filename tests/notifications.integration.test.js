'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('notificaciones: alerta al docente, aviso de sala, privacidad y lectura', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    let courseId = null;
    try {
        const teacher = await request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' });
        const student = await request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' });
        const tAuth = { Authorization: `Bearer ${teacher.body.token}` };
        const sAuth = { Authorization: `Bearer ${student.body.token}` };
        const countOf = async (auth) => (await request(app).get('/api/notificaciones').set(auth).expect(200)).body;

        await request(app).get('/api/notificaciones').expect(401);
        const before = { teacher: (await countOf(tAuth)).sin_leer, student: (await countOf(sAuth)).sin_leer };

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test notif ${randomUUID().slice(0, 6)}`, periodo: '2026-II' });
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);
        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(tAuth).expect(200)).body.data;
        const exerciseId = (await request(app).get(`/api/ejercicios/mundo/${worlds[0].id_mundo}`).set(tAuth).expect(200)).body.data[0].id_ejercicio;

        // Un envío rechazado localmente pero con señales de riesgo alto avisa al docente.
        const code = ['Algoritmo Prueba', '    Escribir "hola"', ...Array(4).fill('// relleno para tener suficiente código')].join('\n');
        const signals = { pegados: 1, chars_pegados: code.length, max_pegado: code.length, cambios_foco: 9, segundos_fuera: 200, copias_enunciado: 1, segundos_abierto: 8, pulsaciones: 3 };
        await request(app).post(`/api/ejercicios/${exerciseId}/envios`).set(sAuth).set('Idempotency-Key', randomUUID()).send({ codigo_pseint: code, senales: signals }).expect(422);

        // Una sala preparada avisa a los estudiantes matriculados.
        const room = await request(app).post('/api/salas').set(tAuth).send({
            id_curso: courseId,
            preguntas: [{ enunciado: '¿Cuánto es 2 + 2?', tiempo_limite_seg: 20, puntos_base: 1000, opciones: [{ texto: '4', es_correcta: true }, { texto: '5', es_correcta: false }] }]
        });
        assert.equal(room.status, 201, JSON.stringify(room.body));
        await new Promise((resolve) => setTimeout(resolve, 400)); // el aviso se crea en segundo plano

        const teacherInbox = await countOf(tAuth);
        const alert = teacherInbox.data.find((item) => item.tipo === 'integridad' && item.enlace === `#/analiticas/${courseId}`);
        assert.ok(alert, 'el docente recibe la alerta de integridad');
        assert.equal(teacherInbox.sin_leer, before.teacher + 1);

        const studentInbox = await countOf(sAuth);
        assert.ok(studentInbox.data.find((item) => item.tipo === 'sala'), 'el estudiante recibe el aviso de sala');
        assert.equal(studentInbox.data.find((item) => item.id_notificacion === alert.id_notificacion), undefined, 'cada usuario solo ve las suyas');

        // El estudiante no puede marcar la notificación del docente; el docente sí la suya.
        const stolen = await request(app).post(`/api/notificaciones/${alert.id_notificacion}/leer`).set(sAuth).expect(200);
        assert.equal(stolen.body.marcadas, 0);
        const own = await request(app).post(`/api/notificaciones/${alert.id_notificacion}/leer`).set(tAuth).expect(200);
        assert.equal(own.body.marcadas, 1);
        await request(app).post('/api/notificaciones/no-es-uuid/leer').set(tAuth).expect(400);

        // Marcar todas.
        await request(app).post('/api/notificaciones/leer').set(sAuth).expect(200);
        assert.equal((await countOf(sAuth)).sin_leer, 0);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
