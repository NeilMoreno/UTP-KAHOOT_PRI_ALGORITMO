BEGIN;

ALTER TABLE uso_ia
    DROP CONSTRAINT IF EXISTS ck_uso_ia_tokens,
    DROP CONSTRAINT IF EXISTS ck_uso_ia_referencias,
    DROP CONSTRAINT IF EXISTS ck_uso_ia_transicion;

ALTER TABLE uso_ia
    ADD CONSTRAINT ck_uso_ia_tokens CHECK (
        tokens_reservados >= 0
        AND (tokens_consumidos IS NULL OR (
            tokens_consumidos >= 0
            AND tokens_consumidos <= tokens_reservados
        ))
    ),
    ADD CONSTRAINT ck_uso_ia_referencias CHECK (
        (tipo_operacion = 'evaluacion' AND id_envio_ejercicio IS NOT NULL AND id_silabo IS NULL)
        OR
        (tipo_operacion = 'generacion_mundo' AND id_silabo IS NOT NULL AND id_envio_ejercicio IS NULL)
    ),
    ADD CONSTRAINT ck_uso_ia_transicion CHECK (
        (estado_consumo = 'reservado' AND resultado_operacion = 'pendiente' AND tokens_consumidos IS NULL)
        OR
        (estado_consumo = 'confirmado' AND resultado_operacion = 'exitoso' AND tokens_consumidos IS NOT NULL)
        OR
        (estado_consumo = 'fallido' AND resultado_operacion = 'fallido')
    );

ALTER TABLE xp_movimiento
    DROP CONSTRAINT IF EXISTS ck_xp_referencia_origen;

ALTER TABLE xp_movimiento
    ADD CONSTRAINT ck_xp_referencia_origen CHECK (
        (origen = 'evaluacion_ia' AND id_evaluacion IS NOT NULL AND id_participante_sala IS NULL)
        OR
        (origen = 'participante_sala' AND id_participante_sala IS NOT NULL AND id_evaluacion IS NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_por_evaluacion
    ON xp_movimiento (id_evaluacion)
    WHERE id_evaluacion IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_por_participante_sala
    ON xp_movimiento (id_participante_sala)
    WHERE id_participante_sala IS NOT NULL;

CREATE OR REPLACE FUNCTION validar_asignacion_tokens_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuario
         WHERE id_usuario = NEW.id_docente_beneficiario
           AND rol = 'docente'
           AND estado = 'activo'
    ) THEN
        RAISE EXCEPTION 'El beneficiario de tokens debe ser un docente activo.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM usuario
         WHERE id_usuario = NEW.id_superadmin_asignador
           AND rol = 'superadministrador'
           AND estado = 'activo'
    ) THEN
        RAISE EXCEPTION 'La cuota debe ser asignada por el superadministrador activo.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_asignacion_tokens_roles ON asignacion_tokens;
CREATE TRIGGER trg_validar_asignacion_tokens_roles
    BEFORE INSERT OR UPDATE ON asignacion_tokens
    FOR EACH ROW EXECUTE FUNCTION validar_asignacion_tokens_roles();

CREATE OR REPLACE FUNCTION validar_envio_ejercicio_integridad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM matricula ma
          JOIN ejercicio e ON e.id_ejercicio = NEW.id_ejercicio
         WHERE ma.id_matricula = NEW.id_matricula
           AND ma.id_estudiante = NEW.id_estudiante
           AND ma.id_curso = NEW.id_curso
           AND e.id_curso = NEW.id_curso
    ) THEN
        RAISE EXCEPTION 'El envio no coincide con su matricula, estudiante, ejercicio y curso.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_envio_ejercicio_integridad ON envio_ejercicio;
CREATE TRIGGER trg_validar_envio_ejercicio_integridad
    BEFORE INSERT OR UPDATE OF id_matricula, id_estudiante, id_ejercicio, id_curso
    ON envio_ejercicio
    FOR EACH ROW EXECUTE FUNCTION validar_envio_ejercicio_integridad();

CREATE OR REPLACE FUNCTION validar_evaluacion_ia_integridad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM envio_ejercicio ee
         WHERE ee.id_envio_ejercicio = NEW.id_envio_ejercicio
           AND ee.id_estudiante = NEW.id_estudiante
           AND ee.id_curso = NEW.id_curso
    ) THEN
        RAISE EXCEPTION 'La evaluacion no coincide con el envio, estudiante y curso.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_evaluacion_ia_integridad ON evaluacion_ia;
