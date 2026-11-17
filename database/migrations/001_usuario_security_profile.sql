BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM usuario
        GROUP BY lower(btrim(email))
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'No se puede crear la unicidad case-insensitive: existen correos duplicados.';
    END IF;
END $$;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS genero VARCHAR(25) NOT NULL DEFAULT 'prefiero_no_decir',
    ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_usuario_genero'
          AND conrelid = 'usuario'::regclass
    ) THEN
        ALTER TABLE usuario
            ADD CONSTRAINT ck_usuario_genero
            CHECK (genero IN ('femenino', 'masculino', 'no_binario', 'prefiero_no_decir'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email_lower
    ON usuario (lower(btrim(email)));

COMMIT;
