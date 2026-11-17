-- ==============================================================
-- codeInt - Esquema canónico completo | 25 tablas de dominio + schema_migration
-- PostgreSQL 18 | Estado posterior a migraciones 001-009
-- Generado desde la base validada; no contiene datos ni credenciales.
-- ==============================================================

--
-- PostgreSQL database dump
--

\restrict zqKd7rsBsBWPfMVyzLGQgeRlbjlJwkVFgdGAL642crhrIUWTBgujQNJECSwsHhy

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: uso_ia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uso_ia (
    id_uso_ia uuid DEFAULT gen_random_uuid() NOT NULL,
    id_operacion uuid NOT NULL,
    id_docente uuid NOT NULL,
    id_institucion uuid NOT NULL,
    id_envio_ejercicio uuid,
    id_silabo uuid,
    tipo_operacion character varying(30) NOT NULL,
    tokens_reservados bigint DEFAULT 0 NOT NULL,
    tokens_consumidos bigint,
    estado_consumo character varying(20) DEFAULT 'reservado'::character varying NOT NULL,
    resultado_operacion character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    docente_snapshot character varying(200),
    institucion_snapshot character varying(200),
    fecha_uso timestamp with time zone DEFAULT now() NOT NULL,
    proveedor_ia character varying(30),
    modelo_ia character varying(100),
    CONSTRAINT ck_uso_ia_estado CHECK (((estado_consumo)::text = ANY ((ARRAY['reservado'::character varying, 'confirmado'::character varying, 'fallido'::character varying])::text[]))),
    CONSTRAINT ck_uso_ia_proveedor CHECK (((proveedor_ia IS NULL) OR ((proveedor_ia)::text = 'gemini'::text))),
    CONSTRAINT ck_uso_ia_referencias CHECK (((((tipo_operacion)::text = 'evaluacion'::text) AND (id_envio_ejercicio IS NOT NULL) AND (id_silabo IS NULL)) OR (((tipo_operacion)::text = 'generacion_mundo'::text) AND (id_silabo IS NOT NULL) AND (id_envio_ejercicio IS NULL)))),
    CONSTRAINT ck_uso_ia_resultado CHECK (((resultado_operacion)::text = ANY ((ARRAY['pendiente'::character varying, 'exitoso'::character varying, 'fallido'::character varying])::text[]))),
    CONSTRAINT ck_uso_ia_tipo CHECK (((tipo_operacion)::text = ANY ((ARRAY['evaluacion'::character varying, 'generacion_mundo'::character varying])::text[]))),
    CONSTRAINT ck_uso_ia_tokens CHECK (((tokens_reservados >= 0) AND ((tokens_consumidos IS NULL) OR ((tokens_consumidos >= 0) AND (tokens_consumidos <= tokens_reservados))))),
    CONSTRAINT ck_uso_ia_transicion CHECK (((((estado_consumo)::text = 'reservado'::text) AND ((resultado_operacion)::text = 'pendiente'::text) AND (tokens_consumidos IS NULL)) OR (((estado_consumo)::text = 'confirmado'::text) AND ((resultado_operacion)::text = 'exitoso'::text) AND (tokens_consumidos IS NOT NULL)) OR (((estado_consumo)::text = 'fallido'::text) AND ((resultado_operacion)::text = 'fallido'::text))))
);


--
-- Name: confirmar_uso_ia(uuid, bigint, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirmar_uso_ia(p_id_operacion uuid, p_tokens_consumidos bigint, p_exitoso boolean) RETURNS public.uso_ia
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


--
-- Name: proteger_identidad_superadministrador(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proteger_identidad_superadministrador() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.rol = 'superadministrador' THEN
            RAISE EXCEPTION 'El superadministrador fijo no puede eliminarse.'
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.rol = 'superadministrador' THEN
        IF NEW.email <> 'admin@codeintcorp.com'
           OR NEW.id_institucion IS NOT NULL
           OR NEW.estado <> 'activo'
           OR NEW.correo_verificado IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'La identidad del superadministrador no cumple la politica fija.'
                USING ERRCODE = '23514';
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.rol <> 'superadministrador' THEN
            RAISE EXCEPTION 'No se permite promover usuarios a superadministrador.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.rol = 'superadministrador' AND (
        NEW.rol IS DISTINCT FROM OLD.rol
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.id_institucion IS DISTINCT FROM OLD.id_institucion
        OR NEW.estado IS DISTINCT FROM OLD.estado
        OR NEW.correo_verificado IS DISTINCT FROM OLD.correo_verificado
    ) THEN
        RAISE EXCEPTION 'El correo, rol, institucion y estado del superadministrador son inmutables.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: reservar_uso_ia(uuid, uuid, character varying, bigint, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reservar_uso_ia(p_id_docente uuid, p_id_operacion uuid, p_tipo_operacion character varying, p_tokens_reservados bigint, p_id_envio_ejercicio uuid DEFAULT NULL::uuid, p_id_silabo uuid DEFAULT NULL::uuid) RETURNS public.uso_ia
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


--
-- Name: validar_asignacion_tokens_roles(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_asignacion_tokens_roles() RETURNS trigger
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


--
-- Name: validar_docente_curso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_docente_curso() RETURNS trigger
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


--
-- Name: validar_dominio_institucional(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_dominio_institucional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.creado_por IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM usuario
         WHERE id_usuario = NEW.creado_por
           AND rol = 'superadministrador'
           AND estado = 'activo'
    ) THEN
        RAISE EXCEPTION 'El dominio institucional debe ser creado por el superadministrador.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: validar_envio_ejercicio_integridad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_envio_ejercicio_integridad() RETURNS trigger
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


--
-- Name: validar_estudiante_matricula(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_estudiante_matricula() RETURNS trigger
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


--
-- Name: validar_evaluacion_ia_integridad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_evaluacion_ia_integridad() RETURNS trigger
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


--
-- Name: validar_invitacion_usuario(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_invitacion_usuario() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    email_domain TEXT;
BEGIN
    IF TG_OP = 'UPDATE' AND (
        NEW.id_institucion IS DISTINCT FROM OLD.id_institucion
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.rol IS DISTINCT FROM OLD.rol
        OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
        OR NEW.creada_por IS DISTINCT FROM OLD.creada_por
        OR NEW.fecha_creacion IS DISTINCT FROM OLD.fecha_creacion
    ) THEN
        RAISE EXCEPTION 'Los datos de identidad de una invitacion son inmutables.'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM usuario
             WHERE id_usuario = NEW.creada_por
               AND rol = 'superadministrador'
               AND estado = 'activo'
        ) THEN
            RAISE EXCEPTION 'La invitacion debe ser creada por el superadministrador.'
                USING ERRCODE = '23514';
        END IF;

        IF EXISTS (SELECT 1 FROM usuario WHERE lower(email) = lower(NEW.email)) THEN
            RAISE EXCEPTION 'Ya existe una cuenta para el correo invitado.'
                USING ERRCODE = '23505';
        END IF;

        email_domain := split_part(lower(NEW.email), '@', 2);
        IF NOT EXISTS (
            SELECT 1
              FROM institucion_dominio
             WHERE id_institucion = NEW.id_institucion
               AND dominio = email_domain
               AND estado = 'activo'
        ) THEN
            RAISE EXCEPTION 'El correo no pertenece a un dominio activo de la institucion.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: validar_uso_ia_integridad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_uso_ia_integridad() RETURNS trigger
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


--
-- Name: validar_usuario_dominio_institucional(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_usuario_dominio_institucional() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.rol = 'superadministrador' THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM institucion_dominio d
         WHERE d.id_institucion = NEW.id_institucion
           AND d.dominio = split_part(NEW.email, '@', 2)
           AND d.estado = 'activo'
    ) THEN
        RAISE EXCEPTION
            'El correo del usuario no pertenece a un dominio activo de su institucion.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: validar_xp_integridad(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validar_xp_integridad() RETURNS trigger
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


--
-- Name: asignacion_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asignacion_tokens (
    id_asignacion_tokens uuid DEFAULT gen_random_uuid() NOT NULL,
    id_docente_beneficiario uuid NOT NULL,
    id_superadmin_asignador uuid NOT NULL,
    limite_tokens bigint NOT NULL,
    fecha_inicio timestamp with time zone NOT NULL,
    fecha_fin timestamp with time zone NOT NULL,
    CONSTRAINT ck_asigntok_fechas CHECK ((fecha_fin > fecha_inicio)),
    CONSTRAINT ck_asigntok_limite CHECK ((limite_tokens >= 0))
);


--
-- Name: auditoria_seguridad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditoria_seguridad (
    id_auditoria_seguridad uuid DEFAULT gen_random_uuid() NOT NULL,
    id_actor uuid,
    id_institucion uuid,
    accion character varying(80) NOT NULL,
    tipo_objetivo character varying(50),
    id_objetivo uuid,
    resultado character varying(20) NOT NULL,
    direccion_ip inet,
    metadatos jsonb DEFAULT '{}'::jsonb NOT NULL,
    fecha_evento timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_auditoria_accion CHECK ((((accion)::text = upper(btrim((accion)::text))) AND ((char_length((accion)::text) >= 3) AND (char_length((accion)::text) <= 80)))),
    CONSTRAINT ck_auditoria_metadatos_objeto CHECK ((jsonb_typeof(metadatos) = 'object'::text)),
    CONSTRAINT ck_auditoria_resultado CHECK (((resultado)::text = ANY ((ARRAY['exitoso'::character varying, 'rechazado'::character varying, 'fallido'::character varying])::text[])))
);


--
-- Name: curso; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.curso (
    id_curso uuid DEFAULT gen_random_uuid() NOT NULL,
    id_institucion uuid NOT NULL,
    id_docente uuid NOT NULL,
    nombre character varying(200) NOT NULL,
    codigo_curso character varying(50) NOT NULL,
    periodo character varying(30) NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_curso_estado CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'inactivo'::character varying])::text[])))
);


