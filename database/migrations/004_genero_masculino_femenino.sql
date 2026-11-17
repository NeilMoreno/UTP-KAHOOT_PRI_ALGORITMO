BEGIN;

LOCK TABLE usuario IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    legacy_count INTEGER;
BEGIN
    SELECT count(*)::int
      INTO legacy_count
      FROM usuario
     WHERE genero NOT IN ('femenino', 'masculino');

    IF legacy_count NOT IN (0, 7) THEN
        RAISE EXCEPTION
            'Se esperaban 0 o 7 usuarios con genero heredado, pero se encontraron %.',
            legacy_count;
    END IF;

    IF legacy_count = 7 THEN
        WITH randomized AS (
            SELECT
                id_usuario,
                row_number() OVER (ORDER BY random(), id_usuario) AS position
            FROM usuario
            WHERE genero NOT IN ('femenino', 'masculino')
        )
        UPDATE usuario AS u
           SET genero = CASE
               WHEN randomized.position <= 3 THEN 'femenino'
               ELSE 'masculino'
           END
          FROM randomized
         WHERE u.id_usuario = randomized.id_usuario;
    END IF;
END $$;

ALTER TABLE usuario
    ALTER COLUMN genero DROP DEFAULT,
    DROP CONSTRAINT IF EXISTS ck_usuario_genero;

ALTER TABLE usuario
    ADD CONSTRAINT ck_usuario_genero
    CHECK (genero IN ('femenino', 'masculino'));

COMMIT;
