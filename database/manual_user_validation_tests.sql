-- =============================================================================
-- codeInt - Pruebas manuales de validacion de usuario para pgAdmin
-- =============================================================================
-- Ejecutar el archivo completo desde Query Tool conectado a codeint_db.
--
-- La prueba:
--   1. Usa una institucion activa existente.
--   2. Intenta insertar casos validos e invalidos directamente en PostgreSQL.
--   3. Captura cada error sin detener los casos siguientes.
--   4. Elimina automaticamente todos los usuarios que consiguio insertar.
--   5. Devuelve una tabla comparando el comportamiento esperado del backend
--      con el resultado real de la base de datos.
--
-- IMPORTANTE: pgAdmin omite las validaciones de /api/auth/register. Que un
-- INSERT directo sea aceptado no significa que el endpoint tambien lo acepte.

DROP TABLE IF EXISTS pg_temp.prueba_usuario_resultados;

CREATE TEMP TABLE prueba_usuario_resultados (
    orden                    INTEGER     NOT NULL,
    caso                     TEXT        NOT NULL,
    descripcion              TEXT        NOT NULL,
    nombre_probado           TEXT,
    email_probado            TEXT,
    rol_probado              TEXT,
    genero_probado           TEXT,
    estado_probado           TEXT,
    esperado_backend         TEXT        NOT NULL,
    resultado_bd             TEXT        NOT NULL,
    sqlstate                 TEXT,
    restriccion              TEXT,
    detalle                  TEXT,
    id_usuario               UUID,
    eliminado_al_final       BOOLEAN     NOT NULL DEFAULT false
);

DO $pruebas$
DECLARE
    v_institucion UUID;
    v_id_usuario UUID;
    v_restriccion TEXT;
    v_eliminados INTEGER := 0;
    v_caso RECORD;
