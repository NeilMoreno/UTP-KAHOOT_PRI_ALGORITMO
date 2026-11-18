'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');

const enabled = process.env.RUN_DB_TESTS === '1';

// Mantiene como máximo 10 llamadas a rutas de autenticación (límite del servidor por ventana de 15 min).
test('registro con términos, fecha de nacimiento y tutor; completar la fecha después; estadísticas del superadmin', { skip: !enabled }, async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    process.env.ALLOW_DEV_INVITATION_TOKEN_RESPONSE = 'true';
    const request = require('supertest');
    const { app } = require('../backend/server');
    const { pool } = require('../backend/config/database');
    const { migrationPool } = require('../backend/config/migrationDatabase');

    const suffix = randomUUID().slice(0, 8);
    const studentEmail = `t.${suffix}.alumno@utp.edu.pe`;
    const teacherEmail = `t.${suffix}.docente@utp.edu.pe`;
    const password = 'Zorro-Veloz-2026!';

    try {
        // 1) Superadministrador e invitaciones (login 1, invitaciones 2 y 3)
        const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@codeintcorp.com', password: 'codeint123' });
        assert.equal(adminLogin.status, 200);
        const adminAuth = { Authorization: `Bearer ${adminLogin.body.token}` };
        const institutions = await request(app).get('/api/auth/admin/instituciones').set(adminAuth).expect(200);
        const idInstitucion = institutions.body.data[0].id_institucion;

        const invite = async (email, rol) => {
            const response = await request(app).post('/api/auth/admin/invitations').set(adminAuth)
                .send({ id_institucion: idInstitucion, email, rol, expira_en_horas: 24 });
            assert.equal(response.status, 201, JSON.stringify(response.body));
            return new URL(response.body.dev_invitation_url.replace('/#/', '/')).searchParams.get('token');
        };
        const studentToken = await invite(studentEmail, 'estudiante');
        const teacherToken = await invite(teacherEmail, 'docente');

        const register = (token, extra) => request(app).post('/api/auth/register').send({
            invitation_token: token, nombre: 'Prueba', apellido: 'Perfil', genero: 'femenino', password, ...extra
        });

        // 2) Rechazos del servidor (registros 4, 5 y 6): no consumen la invitación
        const noTerms = await register(studentToken, { fecha_nacimiento: '2012-05-05', consentimiento_tutor: true });
        assert.equal(noTerms.status, 400);
        assert.equal(noTerms.body.error, 'TERMS_REQUIRED');

        const noDate = await register(studentToken, { acepta_terminos: true });
        assert.equal(noDate.body.error, 'BIRTH_DATE_REQUIRED');

        const minorWithoutGuardian = await register(studentToken, { acepta_terminos: true, fecha_nacimiento: '2012-05-05' });
        assert.equal(minorWithoutGuardian.body.error, 'GUARDIAN_CONSENT_REQUIRED');

        // 3) Estudiante menor con tutor (registro 7)
        const student = await register(studentToken, { acepta_terminos: true, fecha_nacimiento: '2012-05-05', consentimiento_tutor: true });
        assert.equal(student.status, 201, JSON.stringify(student.body));
        assert.equal(student.body.user.fecha_nacimiento, '2012-05-05');
        assert.ok(student.body.user.terminos_aceptados_en);

        const stored = await migrationPool.query(
            `SELECT to_char(fecha_nacimiento, 'YYYY-MM-DD') AS nacimiento, terminos_version,
                    terminos_aceptados_en IS NOT NULL AS acepto, consentimiento_tutor_en IS NOT NULL AS tutor
               FROM usuario WHERE email = $1;`, [studentEmail]
        );
        assert.deepEqual(stored.rows[0], { nacimiento: '2012-05-05', terminos_version: '2026-11', acepto: true, tutor: true });

        // 4) Docente sin fecha de nacimiento (registro 8): es opcional para docentes
        const teacher = await register(teacherToken, { acepta_terminos: true });
        assert.equal(teacher.status, 201, JSON.stringify(teacher.body));
        assert.equal(teacher.body.user.fecha_nacimiento, null);
        const teacherAuth = { Authorization: `Bearer ${teacher.body.token}` };

        // 5) Login del estudiante (login 9): entrega edad y estado de términos; /me coincide
        const studentLogin = await request(app).post('/api/auth/login').send({ email: studentEmail, password });
        assert.equal(studentLogin.status, 200);
        assert.equal(studentLogin.body.user.terminos_vigentes, true);
        assert.ok(studentLogin.body.user.edad >= 13 && studentLogin.body.user.edad <= 15, `edad ${studentLogin.body.user.edad}`);
        const me = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${studentLogin.body.token}` }).expect(200);
        assert.equal(me.body.user.fecha_nacimiento, '2012-05-05');

        // 6) La fecha ya registrada no se puede cambiar desde el perfil
        const change = await request(app).patch('/api/auth/me/nacimiento').set({ Authorization: `Bearer ${studentLogin.body.token}` }).send({ fecha_nacimiento: '2000-01-01' });
        assert.equal(change.status, 409);
        assert.equal(change.body.error, 'BIRTH_DATE_ALREADY_SET');

        // 7) El docente (sin fecha) la completa una sola vez, con las mismas reglas
        const tooYoung = await request(app).patch('/api/auth/me/nacimiento').set(teacherAuth).send({ fecha_nacimiento: '2020-01-01' });
        assert.equal(tooYoung.body.error, 'UNDER_MIN_AGE');
        const complete = await request(app).patch('/api/auth/me/nacimiento').set(teacherAuth).send({ fecha_nacimiento: '1985-03-10' });
        assert.equal(complete.status, 200);
        assert.equal(complete.body.fecha_nacimiento, '1985-03-10');
        assert.ok(complete.body.edad >= 40);
        await request(app).patch('/api/auth/me/nacimiento').set(teacherAuth).send({ fecha_nacimiento: '1990-01-01' }).expect(409);

        // 8) Aceptar términos vigentes exige confirmación explícita
        await request(app).post('/api/auth/me/terminos').set(teacherAuth).send({}).expect(400);
        const accepted = await request(app).post('/api/auth/me/terminos').set(teacherAuth).send({ acepta_terminos: true }).expect(200);
        assert.equal(accepted.body.terminos_vigentes, true);

        // 9) Estadísticas: solo superadministrador, solo agregados
        await request(app).get('/api/analiticas/demografia').set(teacherAuth).expect(403);
        const stats = await request(app).get(`/api/analiticas/demografia?id_institucion=${idInstitucion}`).set(adminAuth).expect(200);
        assert.ok(Array.isArray(stats.body.rangos) && stats.body.rangos.length === 7);
        assert.equal(stats.body.grupo_minimo, 5);
        assert.doesNotMatch(JSON.stringify(stats.body), /@|id_usuario|fecha_nacimiento/);
        await request(app).get('/api/analiticas/demografia?id_institucion=no-es-uuid').set(adminAuth).expect(400);
    } finally {
        await pool.end();
        await migrationPool.end();
    }
});
