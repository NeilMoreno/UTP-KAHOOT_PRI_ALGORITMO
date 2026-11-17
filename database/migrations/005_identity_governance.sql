BEGIN;

LOCK TABLE usuario IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    superadmin_count INTEGER;
BEGIN
    SELECT count(*)::int
      INTO superadmin_count
      FROM usuario
     WHERE rol = 'superadministrador';

    IF superadmin_count > 1 THEN
        RAISE EXCEPTION
            'No se puede fijar la identidad administrativa: existen % superadministradores.',
            superadmin_count;
    END IF;

    IF superadmin_count = 1 AND EXISTS (
        SELECT 1
          FROM usuario
         WHERE lower(email) = 'admin@codeintcorp.com'
           AND rol <> 'superadministrador'
    ) THEN
        RAISE EXCEPTION
            'El correo corporativo fijo ya pertenece a una cuenta no administrativa.';
    END IF;
END $$;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS correo_verificado_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS password_actualizada_en TIMESTAMPTZ;

UPDATE usuario
   SET correo_verificado_en = COALESCE(correo_verificado_en, fecha_creacion)
 WHERE correo_verificado = true;

UPDATE usuario
   SET password_actualizada_en = COALESCE(password_actualizada_en, fecha_creacion);

UPDATE usuario
   SET email = 'admin@codeintcorp.com',
       correo_verificado = true,
       correo_verificado_en = COALESCE(correo_verificado_en, now()),
       estado = 'activo',
       id_institucion = NULL
 WHERE rol = 'superadministrador';

ALTER TABLE usuario
    ALTER COLUMN password_actualizada_en SET DEFAULT now(),
    ALTER COLUMN password_actualizada_en SET NOT NULL,
    DROP CONSTRAINT IF EXISTS ck_usuario_institucion_requerida,
    DROP CONSTRAINT IF EXISTS ck_usuario_token_version,
    DROP CONSTRAINT IF EXISTS ck_usuario_superadmin_fijo,
    DROP CONSTRAINT IF EXISTS ck_usuario_verificacion_fecha;