--
-- Name: ejercicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ejercicio (
    id_ejercicio uuid DEFAULT gen_random_uuid() NOT NULL,
    id_mundo uuid NOT NULL,
    id_curso uuid NOT NULL,
    titulo character varying(200) NOT NULL,
    enunciado text NOT NULL,
    plantilla_pseint text,
    orden smallint NOT NULL,
    xp_recompensa integer DEFAULT 50 NOT NULL,
    CONSTRAINT ck_ejercicio_orden CHECK ((orden > 0)),
    CONSTRAINT ck_ejercicio_xp CHECK ((xp_recompensa >= 0))
);


--
-- Name: envio_ejercicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.envio_ejercicio (
    id_envio_ejercicio uuid DEFAULT gen_random_uuid() NOT NULL,
    id_matricula uuid NOT NULL,
    id_estudiante uuid NOT NULL,
    id_ejercicio uuid NOT NULL,
    id_curso uuid NOT NULL,
    codigo_pseint text NOT NULL,
    sintaxis_valida boolean DEFAULT false NOT NULL,
    mensaje_sintaxis text,
    fecha_envio timestamp with time zone DEFAULT now() NOT NULL,
    id_operacion uuid DEFAULT gen_random_uuid() NOT NULL,
    estado_evaluacion character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    CONSTRAINT ck_envio_codigo_longitud CHECK (((length(btrim(codigo_pseint)) >= 1) AND (length(btrim(codigo_pseint)) <= 12000))),
    CONSTRAINT ck_envio_estado_evaluacion CHECK (((estado_evaluacion)::text = ANY ((ARRAY['rechazado_local'::character varying, 'pendiente'::character varying, 'procesando'::character varying, 'completado'::character varying, 'fallido'::character varying])::text[]))),
    CONSTRAINT ck_envio_estado_sintaxis CHECK ((((NOT sintaxis_valida) AND ((estado_evaluacion)::text = 'rechazado_local'::text)) OR (sintaxis_valida AND ((estado_evaluacion)::text = ANY ((ARRAY['pendiente'::character varying, 'procesando'::character varying, 'completado'::character varying, 'fallido'::character varying])::text[]))))),
    CONSTRAINT ck_envio_mensaje_longitud CHECK (((mensaje_sintaxis IS NULL) OR (length(mensaje_sintaxis) <= 8000)))
);