CREATE TRIGGER trg_validar_evaluacion_ia_integridad
    BEFORE INSERT OR UPDATE OF id_envio_ejercicio, id_estudiante, id_curso
    ON evaluacion_ia
    FOR EACH ROW EXECUTE FUNCTION validar_evaluacion_ia_integridad();

CREATE OR REPLACE FUNCTION validar_uso_ia_integridad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuario
         WHERE id_usuario = NEW.id_docente
           AND id_institucion = NEW.id_institucion
           AND rol = 'docente'
           AND estado = 'activo'
    ) THEN
        RAISE EXCEPTION 'El consumo de IA debe pertenecer a un docente activo de la institucion.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.tipo_operacion = 'evaluacion' AND NOT EXISTS (
        SELECT 1
          FROM envio_ejercicio ee
          JOIN curso c ON c.id_curso = ee.id_curso
         WHERE ee.id_envio_ejercicio = NEW.id_envio_ejercicio
           AND c.id_docente = NEW.id_docente
           AND c.id_institucion = NEW.id_institucion
    ) THEN
        RAISE EXCEPTION 'El envio evaluado no pertenece al docente y la institucion indicados.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.tipo_operacion = 'generacion_mundo' AND NOT EXISTS (
        SELECT 1
          FROM silabo s
          JOIN curso c ON c.id_curso = s.id_curso
         WHERE s.id_silabo = NEW.id_silabo
           AND c.id_docente = NEW.id_docente
           AND c.id_institucion = NEW.id_institucion
    ) THEN
        RAISE EXCEPTION 'El silabo no pertenece al docente y la institucion indicados.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_uso_ia_integridad ON uso_ia;
CREATE TRIGGER trg_validar_uso_ia_integridad
    BEFORE INSERT OR UPDATE OF id_docente, id_institucion, id_envio_ejercicio, id_silabo, tipo_operacion
    ON uso_ia
    FOR EACH ROW EXECUTE FUNCTION validar_uso_ia_integridad();

CREATE OR REPLACE FUNCTION validar_xp_integridad()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.origen = 'evaluacion_ia' AND NOT EXISTS (
        SELECT 1 FROM evaluacion_ia e
         WHERE e.id_evaluacion = NEW.id_evaluacion
           AND e.id_estudiante = NEW.id_estudiante
           AND e.id_curso = NEW.id_curso
    ) THEN
        RAISE EXCEPTION 'El XP no coincide con la evaluacion, estudiante y curso.'
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

DROP TRIGGER IF EXISTS trg_validar_xp_integridad ON xp_movimiento;
CREATE TRIGGER trg_validar_xp_integridad
    BEFORE INSERT OR UPDATE ON xp_movimiento
    FOR EACH ROW EXECUTE FUNCTION validar_xp_integridad();

CREATE OR REPLACE FUNCTION reservar_uso_ia(
    p_id_docente UUID,
    p_id_operacion UUID,
    p_tipo_operacion VARCHAR,
    p_tokens_reservados BIGINT,
    p_id_envio_ejercicio UUID DEFAULT NULL,
    p_id_silabo UUID DEFAULT NULL
)
RETURNS uso_ia
LANGUAGE plpgsql
AS $$
DECLARE
    v_asignacion asignacion_tokens%ROWTYPE;
    v_usuario usuario%ROWTYPE;
    v_institucion_nombre VARCHAR(150);
    v_comprometidos BIGINT;
    v_resultado uso_ia%ROWTYPE;
