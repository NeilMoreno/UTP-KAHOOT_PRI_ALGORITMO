'use strict';

process.env.KAHOOT_COUNTDOWN_SECONDS = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

const once = (socket, event, ms = 8000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tiempo agotado esperando "${event}"`)), ms);
    socket.once(event, (payload) => {
        clearTimeout(timer);
        resolve(payload);
    });
});
const ask = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

const sampleQuestions = () => ([
    {
        enunciado: '¿Qué comando muestra texto en PSeInt?',
        tiempo_limite_seg: 10,
        opciones: [
            { texto: 'Escribir', es_correcta: true },
            { texto: 'Leer' },
            { texto: 'Definir' }
        ]
    },
    {
        enunciado: '¿Qué palabra cierra un Si?',
        tiempo_limite_seg: 10,
        opciones: [
            { texto: 'FinPara' },
            { texto: 'FinSi', es_correcta: true }
        ]
    }
]);

test('fase 4: partida Kahoot completa con sockets reales, reconexión y persistencia', { skip: !enabled }, async () => {
    const { io: connectClient } = require('socket.io-client');
    const request = require('supertest');
    const { app, server } = require('../backend/server');
    const { query, pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    const connect = (token) => new Promise((resolve, reject) => {
        const socket = connectClient(url, { auth: { token }, transports: ['websocket'], reconnection: false });
        socket.once('connect', () => resolve(socket));
        socket.once('connect_error', reject);
    });

    const sockets = [];
    const roomIds = [];
    let studentId = null;
    let achievementsBefore = [];

    try {
        const [teacherLogin, studentLogin] = await Promise.all([
            request(app).post('/api/auth/login').send({ email: 'docente.demo@utp.edu.pe', password: 'codeint123' }),
            request(app).post('/api/auth/login').send({ email: 'estudiante.demo@utp.edu.pe', password: 'codeint123' })
        ]);
        assert.equal(teacherLogin.status, 200);
        assert.equal(studentLogin.status, 200);
        studentId = studentLogin.body.user.id_usuario;
        const teacherAuth = `Bearer ${teacherLogin.body.token}`;
        const studentAuth = `Bearer ${studentLogin.body.token}`;

        const course = await query(`
            SELECT c.id_curso
              FROM curso c
              JOIN matricula ma ON ma.id_curso = c.id_curso
             WHERE c.id_docente = $1 AND ma.id_estudiante = $2 AND ma.estado = 'activa'
             LIMIT 1;
        `, [teacherLogin.body.user.id_usuario, studentId]);
        assert.equal(course.rowCount, 1);
        const idCurso = course.rows[0].id_curso;

        achievementsBefore = (await migrationPool.query(
            'SELECT * FROM estudiante_logro WHERE id_estudiante = $1;', [studentId]
        )).rows;
        await migrationPool.query('DELETE FROM estudiante_logro WHERE id_estudiante = $1;', [studentId]);

        // --- Autenticación del socket ---
        await assert.rejects(connect('token-invalido'), /INVALID_TOKEN/);
        await assert.rejects(connect(''), /AUTHENTICATION_REQUIRED/);

        const teacher = await connect(teacherLogin.body.token);
        const student = await connect(studentLogin.body.token);
        sockets.push(teacher, student);

        // --- Permisos y validación ---
        const studentCreate = await ask(student, 'room:create', { id_curso: idCurso, preguntas: sampleQuestions() });
        assert.equal(studentCreate.error, 'SOLO_DOCENTES_PUEDEN_CREAR_SALAS');
        const invalidCreate = await ask(teacher, 'room:create', {
            id_curso: idCurso,
            preguntas: [{ enunciado: 'Sin opción correcta', opciones: [{ texto: 'A' }, { texto: 'B' }] }]
        });
        assert.equal(invalidCreate.success, false);
        assert.equal(invalidCreate.error, 'INVALID_QUESTIONS');
        const invalidCount = await query(
            `SELECT count(*)::integer AS total FROM sala_multijugador WHERE id_curso = $1 AND estado = 'espera';`,
            [idCurso]
        );
        const waitingBefore = invalidCount.rows[0].total;

        // --- Sala preparada por REST y activada por el anfitrión ---
        const prepared = await request(app).post('/api/salas').set('Authorization', teacherAuth)
            .send({ id_curso: idCurso, preguntas: sampleQuestions() });
        assert.equal(prepared.status, 201);
        roomIds.push(prepared.body.data.id_sala);
        const preparedPin = prepared.body.data.pin;

        const infoBefore = await request(app).get(`/api/salas/${preparedPin}/info`).set('Authorization', studentAuth);
        assert.equal(infoBefore.status, 200);
        assert.equal(infoBefore.body.data.lista_para_unirse, false);
        const earlyJoin = await ask(student, 'room:join', { pin: preparedPin });
        assert.equal(earlyJoin.error, 'SALA_NO_ENCONTRADA_O_INACTIVA');

        const hosted = await ask(teacher, 'room:host', { pin: preparedPin });
        assert.equal(hosted.success, true);
        const infoAfter = await request(app).get(`/api/salas/${preparedPin}/info`).set('Authorization', studentAuth);
        assert.equal(infoAfter.body.data.lista_para_unirse, true);

        const emptyStart = await ask(teacher, 'game:start', { pin: preparedPin });
        assert.equal(emptyStart.error, 'SIN_PARTICIPANTES');
        assert.equal((await ask(teacher, 'game:finish', { pin: preparedPin })).success, true);
        const cancelled = await query('SELECT estado FROM sala_multijugador WHERE id_sala = $1;', [prepared.body.data.id_sala]);
        assert.equal(cancelled.rows[0].estado, 'cancelada');

        // --- Partida real ---
        const created = await ask(teacher, 'room:create', { id_curso: idCurso, preguntas: sampleQuestions() });
        assert.equal(created.success, true);
        const { pin, id_sala: idSala } = created.data;
        roomIds.push(idSala);
        assert.match(pin, /^\d{6}$/);
        assert.notEqual(pin, preparedPin);
        assert.equal(created.data.totalPreguntas, 2);
        assert.equal((await query(
            `SELECT count(*)::integer AS total FROM sala_multijugador WHERE id_curso = $1 AND estado = 'espera';`,
            [idCurso]
        )).rows[0].total, waitingBefore + 1, 'el intento inválido no debe dejar salas a medias');

        const playerJoined = once(teacher, 'player:joined');
        const joined = await ask(student, 'room:join', { pin, nick: '  Ana <script>  ' });
        assert.equal(joined.success, true);
        assert.equal(joined.data.nick, 'Ana script', 'el apodo se sanea');
        assert.equal((await playerJoined).totalPlayers, 1);

        const notStudent = await ask(teacher, 'room:join', { pin });
        assert.equal(notStudent.error, 'SOLO_ESTUDIANTES_PUEDEN_UNIRSE');
        const wrongPin = await ask(student, 'room:join', { pin: '12' });
        assert.equal(wrongPin.error, 'PIN_INVALIDO');

        const firstQuestion = once(student, 'question:show');
        const [startA, startB] = await Promise.all([
            ask(teacher, 'game:start', { pin }),
            ask(teacher, 'game:start', { pin })
        ]);
        assert.equal([startA, startB].filter((r) => r.success).length, 1, 'solo un inicio debe prosperar');

        const q1 = await firstQuestion;
        assert.equal(q1.numero, 1);
        assert.ok(q1.opciones.every((o) => o.es_correcta === undefined), 'no se debe filtrar la opción correcta');
        const early = await ask(teacher, 'question:next', { pin });
        assert.equal(early.error, 'LA_PREGUNTA_ACTUAL_AUN_NO_TERMINA');

        const correctQ1 = (await query(
            'SELECT id_opcion, etiqueta FROM opcion WHERE id_pregunta = $1 AND es_correcta;', [q1.id_pregunta]
        )).rows[0];
        const invalidOption = await ask(student, 'answer:submit', { id_opcion: randomUUID() });
        assert.equal(invalidOption.error, 'OPCION_INVALIDA');

        const hostResults1 = once(teacher, 'question:results');
        const playerResult1 = once(student, 'answer:result');
        const [first, second] = await Promise.all([
            ask(student, 'answer:submit', { id_opcion: correctQ1.id_opcion }),
            ask(student, 'answer:submit', { id_opcion: correctQ1.id_opcion })
        ]);
        assert.equal([first, second].filter((r) => r.success).length, 1, 'una respuesta duplicada no debe puntuar dos veces');
        assert.equal(first.puntajeObtenido, undefined, 'no se revela el acierto antes del cierre');

        const results1 = await hostResults1;
        assert.equal(results1.opcion_correcta.etiqueta, correctQ1.etiqueta);
        assert.equal(results1.stats[correctQ1.etiqueta], 1);
        assert.equal(results1.esUltimaPregunta, false);
        const result1 = await playerResult1;
        assert.equal(result1.correct, true);
        assert.ok(result1.puntaje > 500 && result1.puntaje <= 1000);
        assert.equal(result1.posicion, 1);

        // --- Reconexión del jugador entre preguntas ---
        const reconnected = once(teacher, 'player:reconnected');
        student.disconnect();
        const student2 = await connect(studentLogin.body.token);
        sockets.push(student2);
        const state = once(student2, 'room:state');
        const rejoin = await ask(student2, 'room:join', { pin });
        assert.equal(rejoin.success, true);
        assert.equal(rejoin.data.id_participante, joined.data.id_participante);
        assert.equal((await reconnected).nick, 'Ana script');
        assert.equal((await state).estado, 'estadisticas_pregunta');

        // --- Segunda pregunta: respuesta incorrecta ---
        const secondQuestion = once(student2, 'question:show');
        const next = await ask(teacher, 'question:next', { pin });
        assert.equal(next.success, true);
        const q2 = await secondQuestion;
        assert.equal(q2.numero, 2);
        const wrongQ2 = (await query(
            'SELECT id_opcion FROM opcion WHERE id_pregunta = $1 AND NOT es_correcta LIMIT 1;', [q2.id_pregunta]
        )).rows[0];
        const hostResults2 = once(teacher, 'question:results');
        const playerResult2 = once(student2, 'answer:result');
        assert.equal((await ask(student2, 'answer:submit', { id_opcion: wrongQ2.id_opcion })).success, true);
        const results2 = await hostResults2;
        assert.equal(results2.esUltimaPregunta, true);
        const result2 = await playerResult2;
        assert.equal(result2.correct, false);
        assert.equal(result2.puntaje, 0);
        assert.equal(result2.puntajeTotal, result1.puntaje);

        // --- Cierre: podio, XP y logros ---
        const hostPodium = once(teacher, 'game:podium');
        const playerPodium = once(student2, 'game:podium');
        const finish = await ask(teacher, 'question:next', { pin });
        assert.equal(finish.finalizado, true);
        const podium = await playerPodium;
        assert.equal(podium.tuPuesto, 1);
        assert.equal(podium.tuPuntaje, result1.puntaje);
        assert.equal(podium.xpGanado, 150);
        assert.equal(podium.resultados_guardados, true);
        assert.ok(podium.logros_desbloqueados.some((l) => l.nombre === 'Competidor'));
        const hostFinal = await hostPodium;
        assert.equal(hostFinal.podio.length, 1);
        assert.equal(hostFinal.rankingCompleto[0].nick, 'Ana script');

        const repeatFinish = await ask(teacher, 'game:finish', { pin });
        assert.equal(repeatFinish.success, true, 'cerrar dos veces es inofensivo');

        const stored = await query(`
            SELECT
                (SELECT estado FROM sala_multijugador WHERE id_sala = $1) AS estado,
                (SELECT count(*)::integer FROM respuesta_sala WHERE id_sala = $1) AS respuestas,
                (SELECT sum(puntaje_obtenido)::integer FROM respuesta_sala WHERE id_sala = $1) AS puntos,
                (SELECT puntaje_final FROM participante_sala WHERE id_sala = $1) AS puntaje_final,
                (SELECT posicion_final FROM participante_sala WHERE id_sala = $1) AS posicion_final,
                (SELECT sum(x.cantidad)::integer FROM xp_movimiento x
                   JOIN participante_sala p ON p.id_participante = x.id_participante_sala
                  WHERE p.id_sala = $1) AS xp;
        `, [idSala]);
        assert.deepEqual(stored.rows[0], {
            estado: 'finalizada',
            respuestas: 2,
            puntos: result1.puntaje,
            puntaje_final: result1.puntaje,
            posicion_final: 1,
            xp: 150
        });

        // --- Acceso REST al detalle: solo el docente propietario ---
        const detail = await request(app).get(`/api/salas/${idSala}/detalle`).set('Authorization', teacherAuth);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.data.preguntas.length, 2);
        assert.equal((await request(app).get(`/api/salas/${idSala}/detalle`).set('Authorization', studentAuth)).status, 403);
        assert.equal((await request(app).get('/api/salas/no-es-uuid/detalle').set('Authorization', teacherAuth)).status, 400);
        // La sala ya finalizó: deja de ser consultable por PIN
        assert.equal((await request(app).get(`/api/salas/${pin}/info`).set('Authorization', studentAuth)).status, 404);
    } finally {
        for (const socket of sockets) socket.disconnect();
        await new Promise((resolve) => server.close(resolve));

        if (roomIds.length > 0) {
            await migrationPool.query(`
                DELETE FROM xp_movimiento
                 WHERE id_participante_sala IN (SELECT id_participante FROM participante_sala WHERE id_sala = ANY($1::uuid[]));
            `, [roomIds]);
            await migrationPool.query('DELETE FROM respuesta_sala WHERE id_sala = ANY($1::uuid[]);', [roomIds]);
            await migrationPool.query('DELETE FROM participante_sala WHERE id_sala = ANY($1::uuid[]);', [roomIds]);
            await migrationPool.query('UPDATE sala_multijugador SET id_pregunta_activa = NULL WHERE id_sala = ANY($1::uuid[]);', [roomIds]);
            await migrationPool.query(`
                DELETE FROM opcion WHERE id_pregunta IN (SELECT id_pregunta FROM pregunta WHERE id_sala = ANY($1::uuid[]));
            `, [roomIds]);
            await migrationPool.query('DELETE FROM pregunta WHERE id_sala = ANY($1::uuid[]);', [roomIds]);
            await migrationPool.query('DELETE FROM sala_multijugador WHERE id_sala = ANY($1::uuid[]);', [roomIds]);
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
        await pool.end();
        await migrationPool.end();
    }
});
