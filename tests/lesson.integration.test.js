'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

const lesson = () => ({
    tarjetas: [1, 2, 3].map((n) => ({ titulo: `Idea ${n}`, contenido: 'Una explicación breve y clara para empezar a programar.', ejemplo: 'print("hola")' })),
    comprobacion: { pregunta: '¿Qué función muestra texto en pantalla?', opciones: ['print', 'input', 'len', 'range'], correcta: 0 }
});

const draftContent = () => ({
    unidades: [1, 2, 3].map((n) => ({
        nombre: `Unidad ${n}`, descripcion: 'Descripción de la unidad.', semanas: `S${n}`,
        ejercicios: ['basico', 'intermedio', 'reto'].map((nivel) => ({
            nivel, titulo: `Ejercicio ${nivel} ${n}`, enunciado: 'Resuelve este ejercicio con un ejemplo concreto.', plantilla: '', fuente: '',
            rubrica: [{ criterio: 'Corrección', descripcion: 'Produce la salida esperada.' }]
        })),
        preguntas_sala: [1, 2, 3].map(() => ({
            enunciado: '¿Cuál es la respuesta correcta aquí?',
            opciones: ['a', 'b', 'c', 'd'].map((texto, i) => ({ texto, es_correcta: i === 0 }))
        })),
        ...(n === 1 ? { leccion: lesson(), extras: [{ tipo: 'predecir', titulo: 'Predice la suma', enunciado: 'Lee el código y escribe lo que imprime.', material: { codigo: 'print(2 + 3)' }, solucion: { respuesta: '5' } }] } : {})
    }))
});

test('la lección del borrador se publica con el mundo y el estudiante la recibe', { skip: !enabled }, async () => {
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

        const course = await request(app).post('/api/cursos').set(tAuth).send({ nombre: `Test leccion ${randomUUID().slice(0, 6)}`, periodo: '2026-II', lenguaje: 'python' });
        assert.equal(course.status, 201);
        courseId = course.body.data.id_curso;
        await request(app).post(`/api/cursos/${courseId}/matricular`).set(tAuth).send({ email: 'estudiante.demo@utp.edu.pe' }).expect(201);

        // Sin borrador no se pueden generar lecciones.
        const none = await request(app).post(`/api/cursos/${courseId}/silabo/borrador/lecciones`).set(tAuth);
        assert.equal(none.status, 409);
        assert.equal(none.body.error, 'DRAFT_NOT_EDITABLE');

        // Sílabo mínimo y borrador con la lección de la unidad 1.
        const upload = await request(app).post(`/api/cursos/${courseId}/silabo`).set(tAuth)
            .attach('file', Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'), { filename: 'silabo.pdf', contentType: 'application/pdf' });
        assert.equal(upload.status, 201, JSON.stringify(upload.body));
        await migrationPool.query(
            `INSERT INTO borrador_curso (id_silabo, id_curso, contenido, estado, modelo_ia) VALUES ($1, $2, $3::jsonb, 'generado', 'test');`,
            [upload.body.silabo.id_silabo, courseId, JSON.stringify(draftContent())]
        );

        // El docente edita y guarda: la lección se conserva; una lección inválida se rechaza.
        const draft = (await request(app).get(`/api/cursos/${courseId}/silabo/borrador`).set(tAuth).expect(200)).body.borrador;
        assert.equal(draft.contenido.unidades[0].leccion.tarjetas.length, 3);
        const broken = JSON.parse(JSON.stringify(draft.contenido));
        broken.unidades[0].leccion.tarjetas.length = 1;
        await request(app).put(`/api/cursos/${courseId}/silabo/borrador`).set(tAuth).send({ contenido: broken }).expect(400);
        await request(app).put(`/api/cursos/${courseId}/silabo/borrador`).set(tAuth).send({ contenido: draft.contenido }).expect(200);

        const published = await request(app).post(`/api/cursos/${courseId}/silabo/borrador/publicar`).set(tAuth);
        assert.equal(published.status, 200, JSON.stringify(published.body));

        const worlds = (await request(app).get(`/api/mundos/curso/${courseId}`).set(sAuth).expect(200)).body.data;
        const first = (await request(app).get(`/api/mundos/${worlds[0].id_mundo}`).set(sAuth).expect(200)).body.data;
        assert.equal(first.leccion.tarjetas.length, 3);
        assert.equal(first.leccion.comprobacion.opciones.length, 4);
        const second = (await request(app).get(`/api/mundos/${worlds[1].id_mundo}`).set(sAuth).expect(200)).body.data;
        assert.equal(second.leccion, null, 'los mundos sin lección no inventan una');

        // El ejercicio extra se publicó como ejercicio tipado (4.º del mundo 1) y su solución no llega al estudiante.
        const exercises = (await request(app).get(`/api/ejercicios/mundo/${worlds[0].id_mundo}`).set(sAuth).expect(200)).body.data;
        assert.equal(exercises.length, 4);
        const extra = exercises.find((item) => item.tipo === 'predecir');
        assert.ok(extra);
        const detail = (await request(app).get(`/api/ejercicios/${extra.id_ejercicio}`).set(sAuth).expect(200)).body.data;
        assert.equal(detail.material.codigo, 'print(2 + 3)');
        assert.equal('solucion' in detail, false);
    } finally {
        if (courseId) {
            await pool.query(`UPDATE matricula SET estado = 'retirada' WHERE id_curso = $1`, [courseId]).catch(() => {});
            await pool.query(`UPDATE curso SET estado = 'inactivo' WHERE id_curso = $1`, [courseId]).catch(() => {});
        }
        await pool.end().catch(() => {});
        await migrationPool.end().catch(() => {});
    }
});