BEGIN
    IF p_tokens_reservados <= 0 THEN
        RAISE EXCEPTION 'La reserva de tokens debe ser mayor que cero.'
            USING ERRCODE = '23514';
    END IF;

    SELECT * INTO v_resultado
      FROM uso_ia
     WHERE id_operacion = p_id_operacion;

    IF FOUND THEN
        IF v_resultado.id_docente <> p_id_docente
           OR v_resultado.tipo_operacion <> p_tipo_operacion
           OR v_resultado.tokens_reservados <> p_tokens_reservados
           OR v_resultado.id_envio_ejercicio IS DISTINCT FROM p_id_envio_ejercicio
           OR v_resultado.id_silabo IS DISTINCT FROM p_id_silabo THEN
            RAISE EXCEPTION 'El id de operacion ya fue usado con datos diferentes.'
                USING ERRCODE = '23505';
        END IF;
        RETURN v_resultado;
    END IF;

    SELECT * INTO v_usuario
      FROM usuario
     WHERE id_usuario = p_id_docente
       AND rol = 'docente'
       AND estado = 'activo';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe un docente activo para reservar la cuota.'
            USING ERRCODE = '23514';
    END IF;

    SELECT a.* INTO v_asignacion
      FROM asignacion_tokens a
     WHERE a.id_docente_beneficiario = p_id_docente
       AND now() >= a.fecha_inicio
       AND now() < a.fecha_fin
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El docente no tiene una asignacion de tokens vigente.'
            USING ERRCODE = '23514';
    END IF;

    SELECT COALESCE(sum(
        CASE
            WHEN estado_consumo = 'reservado' THEN tokens_reservados
            WHEN estado_consumo = 'confirmado' THEN tokens_consumidos
            ELSE 0
        END
    ), 0)
      INTO v_comprometidos
      FROM uso_ia
     WHERE id_docente = p_id_docente
       AND fecha_uso >= v_asignacion.fecha_inicio
       AND fecha_uso < v_asignacion.fecha_fin
       AND estado_consumo IN ('reservado', 'confirmado');

    IF v_comprometidos + p_tokens_reservados > v_asignacion.limite_tokens THEN
        RAISE EXCEPTION 'La operacion excede la cuota de tokens disponible.'
            USING ERRCODE = '23514';
    END IF;

    SELECT nombre INTO v_institucion_nombre
      FROM institucion
     WHERE id_institucion = v_usuario.id_institucion;

    INSERT INTO uso_ia (
        id_operacion,
        id_docente,
        id_institucion,
        id_envio_ejercicio,
        id_silabo,
        tipo_operacion,
        tokens_reservados,
        estado_consumo,
        resultado_operacion,
        docente_snapshot,
        institucion_snapshot
    ) VALUES (
        p_id_operacion,
        p_id_docente,
        v_usuario.id_institucion,
        p_id_envio_ejercicio,
        p_id_silabo,
        p_tipo_operacion,
        p_tokens_reservados,
        'reservado',
        'pendiente',
        concat_ws(' ', v_usuario.nombre, v_usuario.apellido),
        v_institucion_nombre
    )
    RETURNING * INTO v_resultado;

    RETURN v_resultado;
END;
$$;

CREATE OR REPLACE FUNCTION confirmar_uso_ia(
    p_id_operacion UUID,
    p_tokens_consumidos BIGINT,
    p_exitoso BOOLEAN
)
RETURNS uso_ia
LANGUAGE plpgsql
AS $$
DECLARE
    v_resultado uso_ia%ROWTYPE;
BEGIN
    SELECT * INTO v_resultado
      FROM uso_ia
     WHERE id_operacion = p_id_operacion
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la reserva de IA indicada.'
            USING ERRCODE = '23503';
    END IF;

    IF v_resultado.estado_consumo <> 'reservado' THEN
        IF p_exitoso
           AND v_resultado.estado_consumo = 'confirmado'
           AND v_resultado.tokens_consumidos = p_tokens_consumidos THEN
            RETURN v_resultado;
        END IF;
        IF NOT p_exitoso AND v_resultado.estado_consumo = 'fallido' THEN
            RETURN v_resultado;
        END IF;
        RAISE EXCEPTION 'La reserva de IA ya fue finalizada con otro resultado.'
            USING ERRCODE = '23514';
    END IF;

    IF p_exitoso AND (
        p_tokens_consumidos IS NULL
        OR p_tokens_consumidos < 0
        OR p_tokens_consumidos > v_resultado.tokens_reservados
    ) THEN
        RAISE EXCEPTION 'El consumo confirmado no puede superar la reserva.'
            USING ERRCODE = '23514';
    END IF;

    UPDATE uso_ia
       SET tokens_consumidos = CASE WHEN p_exitoso THEN p_tokens_consumidos ELSE NULL END,
           estado_consumo = CASE WHEN p_exitoso THEN 'confirmado' ELSE 'fallido' END,
           resultado_operacion = CASE WHEN p_exitoso THEN 'exitoso' ELSE 'fallido' END
     WHERE id_operacion = p_id_operacion
     RETURNING * INTO v_resultado;

    RETURN v_resultado;
END;
$$;

COMMIT;
