'use strict';

const bcrypt = require('bcryptjs');
const { migrationPool } = require('../backend/config/migrationDatabase');
const { normalizePersonName, isStrongPassword, normalizeGenero } = require('../backend/utils/validation');

const SUPERADMIN_EMAIL = 'admin@codeintcorp.com';

const run = async () => {
    if (process.env.ALLOW_SUPERADMIN_BOOTSTRAP !== '1') {
        throw new Error('Defina ALLOW_SUPERADMIN_BOOTSTRAP=1 únicamente durante el bootstrap.');
    }

    const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD;
    const nombre = normalizePersonName(process.env.BOOTSTRAP_SUPERADMIN_NAME || 'Super');
    const apellido = normalizePersonName(process.env.BOOTSTRAP_SUPERADMIN_LASTNAME || 'Admin');
    const genero = normalizeGenero(process.env.BOOTSTRAP_SUPERADMIN_GENDER || 'masculino');
    if (!isStrongPassword(password) || !nombre || !apellido || !genero) {
        throw new Error('Los datos de bootstrap no cumplen las reglas de identidad y contraseña.');
    }

    const rounds = Math.min(14, Math.max(10, Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10)));
    const passwordHash = await bcrypt.hash(password, rounds);
    const client = await migrationPool.connect();
    try {
        const existing = await client.query(`
            SELECT id_usuario FROM usuario WHERE rol = 'superadministrador' FOR UPDATE;
        `);
        let admin;
        if (existing.rowCount > 0) {
            const updated = await client.query(`
                UPDATE usuario
                   SET nombre = $1,
                       apellido = $2,
                       genero = $3,
                       password_hash = $4,
                       password_actualizada_en = now(),
                       token_version = token_version + 1
                 WHERE id_usuario = $5
                RETURNING id_usuario;
            `, [nombre, apellido, genero, passwordHash, existing.rows[0].id_usuario]);
            admin = updated.rows[0];
        } else {
            const inserted = await client.query(`
                INSERT INTO usuario (
                    nombre, apellido, email, password_hash, rol, genero, estado,
                    correo_verificado, correo_verificado_en, password_actualizada_en
                ) VALUES ($1, $2, $3, $4, 'superadministrador', $5, 'activo', true, now(), now())
                RETURNING id_usuario;
            `, [nombre, apellido, SUPERADMIN_EMAIL, passwordHash, genero]);
            admin = inserted.rows[0];
        }
        await client.query(`
            UPDATE institucion_dominio
               SET creado_por = $1
             WHERE creado_por IS NULL;
        `, [admin.id_usuario]);
        await client.query(`
            INSERT INTO auditoria_seguridad (
                id_actor, accion, tipo_objetivo, id_objetivo, resultado, metadatos
            ) VALUES ($1, 'SUPERADMIN_BOOTSTRAP', 'usuario', $1, 'exitoso',
                      jsonb_build_object('email', $2::text));
        `, [admin.id_usuario, SUPERADMIN_EMAIL]);
        await client.query('COMMIT');
        console.log(`Superadministrador fijo preparado: ${SUPERADMIN_EMAIL}. La contraseña no se muestra.`);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await migrationPool.end();
    }
};

run().catch(error => {
    console.error('No se pudo ejecutar el bootstrap del superadministrador:', error.message);
    process.exitCode = 1;
});