--
-- Name: estudiante_logro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estudiante_logro (
    id_estudiante_logro uuid DEFAULT gen_random_uuid() NOT NULL,
    id_estudiante uuid NOT NULL,
    id_logro uuid NOT NULL,
    fecha_obtencion timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evaluacion_ia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluacion_ia (
    id_evaluacion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_envio_ejercicio uuid NOT NULL,
    id_estudiante uuid NOT NULL,
    id_curso uuid NOT NULL,
    puntaje smallint NOT NULL,
    retroalimentacion text NOT NULL,
    categoria_error character varying(50),
    fecha_evaluacion timestamp with time zone DEFAULT now() NOT NULL,
    sugerencias jsonb DEFAULT '[]'::jsonb NOT NULL,
    eficiencia_algoritmica text DEFAULT 'No registrada.'::text NOT NULL,
    codigo_sugerido_mejora text DEFAULT ''::text NOT NULL,
    modelo_ia character varying(100) DEFAULT 'legacy'::character varying NOT NULL,
    id_respuesta_proveedor character varying(255),
    CONSTRAINT ck_evaluacion_categoria CHECK (((categoria_error IS NULL) OR ((categoria_error)::text = ANY ((ARRAY['ninguno'::character varying, 'sintaxis'::character varying, 'logica'::character varying, 'condicion_borde'::character varying, 'eficiencia'::character varying, 'formato'::character varying, 'otro'::character varying])::text[])))),
    CONSTRAINT ck_evaluacion_codigo_sugerido_longitud CHECK ((length(codigo_sugerido_mejora) <= 12000)),
    CONSTRAINT ck_evaluacion_eficiencia_longitud CHECK (((length(btrim(eficiencia_algoritmica)) >= 1) AND (length(btrim(eficiencia_algoritmica)) <= 1000))),
    CONSTRAINT ck_evaluacion_puntaje CHECK (((puntaje >= 0) AND (puntaje <= 100))),
    CONSTRAINT ck_evaluacion_retroalimentacion_longitud CHECK (((length(btrim(retroalimentacion)) >= 10) AND (length(btrim(retroalimentacion)) <= 4000))),
    CONSTRAINT ck_evaluacion_sugerencias CHECK (((jsonb_typeof(sugerencias) = 'array'::text) AND (jsonb_array_length(sugerencias) <= 5)))
);


--
-- Name: institucion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institucion (
    id_institucion uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(150) NOT NULL,
    codigo_licencia character varying(80) NOT NULL,
    estado character varying(20) DEFAULT 'activa'::character varying NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_institucion_estado CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'inactiva'::character varying])::text[])))
);


--
-- Name: institucion_dominio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institucion_dominio (
    id_institucion_dominio uuid DEFAULT gen_random_uuid() NOT NULL,
    id_institucion uuid NOT NULL,
    dominio character varying(253) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    verificado_en timestamp with time zone,
    creado_por uuid,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_instdom_dominio CHECK ((((dominio)::text = lower(btrim((dominio)::text))) AND ((char_length((dominio)::text) >= 3) AND (char_length((dominio)::text) <= 253)) AND ((dominio)::text ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'::text))),
    CONSTRAINT ck_instdom_estado CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'activo'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT ck_instdom_verificacion CHECK (((((estado)::text = 'activo'::text) AND (verificado_en IS NOT NULL)) OR ((estado)::text <> 'activo'::text)))
);


--
-- Name: invitacion_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitacion_usuario (
    id_invitacion_usuario uuid DEFAULT gen_random_uuid() NOT NULL,
    id_institucion uuid NOT NULL,
    email character varying(254) NOT NULL,
    rol character varying(25) NOT NULL,
    token_hash character(64) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    usada_en timestamp with time zone,
    creada_por uuid NOT NULL,
    usada_por uuid,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_invitacion_email CHECK ((((email)::text = lower(btrim((email)::text))) AND ((char_length((email)::text) >= 3) AND (char_length((email)::text) <= 254)) AND ((email)::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))),
    CONSTRAINT ck_invitacion_estado CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'usada'::character varying, 'revocada'::character varying, 'vencida'::character varying])::text[]))),
    CONSTRAINT ck_invitacion_expiracion CHECK ((expira_en > fecha_creacion)),
    CONSTRAINT ck_invitacion_rol CHECK (((rol)::text = ANY ((ARRAY['estudiante'::character varying, 'docente'::character varying])::text[]))),
    CONSTRAINT ck_invitacion_token_hash CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT ck_invitacion_uso CHECK (((((estado)::text = 'usada'::text) AND (usada_en IS NOT NULL) AND (usada_por IS NOT NULL)) OR (((estado)::text <> 'usada'::text) AND (usada_en IS NULL) AND (usada_por IS NULL))))
);


--
-- Name: logro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logro (
    id_logro uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(120) NOT NULL,
    descripcion text NOT NULL,
    tipo character varying(20) NOT NULL,
    tipo_condicion character varying(50) NOT NULL,
    valor_umbral integer NOT NULL,
    CONSTRAINT ck_logro_condicion CHECK (((tipo_condicion)::text = ANY ((ARRAY['xp_acumulado'::character varying, 'mundos_completados'::character varying, 'partidas_participadas'::character varying, 'ejercicios_aprobados'::character varying])::text[]))),
    CONSTRAINT ck_logro_tipo CHECK (((tipo)::text = ANY ((ARRAY['logro'::character varying, 'insignia'::character varying])::text[]))),
    CONSTRAINT ck_logro_umbral CHECK ((valor_umbral > 0))
);


--
-- Name: matricula; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matricula (
    id_matricula uuid DEFAULT gen_random_uuid() NOT NULL,
    id_curso uuid NOT NULL,
    id_estudiante uuid NOT NULL,
    fecha_matricula timestamp with time zone DEFAULT now() NOT NULL,
    estado character varying(20) DEFAULT 'activa'::character varying NOT NULL,
    CONSTRAINT ck_matricula_estado CHECK (((estado)::text = ANY ((ARRAY['activa'::character varying, 'retirada'::character varying])::text[])))
);


--
-- Name: mundo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mundo (
    id_mundo uuid DEFAULT gen_random_uuid() NOT NULL,
    id_curso uuid NOT NULL,
    id_silabo uuid,
    orden smallint NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    tipo_origen character varying(20) DEFAULT 'base'::character varying NOT NULL,
    CONSTRAINT ck_mundo_orden CHECK ((orden > 0)),
    CONSTRAINT ck_mundo_origen CHECK (((tipo_origen)::text = ANY ((ARRAY['base'::character varying, 'personalizado'::character varying])::text[])))
);


--
-- Name: nivel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nivel (
    id_nivel uuid DEFAULT gen_random_uuid() NOT NULL,
    numero smallint NOT NULL,
    nombre character varying(80) NOT NULL,
    xp_requerido integer NOT NULL,
    CONSTRAINT ck_nivel_numero CHECK ((numero > 0)),
    CONSTRAINT ck_nivel_xp CHECK ((xp_requerido >= 0))
);


--
-- Name: opcion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opcion (
    id_opcion uuid DEFAULT gen_random_uuid() NOT NULL,
    id_pregunta uuid NOT NULL,
    etiqueta character varying(10) NOT NULL,
    texto text NOT NULL,
    es_correcta boolean DEFAULT false NOT NULL
);


--
-- Name: participante_sala; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.participante_sala (
    id_participante uuid DEFAULT gen_random_uuid() NOT NULL,
    id_sala uuid NOT NULL,
    id_matricula uuid NOT NULL,
    id_estudiante uuid NOT NULL,
    id_curso uuid NOT NULL,
    fecha_ingreso timestamp with time zone DEFAULT now() NOT NULL,
    puntaje_final integer DEFAULT 0 NOT NULL,
    posicion_final smallint,
    CONSTRAINT ck_participante_puntaje CHECK ((puntaje_final >= 0))
);