ALTER TABLE usuario
    ADD CONSTRAINT ck_usuario_institucion_requerida CHECK (
        (rol = 'superadministrador' AND id_institucion IS NULL)
        OR
        (rol <> 'superadministrador' AND id_institucion IS NOT NULL)
    ),
    ADD CONSTRAINT ck_usuario_token_version CHECK (token_version >= 0),
    ADD CONSTRAINT ck_usuario_superadmin_fijo CHECK (
        rol <> 'superadministrador'
        OR (
            email = 'admin@codeintcorp.com'
            AND estado = 'activo'
            AND correo_verificado = true
        )
    ),
    ADD CONSTRAINT ck_usuario_verificacion_fecha CHECK (
        (correo_verificado = true AND correo_verificado_en IS NOT NULL)
        OR
        (correo_verificado = false AND correo_verificado_en IS NULL)
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_superadministrador_unico
    ON usuario (rol)
    WHERE rol = 'superadministrador';

CREATE OR REPLACE FUNCTION proteger_identidad_superadministrador()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_proteger_identidad_superadministrador ON usuario;
CREATE TRIGGER trg_proteger_identidad_superadministrador
    BEFORE INSERT OR UPDATE OR DELETE ON usuario
    FOR EACH ROW EXECUTE FUNCTION proteger_identidad_superadministrador();

CREATE TABLE IF NOT EXISTS institucion_dominio (
    id_institucion_dominio UUID         NOT NULL DEFAULT gen_random_uuid(),
    id_institucion         UUID         NOT NULL,
    dominio                VARCHAR(253) NOT NULL,
    estado                 VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
    verificado_en          TIMESTAMPTZ,
    creado_por             UUID,
    fecha_creacion         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_institucion_dominio PRIMARY KEY (id_institucion_dominio),
    CONSTRAINT fk_instdom_institucion FOREIGN KEY (id_institucion)
        REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_instdom_creador FOREIGN KEY (creado_por)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT uq_institucion_dominio UNIQUE (dominio),
    CONSTRAINT ck_instdom_dominio CHECK (
        dominio = lower(btrim(dominio))
        AND char_length(dominio) BETWEEN 3 AND 253
        AND dominio ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
    CONSTRAINT ck_instdom_estado CHECK (estado IN ('pendiente', 'activo', 'inactivo')),
    CONSTRAINT ck_instdom_verificacion CHECK (
        (estado = 'activo' AND verificado_en IS NOT NULL)
        OR estado <> 'activo'
    )
);

CREATE TABLE IF NOT EXISTS invitacion_usuario (
    id_invitacion_usuario UUID         NOT NULL DEFAULT gen_random_uuid(),
    id_institucion        UUID         NOT NULL,
    email                 VARCHAR(254) NOT NULL,
    rol                   VARCHAR(25)  NOT NULL,
    token_hash            CHAR(64)     NOT NULL,
    estado                VARCHAR(20)  NOT NULL DEFAULT 'pendiente',
    expira_en             TIMESTAMPTZ  NOT NULL,
    usada_en              TIMESTAMPTZ,
    creada_por            UUID         NOT NULL,
    usada_por             UUID,
    fecha_creacion        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_invitacion_usuario PRIMARY KEY (id_invitacion_usuario),
    CONSTRAINT fk_invitacion_institucion FOREIGN KEY (id_institucion)
        REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_invitacion_creador FOREIGN KEY (creada_por)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_invitacion_usuario_usado FOREIGN KEY (usada_por)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT uq_invitacion_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_invitacion_email CHECK (
        email = lower(btrim(email))
        AND char_length(email) BETWEEN 3 AND 254
        AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ),
    CONSTRAINT ck_invitacion_rol CHECK (rol IN ('estudiante', 'docente')),
    CONSTRAINT ck_invitacion_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_invitacion_estado CHECK (estado IN ('pendiente', 'usada', 'revocada', 'vencida')),
    CONSTRAINT ck_invitacion_expiracion CHECK (expira_en > fecha_creacion),
    CONSTRAINT ck_invitacion_uso CHECK (
        (estado = 'usada' AND usada_en IS NOT NULL AND usada_por IS NOT NULL)
        OR
        (estado <> 'usada' AND usada_en IS NULL AND usada_por IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invitacion_email_pendiente
    ON invitacion_usuario (lower(email))
    WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_invitacion_institucion_estado
    ON invitacion_usuario (id_institucion, estado, fecha_creacion DESC);

CREATE TABLE IF NOT EXISTS token_cuenta (
    id_token_cuenta UUID         NOT NULL DEFAULT gen_random_uuid(),
    id_usuario      UUID         NOT NULL,
    tipo            VARCHAR(40)  NOT NULL,
    token_hash      CHAR(64)     NOT NULL,
    expira_en       TIMESTAMPTZ  NOT NULL,
    usado_en        TIMESTAMPTZ,
    revocado_en     TIMESTAMPTZ,
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_token_cuenta PRIMARY KEY (id_token_cuenta),
    CONSTRAINT fk_token_cuenta_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT uq_token_cuenta_hash UNIQUE (token_hash),
    CONSTRAINT ck_token_cuenta_tipo CHECK (tipo IN ('restablecer_password')),
    CONSTRAINT ck_token_cuenta_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_token_cuenta_expiracion CHECK (expira_en > fecha_creacion),
    CONSTRAINT ck_token_cuenta_estado CHECK (NOT (usado_en IS NOT NULL AND revocado_en IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_token_cuenta_activo
    ON token_cuenta (id_usuario, tipo)
    WHERE usado_en IS NULL AND revocado_en IS NULL;

CREATE TABLE IF NOT EXISTS auditoria_seguridad (
    id_auditoria_seguridad UUID         NOT NULL DEFAULT gen_random_uuid(),
    id_actor               UUID,
    id_institucion         UUID,
    accion                 VARCHAR(80)  NOT NULL,
    tipo_objetivo          VARCHAR(50),
    id_objetivo            UUID,
    resultado              VARCHAR(20)  NOT NULL,
    direccion_ip           INET,
    metadatos              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    fecha_evento           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_auditoria_seguridad PRIMARY KEY (id_auditoria_seguridad),
    CONSTRAINT fk_auditoria_actor FOREIGN KEY (id_actor)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_auditoria_institucion FOREIGN KEY (id_institucion)
        REFERENCES institucion(id_institucion) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT ck_auditoria_accion CHECK (accion = upper(btrim(accion)) AND char_length(accion) BETWEEN 3 AND 80),
    CONSTRAINT ck_auditoria_resultado CHECK (resultado IN ('exitoso', 'rechazado', 'fallido')),
    CONSTRAINT ck_auditoria_metadatos_objeto CHECK (jsonb_typeof(metadatos) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_auditoria_actor_fecha
    ON auditoria_seguridad (id_actor, fecha_evento DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_institucion_fecha
    ON auditoria_seguridad (id_institucion, fecha_evento DESC);

CREATE OR REPLACE FUNCTION validar_dominio_institucional()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_validar_dominio_institucional ON institucion_dominio;
CREATE TRIGGER trg_validar_dominio_institucional
    BEFORE INSERT OR UPDATE ON institucion_dominio
    FOR EACH ROW EXECUTE FUNCTION validar_dominio_institucional();

CREATE OR REPLACE FUNCTION validar_invitacion_usuario()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_validar_invitacion_usuario ON invitacion_usuario;
CREATE TRIGGER trg_validar_invitacion_usuario
    BEFORE INSERT OR UPDATE ON invitacion_usuario
    FOR EACH ROW EXECUTE FUNCTION validar_invitacion_usuario();

INSERT INTO institucion_dominio (
    id_institucion,
    dominio,
    estado,
    verificado_en,
    creado_por
)
SELECT
    i.id_institucion,
    'utp.edu.pe',
    'activo',
    now(),
    sa.id_usuario
FROM institucion i
LEFT JOIN LATERAL (
    SELECT id_usuario
      FROM usuario
     WHERE rol = 'superadministrador'
     LIMIT 1
) sa ON true
WHERE i.estado = 'activa'
ORDER BY i.fecha_creacion
LIMIT 1
ON CONFLICT (dominio) DO NOTHING;

INSERT INTO auditoria_seguridad (
    id_actor,
    accion,
    tipo_objetivo,
    id_objetivo,
    resultado,
    metadatos
)
SELECT
    id_usuario,
    'MIGRACION_IDENTIDAD_APLICADA',
    'usuario',
    id_usuario,
    'exitoso',
    jsonb_build_object('superadmin_email', email)
FROM usuario
WHERE rol = 'superadministrador';

COMMIT;
