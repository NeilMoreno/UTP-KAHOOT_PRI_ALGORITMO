'use strict';

const { pool } = require('../backend/config/database');

const checks = [
    ['Usuarios con genero fuera del catalogo masculino/femenino', `
        SELECT count(*)::int AS total
        FROM usuario
        WHERE genero NOT IN ('femenino', 'masculino');
    `],
    ['Nombres o apellidos con formato invalido', `
        SELECT count(*)::int AS total
        FROM usuario
        WHERE nombre <> btrim(nombre)
           OR char_length(nombre) NOT BETWEEN 2 AND 100
           OR nombre !~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'
           OR apellido <> btrim(apellido)
           OR char_length(apellido) NOT BETWEEN 2 AND 100
           OR apellido !~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$';
    `],
    ['Correos con formato o normalizacion invalidos', `
        SELECT count(*)::int AS total
        FROM usuario
        WHERE email <> lower(btrim(email))
           OR char_length(email) NOT BETWEEN 3 AND 254
           OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
    `],
    ['Hashes de contrasena fuera del formato bcrypt permitido', `
        SELECT count(*)::int AS total
        FROM usuario
        WHERE password_hash !~ '^\\$2[aby]\\$(10|11|12|13|14)\\$[./A-Za-z0-9]{53}$';
    `],
    ['Usuarios no administradores sin institucion', `
        SELECT count(*)::int AS total
        FROM usuario
        WHERE rol <> 'superadministrador' AND id_institucion IS NULL;
    `],
    ['Correos duplicados sin distinguir mayúsculas', `
        SELECT count(*)::int AS total FROM (
            SELECT lower(btrim(email)) FROM usuario
            GROUP BY lower(btrim(email)) HAVING count(*) > 1
        ) duplicates;
    `],
    ['Docentes de curso fuera de institución o con rol incorrecto', `
        SELECT count(*)::int AS total
        FROM curso c JOIN usuario u ON u.id_usuario = c.id_docente
        WHERE u.rol <> 'docente' OR u.id_institucion IS DISTINCT FROM c.id_institucion;
    `],
    ['Estudiantes matriculados fuera de institución o con rol incorrecto', `
        SELECT count(*)::int AS total
        FROM matricula ma
        JOIN curso c ON c.id_curso = ma.id_curso
        JOIN usuario u ON u.id_usuario = ma.id_estudiante
        WHERE u.rol <> 'estudiante' OR u.id_institucion IS DISTINCT FROM c.id_institucion;
    `],
    ['Ejercicios asociados a un curso distinto al de su mundo', `
        SELECT count(*)::int AS total
        FROM ejercicio e JOIN mundo m ON m.id_mundo = e.id_mundo
        WHERE e.id_curso <> m.id_curso;
    `],
    ['Progresos con curso inconsistente', `
        SELECT count(*)::int AS total
        FROM progreso_mundo p
        JOIN matricula ma ON ma.id_matricula = p.id_matricula
        JOIN mundo m ON m.id_mundo = p.id_mundo
        WHERE p.id_curso <> ma.id_curso OR p.id_curso <> m.id_curso;
    `],
    ['Identidad única e inmutable del superadministrador', `
        SELECT CASE
            WHEN count(*) = 1 AND bool_and(
                email = 'admin@codeintcorp.com'
                AND estado = 'activo'
                AND correo_verificado = true
                AND id_institucion IS NULL
            ) THEN 0 ELSE 1
        END::int AS total
        FROM usuario
        WHERE rol = 'superadministrador';
    `],
    ['Usuarios con verificación de correo incoherente', `
        SELECT count(*)::int AS total
        FROM usuario
        WHERE correo_verificado IS DISTINCT FROM (correo_verificado_en IS NOT NULL);
    `],
    ['Usuarios fuera de un dominio activo de su institución', `
        SELECT count(*)::int AS total
        FROM usuario u
        WHERE u.rol IN ('docente', 'estudiante')
          AND NOT EXISTS (
              SELECT 1 FROM institucion_dominio d
              WHERE d.id_institucion = u.id_institucion
                AND d.dominio = split_part(u.email, '@', 2)
                AND d.estado = 'activo'
          );
    `],
    ['Dominios institucionales inválidos o con estado incoherente', `
        SELECT count(*)::int AS total
        FROM institucion_dominio
        WHERE dominio <> lower(btrim(dominio))
           OR dominio !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
           OR (estado = 'activo' AND verificado_en IS NULL);
    `],
    ['Invitaciones pendientes vencidas o sin dominio activo', `
        SELECT count(*)::int AS total
        FROM invitacion_usuario inv
        WHERE inv.estado = 'pendiente'
          AND (
              inv.expira_en <= now()
              OR NOT EXISTS (
                  SELECT 1 FROM institucion_dominio d
                  WHERE d.id_institucion = inv.id_institucion
                    AND d.dominio = split_part(inv.email, '@', 2)
                    AND d.estado = 'activo'
              )
          );
    `],
    ['Consumos de IA con docente, institución o referencia inconsistente', `
        SELECT count(*)::int AS total
        FROM uso_ia ui
        WHERE NOT EXISTS (
            SELECT 1 FROM usuario u
            WHERE u.id_usuario = ui.id_docente
              AND u.id_institucion = ui.id_institucion
              AND u.rol = 'docente'
        )
        OR (ui.tipo_operacion = 'evaluacion' AND NOT EXISTS (
            SELECT 1 FROM envio_ejercicio ee
            JOIN curso c ON c.id_curso = ee.id_curso
            WHERE ee.id_envio_ejercicio = ui.id_envio_ejercicio
              AND c.id_docente = ui.id_docente
              AND c.id_institucion = ui.id_institucion
        ))
        OR (ui.tipo_operacion = 'generacion_mundo' AND NOT EXISTS (
            SELECT 1 FROM silabo s
            JOIN curso c ON c.id_curso = s.id_curso
            WHERE s.id_silabo = ui.id_silabo
              AND c.id_docente = ui.id_docente
              AND c.id_institucion = ui.id_institucion
        ));
    `],
    ['Movimientos XP duplicados o con referencia inconsistente', `
        SELECT (
            (SELECT count(*) FROM (
                SELECT id_evaluacion FROM xp_movimiento
                WHERE id_evaluacion IS NOT NULL
                GROUP BY id_evaluacion HAVING count(*) > 1
            ) d1)
            +
            (SELECT count(*) FROM (
                SELECT id_participante_sala FROM xp_movimiento
                WHERE id_participante_sala IS NOT NULL
                GROUP BY id_participante_sala HAVING count(*) > 1
            ) d2)
            +
            (SELECT count(*) FROM xp_movimiento x
             WHERE (x.origen = 'evaluacion_ia' AND NOT EXISTS (
                 SELECT 1 FROM evaluacion_ia e
                 WHERE e.id_evaluacion = x.id_evaluacion
                   AND e.id_estudiante = x.id_estudiante
                   AND e.id_curso = x.id_curso
             )) OR (x.origen = 'participante_sala' AND NOT EXISTS (
                 SELECT 1 FROM participante_sala p
                 WHERE p.id_participante = x.id_participante_sala
                   AND p.id_estudiante = x.id_estudiante
                   AND p.id_curso = x.id_curso
             )))
        )::int AS total;
    `],
    ['Envíos con estado de evaluación o idempotencia incoherente', `
        SELECT count(*)::int AS total
        FROM envio_ejercicio ee
        WHERE (NOT ee.sintaxis_valida AND ee.estado_evaluacion <> 'rechazado_local')
           OR (ee.sintaxis_valida AND ee.estado_evaluacion = 'rechazado_local')
           OR (ee.estado_evaluacion = 'completado' AND NOT EXISTS (
               SELECT 1 FROM evaluacion_ia ev
               WHERE ev.id_envio_ejercicio = ee.id_envio_ejercicio
           ))
           OR (ee.estado_evaluacion = 'rechazado_local' AND EXISTS (
               SELECT 1 FROM uso_ia ui
               WHERE ui.id_envio_ejercicio = ee.id_envio_ejercicio
           ));
    `],
    ['Evaluaciones IA con respuesta estructurada inválida', `
        SELECT count(*)::int AS total
        FROM evaluacion_ia
        WHERE categoria_error IS NOT NULL
              AND categoria_error NOT IN ('ninguno', 'sintaxis', 'logica', 'condicion_borde', 'eficiencia', 'formato', 'otro')
           OR jsonb_typeof(sugerencias) IS DISTINCT FROM 'array'
           OR jsonb_array_length(sugerencias) > 5
           OR length(btrim(retroalimentacion)) NOT BETWEEN 10 AND 4000
           OR length(btrim(eficiencia_algoritmica)) NOT BETWEEN 1 AND 1000
           OR length(codigo_sugerido_mejora) > 12000;
    `],
    ['Evaluaciones confirmadas sin trazabilidad del proveedor', `
        SELECT count(*)::int AS total
        FROM uso_ia
        WHERE tipo_operacion = 'evaluacion'
          AND estado_consumo = 'confirmado'
          AND (proveedor_ia IS DISTINCT FROM 'gemini' OR modelo_ia IS NULL);
    `],
    ['XP de evaluación repetido o asociado a otro ejercicio', `
        SELECT (
            (SELECT count(*) FROM (
                SELECT id_estudiante, id_curso, id_ejercicio
                FROM xp_movimiento
                WHERE origen = 'evaluacion_ia'
                GROUP BY id_estudiante, id_curso, id_ejercicio
                HAVING count(*) > 1
            ) duplicated)
            +
            (SELECT count(*) FROM xp_movimiento xm
             JOIN evaluacion_ia ev ON ev.id_evaluacion = xm.id_evaluacion
             JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
             WHERE xm.origen = 'evaluacion_ia'
               AND xm.id_ejercicio IS DISTINCT FROM ee.id_ejercicio)
        )::int AS total;
    `],
    ['La conexión de runtime conserva privilegios administrativos PostgreSQL', `
        SELECT count(*)::int AS total
        FROM pg_roles
        WHERE rolname = current_user
          AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication);
    `]
];

const run = async () => {
    let findings = 0;
    for (const [name, sql] of checks) {
        const result = await pool.query(sql);
        const total = result.rows[0].total;
        findings += total;
        console.log(`${total === 0 ? 'OK' : 'ALERTA'} | ${name}: ${total}`);
    }
    await pool.end();
    if (findings > 0) process.exitCode = 1;
};

run().catch(async error => {
    console.error('Error de auditoría:', error.message);
    await pool.end().catch(() => {});
    process.exitCode = 1;
});