--
-- Name: pregunta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pregunta (
    id_pregunta uuid DEFAULT gen_random_uuid() NOT NULL,
    id_sala uuid NOT NULL,
    orden smallint NOT NULL,
    enunciado text NOT NULL,
    tiempo_limite_seg smallint DEFAULT 30 NOT NULL,
    puntos_base integer DEFAULT 1000 NOT NULL,
    CONSTRAINT ck_pregunta_orden CHECK ((orden > 0)),
    CONSTRAINT ck_pregunta_puntos CHECK ((puntos_base >= 0)),
    CONSTRAINT ck_pregunta_tiempo CHECK ((tiempo_limite_seg > 0))
);


--
-- Name: progreso_mundo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progreso_mundo (
    id_progreso_mundo uuid DEFAULT gen_random_uuid() NOT NULL,
    id_matricula uuid NOT NULL,
    id_mundo uuid NOT NULL,
    id_curso uuid NOT NULL,
    estado character varying(20) DEFAULT 'bloqueado'::character varying NOT NULL,
    fecha_inicio timestamp with time zone,
    fecha_completado timestamp with time zone,
    CONSTRAINT ck_progreso_estado CHECK (((estado)::text = ANY ((ARRAY['bloqueado'::character varying, 'en_progreso'::character varying, 'completado'::character varying])::text[])))
);


--
-- Name: respuesta_sala; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.respuesta_sala (
    id_respuesta_sala uuid DEFAULT gen_random_uuid() NOT NULL,
    id_participante uuid NOT NULL,
    id_pregunta uuid NOT NULL,
    id_opcion uuid NOT NULL,
    id_sala uuid NOT NULL,
    tiempo_respuesta integer NOT NULL,
    puntaje_obtenido integer DEFAULT 0 NOT NULL,
    CONSTRAINT ck_respuesta_puntaje CHECK ((puntaje_obtenido >= 0)),
    CONSTRAINT ck_respuesta_tiempo CHECK ((tiempo_respuesta >= 0))
);


--
-- Name: sala_multijugador; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sala_multijugador (
    id_sala uuid DEFAULT gen_random_uuid() NOT NULL,
    id_curso uuid NOT NULL,
    pin_sala character(6) NOT NULL,
    estado character varying(20) DEFAULT 'espera'::character varying NOT NULL,
    id_pregunta_activa uuid,
    fecha_apertura_pregunta timestamp with time zone,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    fecha_inicio timestamp with time zone,
    fecha_fin timestamp with time zone,
    CONSTRAINT ck_sala_estado CHECK (((estado)::text = ANY ((ARRAY['espera'::character varying, 'en_curso'::character varying, 'finalizada'::character varying, 'cancelada'::character varying])::text[]))),
    CONSTRAINT ck_sala_pin CHECK ((pin_sala ~ '^\d{6}$'::text))
);


