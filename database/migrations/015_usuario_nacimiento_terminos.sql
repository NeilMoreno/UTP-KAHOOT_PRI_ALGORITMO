BEGIN;

-- Datos de perfil para estadísticas de edad y consentimiento. Se guarda la FECHA de nacimiento (la edad cambia
-- cada año). Es nullable porque las cuentas anteriores no la tienen; el registro nuevo la exige a estudiantes.
ALTER TABLE usuario
    ADD COLUMN fecha_nacimiento          DATE,
    ADD COLUMN terminos_aceptados_en     TIMESTAMPTZ,
    ADD COLUMN terminos_version          VARCHAR(20),
    ADD COLUMN consentimiento_tutor_en   TIMESTAMPTZ;

ALTER TABLE usuario
    ADD CONSTRAINT ck_usuario_nacimiento CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento >= DATE '1900-01-01'),
    ADD CONSTRAINT ck_usuario_terminos CHECK ((terminos_aceptados_en IS NULL) = (terminos_version IS NULL));

COMMIT;