BEGIN
    SELECT id_institucion
      INTO v_institucion
      FROM institucion
     WHERE estado = 'activa'
     ORDER BY fecha_creacion
     LIMIT 1;

    IF v_institucion IS NULL THEN
        RAISE EXCEPTION
            'No existe una institucion activa. Cargue database/seeds.sql o cree una antes de probar.';
    END IF;

    FOR v_caso IN
        SELECT *
          FROM (VALUES
            (1,  'U01_VALIDO',
             'Usuario estudiante completamente valido.',
             'Maria', 'Prueba', 'qa.pgadmin.manual.valido@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'femenino', 'activo', false,
             'ACEPTAR'),

            (2,  'U02_NOMBRE_REAL_CON_SIGNOS',
             'Acentos, guion y apostrofe son normales en nombres reales.',
             'Maria-Jose', 'O''Connor', 'qa.pgadmin.manual.nombre-real@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'femenino', 'activo', false,
             'ACEPTAR'),

            (3,  'U03_NOMBRE_HTML',
             'Nombre con una etiqueta HTML; debe rechazarse por formato.',
             '<script>alert(1)</script>', 'Prueba', 'qa.pgadmin.manual.nombre-html@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR'),

            (4,  'U04_EMAIL_SIN_ARROBA',
             'Correo sin arroba.',
             'Correo', 'SinArroba', 'qa.pgadmin.manual.sin-arroba.example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR'),

            (5,  'U05_EMAIL_SIN_DOMINIO_PUBLICO',
             'Correo con arroba pero sin punto en el dominio.',
             'Correo', 'SinPunto', 'qa.pgadmin.manual@localhost',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR'),

            (6,  'U06_EMAIL_DUPLICADO_MAYUSCULAS_ESPACIOS',
             'Mismo correo que U01 con mayusculas y espacios.',
             'Duplicado', 'Prueba', '  QA.PGADMIN.MANUAL.VALIDO@EXAMPLE.TEST  ',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR_DUPLICADO'),

            (7,  'U07_GENERO_INVALIDO',
             'Genero fuera del catalogo permitido.',
             'Genero', 'Invalido', 'qa.pgadmin.manual.genero@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'robot', 'activo', false,
             'RECHAZAR'),

            (8,  'U08_ROL_INVALIDO',
             'Rol administrador no contemplado por el modelo.',
             'Rol', 'Invalido', 'qa.pgadmin.manual.rol@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'administrador', 'masculino', 'activo', false,
             'RECHAZAR'),

            (9,  'U09_SUPERADMIN_DIRECTO',
             'La BD admite superadministrador; el registro publico debe rechazarlo.',
             'Super', 'Directo', 'qa.pgadmin.manual.superadmin@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'superadministrador', 'masculino', 'activo', false,
             'RECHAZAR_EN_API_PUBLICA'),

            (10, 'U10_NOMBRE_VACIO',
             'Cadena vacia en nombre.',
             '', 'Vacio', 'qa.pgadmin.manual.nombre-vacio@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'femenino', 'activo', false,
             'RECHAZAR'),

            (11, 'U11_NOMBRE_UN_CARACTER',
             'El backend exige al menos dos caracteres.',
             'X', 'Corto', 'qa.pgadmin.manual.nombre-corto@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'femenino', 'activo', false,
             'RECHAZAR'),

            (12, 'U12_NOMBRE_MAYOR_100',
             'Nombre que supera VARCHAR(100).',
             repeat('A', 101), 'Largo', 'qa.pgadmin.manual.nombre-largo@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR'),

            (13, 'U13_ESTADO_INVALIDO',
             'Estado fuera del catalogo. La API no permite elegirlo.',
             'Estado', 'Invalido', 'qa.pgadmin.manual.estado@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'bloqueado', false,
             'IGNORAR_ENTRADA_Y_ASIGNAR_ESTADO'),

            (14, 'U14_TEXTO_PARECIDO_A_SQL',
             'El texto debe tratarse como dato, nunca ejecutarse como SQL.',
             'Robert''); DROP TABLE usuario;--', 'Seguro', 'qa.pgadmin.manual.texto-sql@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR'),

            (15, 'U15_EMAIL_NULL',
             'Email nulo contra NOT NULL.',
             'Correo', 'Nulo', NULL,
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR'),

            (16, 'U16_ESTUDIANTE_SIN_INSTITUCION',
             'Estudiante con id_institucion nulo.',
             'Sin', 'Institucion', 'qa.pgadmin.manual.sin-institucion@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'masculino', 'activo', true,
             'RECHAZAR_EN_API_POR_LICENCIA'),

            (17, 'U17_HASH_VACIO',
             'La BD almacena un hash, no la clave original; se prueba un hash vacio.',
             'Hash', 'Vacio', 'qa.pgadmin.manual.hash-vacio@example.test',
             '', 'estudiante', 'masculino', 'activo', false,
             'RECHAZAR_PASSWORD_EN_API'),

            (18, 'U18_GENERO_NO_BINARIO_ANTIGUO',
             'Valor anterior no_binario; ya no pertenece al catalogo permitido.',
             'Genero', 'Anterior', 'qa.pgadmin.manual.no-binario@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'no_binario', 'activo', false,
             'RECHAZAR'),

            (19, 'U19_GENERO_SIN_DECLARAR_ANTIGUO',
             'Valor anterior prefiero_no_decir; ya no pertenece al catalogo permitido.',
             'Genero', 'Anterior', 'qa.pgadmin.manual.sin-declarar@example.test',
             '$2b$10$zaNR1SD4WgMms5m0lr4TjOEBIUK7mXRJv1r01WE.TSZ7ID817.86W', 'estudiante', 'prefiero_no_decir', 'activo', false,
             'RECHAZAR')
          ) AS casos(
              orden, caso, descripcion, nombre, apellido, email, password_hash,
              rol, genero, estado, sin_institucion, esperado_backend
          )
         ORDER BY orden
    LOOP
        v_id_usuario := NULL;
        v_restriccion := NULL;

        BEGIN
            INSERT INTO usuario (
                id_institucion,
                nombre,
                apellido,
                email,
                password_hash,
                rol,
                genero,
                estado,
                correo_verificado
            ) VALUES (
                CASE WHEN v_caso.sin_institucion THEN NULL ELSE v_institucion END,
                v_caso.nombre,
                v_caso.apellido,
                v_caso.email,
                v_caso.password_hash,
                v_caso.rol,
                v_caso.genero,
                v_caso.estado,
                false
            )
            RETURNING id_usuario INTO v_id_usuario;

            INSERT INTO prueba_usuario_resultados (
                orden, caso, descripcion, nombre_probado, email_probado,
                rol_probado, genero_probado, estado_probado, esperado_backend,
                resultado_bd, detalle, id_usuario
            ) VALUES (
                v_caso.orden, v_caso.caso, v_caso.descripcion, v_caso.nombre,
                v_caso.email, v_caso.rol, v_caso.genero, v_caso.estado,
                v_caso.esperado_backend, 'ACEPTADO',
                'PostgreSQL creo temporalmente el usuario.', v_id_usuario
            );

            RAISE NOTICE '[%] ACEPTADO por PostgreSQL: %', v_caso.caso, v_caso.descripcion;
        EXCEPTION WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS v_restriccion = CONSTRAINT_NAME;

            INSERT INTO prueba_usuario_resultados (
                orden, caso, descripcion, nombre_probado, email_probado,
                rol_probado, genero_probado, estado_probado, esperado_backend,
                resultado_bd, sqlstate, restriccion, detalle
            ) VALUES (
                v_caso.orden, v_caso.caso, v_caso.descripcion, v_caso.nombre,
                v_caso.email, v_caso.rol, v_caso.genero, v_caso.estado,
                v_caso.esperado_backend, 'RECHAZADO', SQLSTATE,
                NULLIF(v_restriccion, ''), SQLERRM
            );

            RAISE NOTICE '[%] RECHAZADO por PostgreSQL [% / %]: %',
                v_caso.caso,
                SQLSTATE,
                COALESCE(NULLIF(v_restriccion, ''), 'sin restriccion nombrada'),
                SQLERRM;
        END;
    END LOOP;

    DELETE FROM usuario AS u
    USING prueba_usuario_resultados AS r
    WHERE r.resultado_bd = 'ACEPTADO'
      AND r.id_usuario = u.id_usuario;

    GET DIAGNOSTICS v_eliminados = ROW_COUNT;

    UPDATE prueba_usuario_resultados
       SET eliminado_al_final = true
     WHERE resultado_bd = 'ACEPTADO';

    RAISE NOTICE 'Limpieza terminada: % usuarios de prueba eliminados.', v_eliminados;
END
$pruebas$;

-- Resultado principal: revisar especialmente las diferencias entre
-- esperado_backend y resultado_bd.
SELECT
    orden,
    caso,
    descripcion,
    nombre_probado,
    email_probado,
    rol_probado,
    genero_probado,
    estado_probado,
    esperado_backend,
    resultado_bd,
    sqlstate,
    restriccion,
    detalle,
    eliminado_al_final
FROM prueba_usuario_resultados
ORDER BY orden;

-- Debe devolver 0. Comprueba que ningun usuario aceptado por la prueba quedo
-- almacenado despues de la limpieza.
SELECT count(*) AS usuarios_de_prueba_restantes
FROM usuario AS u
JOIN prueba_usuario_resultados AS r
  ON r.id_usuario = u.id_usuario;

