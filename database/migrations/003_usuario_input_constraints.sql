BEGIN;

LOCK TABLE usuario IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    invalid_names INTEGER;
    invalid_surnames INTEGER;
    invalid_emails INTEGER;
    invalid_hashes INTEGER;
    invalid_institutions INTEGER;
BEGIN
    SELECT count(*) INTO invalid_names
    FROM usuario
    WHERE nombre <> btrim(nombre)
       OR char_length(nombre) NOT BETWEEN 2 AND 100
       OR nombre !~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$';

    SELECT count(*) INTO invalid_surnames
    FROM usuario
    WHERE apellido <> btrim(apellido)
       OR char_length(apellido) NOT BETWEEN 2 AND 100
       OR apellido !~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$';

    SELECT count(*) INTO invalid_emails
    FROM usuario
    WHERE email <> lower(btrim(email))
       OR char_length(email) NOT BETWEEN 3 AND 254
       OR email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';

    SELECT count(*) INTO invalid_hashes
    FROM usuario
    WHERE password_hash !~ '^\$2[aby]\$(10|11|12|13|14)\$[./A-Za-z0-9]{53}$';

    SELECT count(*) INTO invalid_institutions
    FROM usuario
    WHERE rol <> 'superadministrador' AND id_institucion IS NULL;

    IF invalid_names + invalid_surnames + invalid_emails + invalid_hashes + invalid_institutions > 0 THEN
        RAISE EXCEPTION
            'No se pueden activar las restricciones de usuario. Invalidos: nombres %, apellidos %, emails %, hashes %, instituciones %.',
            invalid_names, invalid_surnames, invalid_emails, invalid_hashes, invalid_institutions;
    END IF;
END $$;

ALTER TABLE usuario
    DROP CONSTRAINT IF EXISTS ck_usuario_nombre_formato,
    DROP CONSTRAINT IF EXISTS ck_usuario_apellido_formato,
    DROP CONSTRAINT IF EXISTS ck_usuario_email_formato,
    DROP CONSTRAINT IF EXISTS ck_usuario_password_hash_formato,
    DROP CONSTRAINT IF EXISTS ck_usuario_institucion_requerida;

ALTER TABLE usuario
    ADD CONSTRAINT ck_usuario_nombre_formato CHECK (
        nombre = btrim(nombre)
        AND char_length(nombre) BETWEEN 2 AND 100
        AND nombre ~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'
    ),
    ADD CONSTRAINT ck_usuario_apellido_formato CHECK (
        apellido = btrim(apellido)
        AND char_length(apellido) BETWEEN 2 AND 100
        AND apellido ~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'
    ),
    ADD CONSTRAINT ck_usuario_email_formato CHECK (
        email = lower(btrim(email))
        AND char_length(email) BETWEEN 3 AND 254
        AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
    ADD CONSTRAINT ck_usuario_password_hash_formato CHECK (
        password_hash ~ '^\$2[aby]\$(10|11|12|13|14)\$[./A-Za-z0-9]{53}$'
    ),
    ADD CONSTRAINT ck_usuario_institucion_requerida CHECK (
        rol = 'superadministrador' OR id_institucion IS NOT NULL
    );

COMMIT;