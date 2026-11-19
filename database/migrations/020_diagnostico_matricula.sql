BEGIN;

-- Diagnostico de entrada (opcional): los primeros N mundos que el estudiante domina quedan convalidados
-- (desbloquean el siguiente sin repetir ejercicios). Se corrige en el servidor con el banco de preguntas.
ALTER TABLE matricula
    ADD COLUMN mundos_convalidados INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN diagnostico_aciertos INTEGER,
    ADD COLUMN diagnostico_total INTEGER,
    ADD COLUMN diagnostico_en TIMESTAMPTZ;

ALTER TABLE matricula
    ADD CONSTRAINT ck_matricula_convalidados CHECK (mundos_convalidados >= 0 AND mundos_convalidados <= 50);

COMMIT;
