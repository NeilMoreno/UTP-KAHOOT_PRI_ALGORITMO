BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sala_pin_activa
    ON sala_multijugador (pin_sala)
    WHERE estado IN ('espera', 'en_curso');

CREATE INDEX IF NOT EXISTS idx_envio_estudiante_fecha
    ON envio_ejercicio (id_estudiante, fecha_envio DESC);
CREATE INDEX IF NOT EXISTS idx_respuesta_sala_puntaje
    ON respuesta_sala (id_sala, puntaje_obtenido DESC);
CREATE INDEX IF NOT EXISTS idx_uso_ia_docente_fecha
    ON uso_ia (id_docente, fecha_uso DESC);
CREATE INDEX IF NOT EXISTS idx_progreso_matricula_estado
    ON progreso_mundo (id_matricula, estado);
CREATE INDEX IF NOT EXISTS idx_xp_curso_estudiante
    ON xp_movimiento (id_curso, id_estudiante);

CREATE OR REPLACE FUNCTION validar_docente_curso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    docente usuario%ROWTYPE;
BEGIN
    SELECT * INTO docente FROM usuario WHERE id_usuario = NEW.id_docente;
    IF NOT FOUND OR docente.rol <> 'docente' OR docente.estado <> 'activo'
       OR docente.id_institucion IS DISTINCT FROM NEW.id_institucion THEN
        RAISE EXCEPTION 'El docente debe estar activo y pertenecer a la institución del curso.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_docente_curso ON curso;
CREATE TRIGGER trg_validar_docente_curso
    BEFORE INSERT OR UPDATE OF id_docente, id_institucion ON curso
    FOR EACH ROW EXECUTE FUNCTION validar_docente_curso();

CREATE OR REPLACE FUNCTION validar_estudiante_matricula()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    estudiante usuario%ROWTYPE;
    institucion_curso UUID;
BEGIN
    SELECT * INTO estudiante FROM usuario WHERE id_usuario = NEW.id_estudiante;
    SELECT id_institucion INTO institucion_curso FROM curso WHERE id_curso = NEW.id_curso;
    IF NOT FOUND OR estudiante.rol <> 'estudiante' OR estudiante.estado <> 'activo'
       OR estudiante.id_institucion IS DISTINCT FROM institucion_curso THEN
        RAISE EXCEPTION 'El estudiante debe estar activo y pertenecer a la institución del curso.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_estudiante_matricula ON matricula;
CREATE TRIGGER trg_validar_estudiante_matricula
    BEFORE INSERT OR UPDATE OF id_curso, id_estudiante ON matricula
    FOR EACH ROW EXECUTE FUNCTION validar_estudiante_matricula();

COMMIT;