--
-- Name: schema_migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migration (
    nombre character varying(255) NOT NULL,
    aplicado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: silabo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.silabo (
    id_silabo uuid DEFAULT gen_random_uuid() NOT NULL,
    id_curso uuid NOT NULL,
    nombre_archivo character varying(255) NOT NULL,
    ruta_archivo text NOT NULL,
    fecha_carga timestamp with time zone DEFAULT now() NOT NULL,
    estado_procesamiento character varying(20) DEFAULT 'cargado'::character varying NOT NULL,
    CONSTRAINT ck_silabo_estado CHECK (((estado_procesamiento)::text = ANY ((ARRAY['cargado'::character varying, 'procesando'::character varying, 'procesado'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: token_cuenta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_cuenta (
    id_token_cuenta uuid DEFAULT gen_random_uuid() NOT NULL,
    id_usuario uuid NOT NULL,
    tipo character varying(40) NOT NULL,
    token_hash character(64) NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    usado_en timestamp with time zone,
    revocado_en timestamp with time zone,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_token_cuenta_estado CHECK ((NOT ((usado_en IS NOT NULL) AND (revocado_en IS NOT NULL)))),
    CONSTRAINT ck_token_cuenta_expiracion CHECK ((expira_en > fecha_creacion)),
    CONSTRAINT ck_token_cuenta_hash CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT ck_token_cuenta_tipo CHECK (((tipo)::text = 'restablecer_password'::text))
);


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    id_usuario uuid DEFAULT gen_random_uuid() NOT NULL,
    id_institucion uuid,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    email character varying(254) NOT NULL,
    password_hash text NOT NULL,
    rol character varying(25) NOT NULL,
    estado character varying(25) DEFAULT 'pendiente'::character varying NOT NULL,
    correo_verificado boolean DEFAULT false NOT NULL,
    fecha_creacion timestamp with time zone DEFAULT now() NOT NULL,
    genero character varying(25) NOT NULL,
    ultimo_acceso timestamp with time zone,
    token_version integer DEFAULT 0 NOT NULL,
    correo_verificado_en timestamp with time zone,
    password_actualizada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_usuario_apellido_formato CHECK ((((apellido)::text = btrim((apellido)::text)) AND ((char_length((apellido)::text) >= 2) AND (char_length((apellido)::text) <= 100)) AND ((apellido)::text ~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'::text))),
    CONSTRAINT ck_usuario_email_formato CHECK ((((email)::text = lower(btrim((email)::text))) AND ((char_length((email)::text) >= 3) AND (char_length((email)::text) <= 254)) AND ((email)::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))),
    CONSTRAINT ck_usuario_estado CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'activo'::character varying, 'inactivo'::character varying])::text[]))),
    CONSTRAINT ck_usuario_genero CHECK (((genero)::text = ANY ((ARRAY['femenino'::character varying, 'masculino'::character varying])::text[]))),
    CONSTRAINT ck_usuario_institucion_requerida CHECK (((((rol)::text = 'superadministrador'::text) AND (id_institucion IS NULL)) OR (((rol)::text <> 'superadministrador'::text) AND (id_institucion IS NOT NULL)))),
    CONSTRAINT ck_usuario_nombre_formato CHECK ((((nombre)::text = btrim((nombre)::text)) AND ((char_length((nombre)::text) >= 2) AND (char_length((nombre)::text) <= 100)) AND ((nombre)::text ~ '^[[:alpha:]][[:alpha:] .''-]*[[:alpha:]]$'::text))),
    CONSTRAINT ck_usuario_password_hash_formato CHECK ((password_hash ~ '^\$2[aby]\$(10|11|12|13|14)\$[./A-Za-z0-9]{53}$'::text)),
    CONSTRAINT ck_usuario_rol CHECK (((rol)::text = ANY ((ARRAY['estudiante'::character varying, 'docente'::character varying, 'superadministrador'::character varying])::text[]))),
    CONSTRAINT ck_usuario_superadmin_fijo CHECK ((((rol)::text <> 'superadministrador'::text) OR (((email)::text = 'admin@codeintcorp.com'::text) AND ((estado)::text = 'activo'::text) AND (correo_verificado = true)))),
    CONSTRAINT ck_usuario_token_version CHECK ((token_version >= 0)),
    CONSTRAINT ck_usuario_verificacion_fecha CHECK ((((correo_verificado = true) AND (correo_verificado_en IS NOT NULL)) OR ((correo_verificado = false) AND (correo_verificado_en IS NULL))))
);


--
-- Name: xp_movimiento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_movimiento (
    id_xp_movimiento uuid DEFAULT gen_random_uuid() NOT NULL,
    id_estudiante uuid NOT NULL,
    id_curso uuid NOT NULL,
    id_evaluacion uuid,
    id_participante_sala uuid,
    cantidad integer NOT NULL,
    origen character varying(30) NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    id_ejercicio uuid,
    CONSTRAINT ck_xp_cantidad CHECK ((cantidad > 0)),
    CONSTRAINT ck_xp_origen CHECK (((origen)::text = ANY ((ARRAY['evaluacion_ia'::character varying, 'participante_sala'::character varying])::text[]))),
    CONSTRAINT ck_xp_referencia_origen CHECK (((((origen)::text = 'evaluacion_ia'::text) AND (id_evaluacion IS NOT NULL) AND (id_ejercicio IS NOT NULL) AND (id_participante_sala IS NULL)) OR (((origen)::text = 'participante_sala'::text) AND (id_participante_sala IS NOT NULL) AND (id_evaluacion IS NULL) AND (id_ejercicio IS NULL))))
);


--
-- Name: asignacion_tokens asignacion_tokens_id_docente_beneficiario_tstzrange_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_tokens
    ADD CONSTRAINT asignacion_tokens_id_docente_beneficiario_tstzrange_excl EXCLUDE USING gist (id_docente_beneficiario WITH =, tstzrange(fecha_inicio, fecha_fin, '[)'::text) WITH &&);


--
-- Name: asignacion_tokens pk_asignacion_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_tokens
    ADD CONSTRAINT pk_asignacion_tokens PRIMARY KEY (id_asignacion_tokens);


--
-- Name: auditoria_seguridad pk_auditoria_seguridad; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_seguridad
    ADD CONSTRAINT pk_auditoria_seguridad PRIMARY KEY (id_auditoria_seguridad);


--
-- Name: curso pk_curso; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT pk_curso PRIMARY KEY (id_curso);


--
-- Name: ejercicio pk_ejercicio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicio
    ADD CONSTRAINT pk_ejercicio PRIMARY KEY (id_ejercicio);


--
-- Name: envio_ejercicio pk_envio_ejercicio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_ejercicio
    ADD CONSTRAINT pk_envio_ejercicio PRIMARY KEY (id_envio_ejercicio);


--
-- Name: estudiante_logro pk_estudiante_logro; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante_logro
    ADD CONSTRAINT pk_estudiante_logro PRIMARY KEY (id_estudiante_logro);


--
-- Name: evaluacion_ia pk_evaluacion_ia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_ia
    ADD CONSTRAINT pk_evaluacion_ia PRIMARY KEY (id_evaluacion);


--
-- Name: institucion pk_institucion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT pk_institucion PRIMARY KEY (id_institucion);


--
-- Name: institucion_dominio pk_institucion_dominio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion_dominio
    ADD CONSTRAINT pk_institucion_dominio PRIMARY KEY (id_institucion_dominio);


--
-- Name: invitacion_usuario pk_invitacion_usuario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitacion_usuario
    ADD CONSTRAINT pk_invitacion_usuario PRIMARY KEY (id_invitacion_usuario);


--
-- Name: logro pk_logro; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logro
    ADD CONSTRAINT pk_logro PRIMARY KEY (id_logro);


--
-- Name: matricula pk_matricula; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT pk_matricula PRIMARY KEY (id_matricula);


--
-- Name: mundo pk_mundo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mundo
    ADD CONSTRAINT pk_mundo PRIMARY KEY (id_mundo);


--
-- Name: nivel pk_nivel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT pk_nivel PRIMARY KEY (id_nivel);


--
-- Name: opcion pk_opcion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcion
    ADD CONSTRAINT pk_opcion PRIMARY KEY (id_opcion);


--
-- Name: participante_sala pk_participante_sala; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participante_sala
    ADD CONSTRAINT pk_participante_sala PRIMARY KEY (id_participante);


--
-- Name: pregunta pk_pregunta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pregunta
    ADD CONSTRAINT pk_pregunta PRIMARY KEY (id_pregunta);


--
-- Name: progreso_mundo pk_progreso_mundo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_mundo
    ADD CONSTRAINT pk_progreso_mundo PRIMARY KEY (id_progreso_mundo);


--
-- Name: respuesta_sala pk_respuesta_sala; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuesta_sala
    ADD CONSTRAINT pk_respuesta_sala PRIMARY KEY (id_respuesta_sala);


--
-- Name: sala_multijugador pk_sala; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_multijugador
    ADD CONSTRAINT pk_sala PRIMARY KEY (id_sala);


--
-- Name: silabo pk_silabo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.silabo
    ADD CONSTRAINT pk_silabo PRIMARY KEY (id_silabo);


--
-- Name: token_cuenta pk_token_cuenta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_cuenta
    ADD CONSTRAINT pk_token_cuenta PRIMARY KEY (id_token_cuenta);


--
-- Name: uso_ia pk_uso_ia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uso_ia
    ADD CONSTRAINT pk_uso_ia PRIMARY KEY (id_uso_ia);


--
-- Name: usuario pk_usuario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT pk_usuario PRIMARY KEY (id_usuario);


--
-- Name: xp_movimiento pk_xp_movimiento; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_movimiento
    ADD CONSTRAINT pk_xp_movimiento PRIMARY KEY (id_xp_movimiento);


--
-- Name: schema_migration schema_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migration
    ADD CONSTRAINT schema_migration_pkey PRIMARY KEY (nombre);


--
-- Name: curso uq_curso_codigo_periodo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT uq_curso_codigo_periodo UNIQUE (id_institucion, codigo_curso, periodo);


--
-- Name: ejercicio uq_ejercicio_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicio
    ADD CONSTRAINT uq_ejercicio_orden UNIQUE (id_mundo, orden);


--
-- Name: envio_ejercicio uq_envio_id_operacion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_ejercicio
    ADD CONSTRAINT uq_envio_id_operacion UNIQUE (id_operacion);


--
-- Name: estudiante_logro uq_estudiante_logro; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante_logro
    ADD CONSTRAINT uq_estudiante_logro UNIQUE (id_estudiante, id_logro);


--
-- Name: evaluacion_ia uq_evaluacion_envio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_ia
    ADD CONSTRAINT uq_evaluacion_envio UNIQUE (id_envio_ejercicio);


--
-- Name: institucion_dominio uq_institucion_dominio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion_dominio
    ADD CONSTRAINT uq_institucion_dominio UNIQUE (dominio);


--
-- Name: institucion uq_institucion_licencia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT uq_institucion_licencia UNIQUE (codigo_licencia);


--
-- Name: institucion uq_institucion_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion
    ADD CONSTRAINT uq_institucion_nombre UNIQUE (nombre);


--
-- Name: invitacion_usuario uq_invitacion_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitacion_usuario
    ADD CONSTRAINT uq_invitacion_token_hash UNIQUE (token_hash);


--
-- Name: logro uq_logro_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logro
    ADD CONSTRAINT uq_logro_nombre UNIQUE (nombre);


--
-- Name: matricula uq_matricula; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT uq_matricula UNIQUE (id_curso, id_estudiante);


--
-- Name: mundo uq_mundo_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mundo
    ADD CONSTRAINT uq_mundo_orden UNIQUE (id_curso, orden);


--
-- Name: nivel uq_nivel_nombre; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT uq_nivel_nombre UNIQUE (nombre);


--
-- Name: nivel uq_nivel_numero; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT uq_nivel_numero UNIQUE (numero);


--
-- Name: nivel uq_nivel_xp; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivel
    ADD CONSTRAINT uq_nivel_xp UNIQUE (xp_requerido);


--
-- Name: opcion uq_opcion_etiqueta; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcion
    ADD CONSTRAINT uq_opcion_etiqueta UNIQUE (id_pregunta, etiqueta);


--
-- Name: participante_sala uq_participante_sala; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participante_sala
    ADD CONSTRAINT uq_participante_sala UNIQUE (id_sala, id_estudiante);


--
-- Name: pregunta uq_pregunta_orden; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pregunta
    ADD CONSTRAINT uq_pregunta_orden UNIQUE (id_sala, orden);


--
-- Name: progreso_mundo uq_progreso_mundo; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_mundo
    ADD CONSTRAINT uq_progreso_mundo UNIQUE (id_matricula, id_mundo);


--
-- Name: respuesta_sala uq_respuesta_sala; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuesta_sala
    ADD CONSTRAINT uq_respuesta_sala UNIQUE (id_participante, id_pregunta);


--
-- Name: token_cuenta uq_token_cuenta_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_cuenta
    ADD CONSTRAINT uq_token_cuenta_hash UNIQUE (token_hash);


--
-- Name: uso_ia uq_uso_ia_operacion; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uso_ia
    ADD CONSTRAINT uq_uso_ia_operacion UNIQUE (id_operacion);


--
-- Name: usuario uq_usuario_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_email UNIQUE (email);


--
-- Name: idx_auditoria_actor_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_actor_fecha ON public.auditoria_seguridad USING btree (id_actor, fecha_evento DESC);


--
-- Name: idx_auditoria_institucion_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_institucion_fecha ON public.auditoria_seguridad USING btree (id_institucion, fecha_evento DESC);


--
-- Name: idx_curso_docente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curso_docente ON public.curso USING btree (id_docente);


--
-- Name: idx_curso_institucion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_curso_institucion ON public.curso USING btree (id_institucion);


--
-- Name: idx_ejercicio_mundo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ejercicio_mundo ON public.ejercicio USING btree (id_mundo);


--
-- Name: idx_envio_ejercicio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envio_ejercicio ON public.envio_ejercicio USING btree (id_ejercicio);


--
-- Name: idx_envio_ejercicio_estudiante_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envio_ejercicio_estudiante_fecha ON public.envio_ejercicio USING btree (id_ejercicio, id_estudiante, fecha_envio DESC);


--
-- Name: idx_envio_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envio_estudiante ON public.envio_ejercicio USING btree (id_estudiante);


--
-- Name: idx_envio_estudiante_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_envio_estudiante_fecha ON public.envio_ejercicio USING btree (id_estudiante, fecha_envio DESC);


--
-- Name: idx_invitacion_institucion_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitacion_institucion_estado ON public.invitacion_usuario USING btree (id_institucion, estado, fecha_creacion DESC);


--
-- Name: idx_matricula_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matricula_curso ON public.matricula USING btree (id_curso);


--
-- Name: idx_matricula_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matricula_estudiante ON public.matricula USING btree (id_estudiante);


--
-- Name: idx_mundo_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mundo_curso ON public.mundo USING btree (id_curso);


--
-- Name: idx_participante_sala; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_participante_sala ON public.participante_sala USING btree (id_sala);


--
-- Name: idx_progreso_matricula_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progreso_matricula_estado ON public.progreso_mundo USING btree (id_matricula, estado);


--
-- Name: idx_respuesta_participante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_respuesta_participante ON public.respuesta_sala USING btree (id_participante);


--
-- Name: idx_respuesta_sala; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_respuesta_sala ON public.respuesta_sala USING btree (id_sala);


--
-- Name: idx_respuesta_sala_puntaje; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_respuesta_sala_puntaje ON public.respuesta_sala USING btree (id_sala, puntaje_obtenido DESC);


--
-- Name: idx_sala_curso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sala_curso ON public.sala_multijugador USING btree (id_curso);


--
-- Name: idx_sala_pin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sala_pin ON public.sala_multijugador USING btree (pin_sala);


--
-- Name: idx_uso_ia_docente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uso_ia_docente ON public.uso_ia USING btree (id_docente);


--
-- Name: idx_uso_ia_docente_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_uso_ia_docente_fecha ON public.uso_ia USING btree (id_docente, fecha_uso DESC);


--
-- Name: idx_usuario_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_email_lower ON public.usuario USING btree (lower((email)::text));


--
-- Name: idx_usuario_rol; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usuario_rol ON public.usuario USING btree (rol);


--
-- Name: idx_xp_curso_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_curso_estudiante ON public.xp_movimiento USING btree (id_curso, id_estudiante);


--
-- Name: idx_xp_estudiante; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_estudiante ON public.xp_movimiento USING btree (id_estudiante, id_curso);


--
-- Name: uq_invitacion_email_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_invitacion_email_pendiente ON public.invitacion_usuario USING btree (lower((email)::text)) WHERE ((estado)::text = 'pendiente'::text);


--
-- Name: uq_sala_pin_activa; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sala_pin_activa ON public.sala_multijugador USING btree (pin_sala) WHERE ((estado)::text = ANY ((ARRAY['espera'::character varying, 'en_curso'::character varying])::text[]));


--
-- Name: uq_token_cuenta_activo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_token_cuenta_activo ON public.token_cuenta USING btree (id_usuario, tipo) WHERE ((usado_en IS NULL) AND (revocado_en IS NULL));


--
-- Name: uq_usuario_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_usuario_email_lower ON public.usuario USING btree (lower(btrim((email)::text)));


--
-- Name: uq_usuario_superadministrador_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_usuario_superadministrador_unico ON public.usuario USING btree (rol) WHERE ((rol)::text = 'superadministrador'::text);


--
-- Name: uq_xp_por_evaluacion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_xp_por_evaluacion ON public.xp_movimiento USING btree (id_evaluacion) WHERE (id_evaluacion IS NOT NULL);


--
-- Name: uq_xp_por_participante_sala; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_xp_por_participante_sala ON public.xp_movimiento USING btree (id_participante_sala) WHERE (id_participante_sala IS NOT NULL);


--
-- Name: uq_xp_primer_aprobado_ejercicio; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_xp_primer_aprobado_ejercicio ON public.xp_movimiento USING btree (id_estudiante, id_curso, id_ejercicio) WHERE ((origen)::text = 'evaluacion_ia'::text);


--
-- Name: usuario trg_proteger_identidad_superadministrador; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_proteger_identidad_superadministrador BEFORE INSERT OR DELETE OR UPDATE ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.proteger_identidad_superadministrador();


--
-- Name: asignacion_tokens trg_validar_asignacion_tokens_roles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_asignacion_tokens_roles BEFORE INSERT OR UPDATE ON public.asignacion_tokens FOR EACH ROW EXECUTE FUNCTION public.validar_asignacion_tokens_roles();


--
-- Name: curso trg_validar_docente_curso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_docente_curso BEFORE INSERT OR UPDATE OF id_docente, id_institucion ON public.curso FOR EACH ROW EXECUTE FUNCTION public.validar_docente_curso();


--
-- Name: institucion_dominio trg_validar_dominio_institucional; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_dominio_institucional BEFORE INSERT OR UPDATE ON public.institucion_dominio FOR EACH ROW EXECUTE FUNCTION public.validar_dominio_institucional();


--
-- Name: envio_ejercicio trg_validar_envio_ejercicio_integridad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_envio_ejercicio_integridad BEFORE INSERT OR UPDATE OF id_matricula, id_estudiante, id_ejercicio, id_curso ON public.envio_ejercicio FOR EACH ROW EXECUTE FUNCTION public.validar_envio_ejercicio_integridad();


--
-- Name: matricula trg_validar_estudiante_matricula; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_estudiante_matricula BEFORE INSERT OR UPDATE OF id_curso, id_estudiante ON public.matricula FOR EACH ROW EXECUTE FUNCTION public.validar_estudiante_matricula();


--
-- Name: evaluacion_ia trg_validar_evaluacion_ia_integridad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_evaluacion_ia_integridad BEFORE INSERT OR UPDATE OF id_envio_ejercicio, id_estudiante, id_curso ON public.evaluacion_ia FOR EACH ROW EXECUTE FUNCTION public.validar_evaluacion_ia_integridad();


--
-- Name: invitacion_usuario trg_validar_invitacion_usuario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_invitacion_usuario BEFORE INSERT OR UPDATE ON public.invitacion_usuario FOR EACH ROW EXECUTE FUNCTION public.validar_invitacion_usuario();


--
-- Name: uso_ia trg_validar_uso_ia_integridad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_uso_ia_integridad BEFORE INSERT OR UPDATE OF id_docente, id_institucion, id_envio_ejercicio, id_silabo, tipo_operacion ON public.uso_ia FOR EACH ROW EXECUTE FUNCTION public.validar_uso_ia_integridad();


--
-- Name: usuario trg_validar_usuario_dominio_institucional; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_usuario_dominio_institucional BEFORE INSERT OR UPDATE OF id_institucion, email, rol ON public.usuario FOR EACH ROW EXECUTE FUNCTION public.validar_usuario_dominio_institucional();


--
-- Name: xp_movimiento trg_validar_xp_integridad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validar_xp_integridad BEFORE INSERT OR UPDATE ON public.xp_movimiento FOR EACH ROW EXECUTE FUNCTION public.validar_xp_integridad();


--
-- Name: asignacion_tokens fk_asigntok_docente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_tokens
    ADD CONSTRAINT fk_asigntok_docente FOREIGN KEY (id_docente_beneficiario) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: asignacion_tokens fk_asigntok_superadmin; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asignacion_tokens
    ADD CONSTRAINT fk_asigntok_superadmin FOREIGN KEY (id_superadmin_asignador) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: auditoria_seguridad fk_auditoria_actor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_seguridad
    ADD CONSTRAINT fk_auditoria_actor FOREIGN KEY (id_actor) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: auditoria_seguridad fk_auditoria_institucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditoria_seguridad
    ADD CONSTRAINT fk_auditoria_institucion FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: curso fk_curso_docente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT fk_curso_docente FOREIGN KEY (id_docente) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: curso fk_curso_institucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.curso
    ADD CONSTRAINT fk_curso_institucion FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: ejercicio fk_ejercicio_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicio
    ADD CONSTRAINT fk_ejercicio_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: ejercicio fk_ejercicio_mundo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ejercicio
    ADD CONSTRAINT fk_ejercicio_mundo FOREIGN KEY (id_mundo) REFERENCES public.mundo(id_mundo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: envio_ejercicio fk_envio_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_ejercicio
    ADD CONSTRAINT fk_envio_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: envio_ejercicio fk_envio_ejercicio_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_ejercicio
    ADD CONSTRAINT fk_envio_ejercicio_ref FOREIGN KEY (id_ejercicio) REFERENCES public.ejercicio(id_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: envio_ejercicio fk_envio_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_ejercicio
    ADD CONSTRAINT fk_envio_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: envio_ejercicio fk_envio_matricula; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.envio_ejercicio
    ADD CONSTRAINT fk_envio_matricula FOREIGN KEY (id_matricula) REFERENCES public.matricula(id_matricula) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: estudiante_logro fk_estudlogro_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante_logro
    ADD CONSTRAINT fk_estudlogro_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: estudiante_logro fk_estudlogro_logro; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estudiante_logro
    ADD CONSTRAINT fk_estudlogro_logro FOREIGN KEY (id_logro) REFERENCES public.logro(id_logro) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: evaluacion_ia fk_evaluacion_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_ia
    ADD CONSTRAINT fk_evaluacion_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: evaluacion_ia fk_evaluacion_envio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_ia
    ADD CONSTRAINT fk_evaluacion_envio FOREIGN KEY (id_envio_ejercicio) REFERENCES public.envio_ejercicio(id_envio_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: evaluacion_ia fk_evaluacion_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluacion_ia
    ADD CONSTRAINT fk_evaluacion_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: institucion_dominio fk_instdom_creador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion_dominio
    ADD CONSTRAINT fk_instdom_creador FOREIGN KEY (creado_por) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: institucion_dominio fk_instdom_institucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institucion_dominio
    ADD CONSTRAINT fk_instdom_institucion FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: invitacion_usuario fk_invitacion_creador; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitacion_usuario
    ADD CONSTRAINT fk_invitacion_creador FOREIGN KEY (creada_por) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: invitacion_usuario fk_invitacion_institucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitacion_usuario
    ADD CONSTRAINT fk_invitacion_institucion FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: invitacion_usuario fk_invitacion_usuario_usado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitacion_usuario
    ADD CONSTRAINT fk_invitacion_usuario_usado FOREIGN KEY (usada_por) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: matricula fk_matricula_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT fk_matricula_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: matricula fk_matricula_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matricula
    ADD CONSTRAINT fk_matricula_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: mundo fk_mundo_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mundo
    ADD CONSTRAINT fk_mundo_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: mundo fk_mundo_silabo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mundo
    ADD CONSTRAINT fk_mundo_silabo FOREIGN KEY (id_silabo) REFERENCES public.silabo(id_silabo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: opcion fk_opcion_pregunta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opcion
    ADD CONSTRAINT fk_opcion_pregunta FOREIGN KEY (id_pregunta) REFERENCES public.pregunta(id_pregunta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: participante_sala fk_participante_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participante_sala
    ADD CONSTRAINT fk_participante_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: participante_sala fk_participante_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participante_sala
    ADD CONSTRAINT fk_participante_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: participante_sala fk_participante_matricula; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participante_sala
    ADD CONSTRAINT fk_participante_matricula FOREIGN KEY (id_matricula) REFERENCES public.matricula(id_matricula) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: participante_sala fk_participante_sala_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.participante_sala
    ADD CONSTRAINT fk_participante_sala_ref FOREIGN KEY (id_sala) REFERENCES public.sala_multijugador(id_sala) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: pregunta fk_pregunta_sala; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pregunta
    ADD CONSTRAINT fk_pregunta_sala FOREIGN KEY (id_sala) REFERENCES public.sala_multijugador(id_sala) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: progreso_mundo fk_progreso_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_mundo
    ADD CONSTRAINT fk_progreso_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: progreso_mundo fk_progreso_matricula; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_mundo
    ADD CONSTRAINT fk_progreso_matricula FOREIGN KEY (id_matricula) REFERENCES public.matricula(id_matricula) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: progreso_mundo fk_progreso_mundo_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progreso_mundo
    ADD CONSTRAINT fk_progreso_mundo_ref FOREIGN KEY (id_mundo) REFERENCES public.mundo(id_mundo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: respuesta_sala fk_respuesta_opcion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuesta_sala
    ADD CONSTRAINT fk_respuesta_opcion FOREIGN KEY (id_opcion) REFERENCES public.opcion(id_opcion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: respuesta_sala fk_respuesta_participante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuesta_sala
    ADD CONSTRAINT fk_respuesta_participante FOREIGN KEY (id_participante) REFERENCES public.participante_sala(id_participante) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: respuesta_sala fk_respuesta_pregunta; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuesta_sala
    ADD CONSTRAINT fk_respuesta_pregunta FOREIGN KEY (id_pregunta) REFERENCES public.pregunta(id_pregunta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: respuesta_sala fk_respuesta_sala_ref; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuesta_sala
    ADD CONSTRAINT fk_respuesta_sala_ref FOREIGN KEY (id_sala) REFERENCES public.sala_multijugador(id_sala) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: sala_multijugador fk_sala_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_multijugador
    ADD CONSTRAINT fk_sala_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: sala_multijugador fk_sala_pregunta_activa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sala_multijugador
    ADD CONSTRAINT fk_sala_pregunta_activa FOREIGN KEY (id_pregunta_activa) REFERENCES public.pregunta(id_pregunta) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: silabo fk_silabo_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.silabo
    ADD CONSTRAINT fk_silabo_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: token_cuenta fk_token_cuenta_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_cuenta
    ADD CONSTRAINT fk_token_cuenta_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: uso_ia fk_uso_ia_docente; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uso_ia
    ADD CONSTRAINT fk_uso_ia_docente FOREIGN KEY (id_docente) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: uso_ia fk_uso_ia_envio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uso_ia
    ADD CONSTRAINT fk_uso_ia_envio FOREIGN KEY (id_envio_ejercicio) REFERENCES public.envio_ejercicio(id_envio_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: uso_ia fk_uso_ia_institucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uso_ia
    ADD CONSTRAINT fk_uso_ia_institucion FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: uso_ia fk_uso_ia_silabo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uso_ia
    ADD CONSTRAINT fk_uso_ia_silabo FOREIGN KEY (id_silabo) REFERENCES public.silabo(id_silabo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: usuario fk_usuario_institucion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_institucion FOREIGN KEY (id_institucion) REFERENCES public.institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: xp_movimiento fk_xp_curso; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_movimiento
    ADD CONSTRAINT fk_xp_curso FOREIGN KEY (id_curso) REFERENCES public.curso(id_curso) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: xp_movimiento fk_xp_ejercicio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_movimiento
    ADD CONSTRAINT fk_xp_ejercicio FOREIGN KEY (id_ejercicio) REFERENCES public.ejercicio(id_ejercicio) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: xp_movimiento fk_xp_estudiante; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_movimiento
    ADD CONSTRAINT fk_xp_estudiante FOREIGN KEY (id_estudiante) REFERENCES public.usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: xp_movimiento fk_xp_evaluacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_movimiento
    ADD CONSTRAINT fk_xp_evaluacion FOREIGN KEY (id_evaluacion) REFERENCES public.evaluacion_ia(id_evaluacion) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: xp_movimiento fk_xp_participante_sala; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_movimiento
    ADD CONSTRAINT fk_xp_participante_sala FOREIGN KEY (id_participante_sala) REFERENCES public.participante_sala(id_participante) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Migraciones incorporadas en este volcado canónico
--
-- `schema.sql` representa el estado final de todas las migraciones. Registrar
-- sus nombres evita que `npm run db:migrate` intente aplicarlas otra vez sobre
-- una base recién creada con este archivo.
--

INSERT INTO public.schema_migration (nombre) VALUES
    ('001_usuario_security_profile.sql'),
    ('002_integrity_and_performance.sql'),
    ('003_usuario_input_constraints.sql'),
    ('004_genero_masculino_femenino.sql'),
    ('005_identity_governance.sql'),
    ('006_ai_xp_integrity.sql'),
    ('007_enforce_user_institutional_domain.sql'),
    ('008_evaluation_workflow.sql'),
    ('009_xp_first_pass_only.sql')
ON CONFLICT (nombre) DO NOTHING;


--
-- PostgreSQL database dump complete
--

\unrestrict zqKd7rsBsBWPfMVyzLGQgeRlbjlJwkVFgdGAL642crhrIUWTBgujQNJECSwsHhy

