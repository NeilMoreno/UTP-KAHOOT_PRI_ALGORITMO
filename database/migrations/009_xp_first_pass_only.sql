BEGIN;

ALTER TABLE xp_movimiento
    ADD COLUMN id_ejercicio UUID;

UPDATE xp_movimiento xm
   SET id_ejercicio = ee.id_ejercicio
  FROM evaluacion_ia ev
  JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
 WHERE xm.id_evaluacion = ev.id_evaluacion
   AND xm.origen = 'evaluacion_ia';

ALTER TABLE xp_movimiento
    ADD CONSTRAINT fk_xp_ejercicio
        FOREIGN KEY (id_ejercicio) REFERENCES ejercicio(id_ejercicio)
        ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE xp_movimiento
    DROP CONSTRAINT ck_xp_referencia_origen;

ALTER TABLE xp_movimiento
    ADD CONSTRAINT ck_xp_referencia_origen CHECK (
        (
            origen = 'evaluacion_ia'
            AND id_evaluacion IS NOT NULL
            AND id_ejercicio IS NOT NULL
            AND id_participante_sala IS NULL
        )
        OR
        (
            origen = 'participante_sala'
            AND id_participante_sala IS NOT NULL
            AND id_evaluacion IS NULL
            AND id_ejercicio IS NULL
        )
    );

CREATE UNIQUE INDEX uq_xp_primer_aprobado_ejercicio
    ON xp_movimiento (id_estudiante, id_curso, id_ejercicio)
    WHERE origen = 'evaluacion_ia';

CREATE OR REPLACE FUNCTION validar_xp_integridad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.origen = 'evaluacion_ia' AND NOT EXISTS (
        SELECT 1
          FROM evaluacion_ia ev
          JOIN envio_ejercicio ee ON ee.id_envio_ejercicio = ev.id_envio_ejercicio
         WHERE ev.id_evaluacion = NEW.id_evaluacion
           AND ev.id_estudiante = NEW.id_estudiante
           AND ev.id_curso = NEW.id_curso
           AND ee.id_ejercicio = NEW.id_ejercicio
    ) THEN
        RAISE EXCEPTION 'El XP no coincide con la evaluacion, estudiante, curso y ejercicio.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.origen = 'participante_sala' AND NOT EXISTS (
        SELECT 1 FROM participante_sala p
         WHERE p.id_participante = NEW.id_participante_sala
           AND p.id_estudiante = NEW.id_estudiante
           AND p.id_curso = NEW.id_curso
    ) THEN
        RAISE EXCEPTION 'El XP no coincide con el participante, estudiante y curso.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;
