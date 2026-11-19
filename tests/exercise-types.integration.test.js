'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

test('ejercicios predecir/completar/ordenar/corregir: se corrigen sin IA, sin cuota y sin filtrar la solución', { skip: !enabled }, async () => {
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

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test tipos ${randomUUID().slice(0, 6)}`, periodo: '2026-II', lenguaje: 'python' });
        assert.equal(course.status, 201);
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);
        // Un curso de Python nace sin mundos: se crea uno a mano.
        const world = await migrationPool.query(
            `INSERT INTO mundo (id_curso, orden, nombre, descripcion, tipo_origen) VALUES ($1, 1, 'Mundo de prueba', 'x', 'personalizado') RETURNING id_mundo;`, [courseId]
        );
        const idMundo = world.rows[0].id_mundo;

        const create = (orden, body) => request(app).post('/api/ejercicios').set(tAuth).send({
            id_mundo: idMundo, orden, xp_recompensa: 40, titulo: `Ejercicio ${orden}`, enunciado: 'Resuelve el ejercicio de práctica indicado.', ...body
        });

        // Validación al crear
        await create(1, { tipo: 'completar', material: { codigo: 'sin huecos' }, solucion: { huecos: [] } }).expect(400);
        await create(1, { tipo: 'inventado' }).expect(400);

        const predict = (await create(1, { tipo: 'predecir', material: { codigo: 'print(2 * 3)' }, solucion: { respuesta: '6' } })).body.data;
        const fill = (await create(2, { tipo: 'completar', material: { codigo: 'for i in ___(3):\n    ___(i)' }, solucion: { huecos: [['range'], ['print']] } })).body.data;
        const lines = ['total = 0', 'for n in [1, 2]:', '    total = total + n', 'print(total)'];
        const order = (await create(3, { tipo: 'ordenar', material: {}, solucion: { lineas: lines } })).body.data;
        const fix = (await create(4, { tipo: 'corregir', material: { codigo: 'def suma(a, b):\n    return a - b' }, solucion: { debe_contener: ['return a + b'], no_debe_contener: ['return a - b'] } })).body.data;
        for (const item of [predict, fill, order, fix]) assert.ok(item?.id_ejercicio, JSON.stringify(item));

        // El docente ve la solución; el estudiante nunca.
        const teacherList = (await request(app).get(`/api/ejercicios/mundo/${idMundo}`).set(tAuth).expect(200)).body.data;
        assert.ok(teacherList.find((item) => item.tipo === 'predecir').solucion.respuesta === '6');
        const studentView = (await request(app).get(`/api/ejercicios/${predict.id_ejercicio}`).set(sAuth).expect(200)).body.data;
        assert.equal(studentView.tipo, 'predecir');
        assert.equal('solucion' in studentView, false);
        assert.deepEqual(Object.keys(studentView.material).sort(), ['codigo', 'pregunta']);
        const orderView = (await request(app).get(`/api/ejercicios/${order.id_ejercicio}`).set(sAuth).expect(200)).body.data;
        assert.deepEqual([...orderView.material.lineas].sort(), [...lines].sort());
        assert.equal(JSON.stringify(orderView).includes('"solucion"'), false);

        const submit = (exercise, body) => request(app).post(`/api/ejercicios/${exercise.id_ejercicio}/envios`).set(sAuth).set('Idempotency-Key', randomUUID()).send(body);

        // Predecir: error y luego acierto (sin cuota de IA: el docente no tiene una vigente en este curso nuevo).
        const wrong = await submit(predict, { respuesta: '5' });
        assert.equal(wrong.status, 201, JSON.stringify(wrong.body));
        assert.equal(wrong.body.data.puntaje, 0);
        const right = await submit(predict, { respuesta: ' 6 ' });
        assert.equal(right.status, 201);
        assert.equal(right.body.data.puntaje, 100);
        assert.equal(right.body.data.xp_ganada, 40);
        const again = await submit(predict, { respuesta: '6' });
        assert.equal(again.body.data.xp_ganada, 0, 'el XP de un ejercicio se otorga una sola vez');

        const filled = await submit(fill, { respuesta: ['range', 'print'] });
        assert.equal(filled.body.data.puntaje, 100);
        const ordered = await submit(order, { respuesta: lines });
        assert.equal(ordered.body.data.puntaje, 100);
        const misordered = await submit(order, { respuesta: [lines[0], lines[2], lines[1], lines[3]] });
        assert.ok(misordered.body.data.puntaje < 70);
        const fixed = await submit(fix, { codigo_pseint: 'def suma(a, b):\n    return a + b' });
        assert.equal(fixed.body.data.puntaje, 100);
        assert.equal(fixed.body.data.mundo_completado, true);

        // Respuesta con forma inválida
        await submit(fill, { respuesta: 'texto' }).expect(400);
        await submit(predict, {}).expect(400);

        // Nada de esto gastó tokens de IA.
        const usage = await migrationPool.query(`SELECT count(*)::int AS total FROM uso_ia WHERE id_curso = $1;`, [courseId]).catch(() => ({ rows: [{ total: 0 }] }));
        assert.equal(usage.rows[0].total, 0);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
