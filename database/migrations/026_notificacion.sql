BEGIN;

-- Notificaciones dentro de la app (la campana): logros, mundo completado, sala preparada, alertas de integridad.
CREATE TABLE notificacion (
    id_notificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_usuario      UUID NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    tipo            VARCHAR(20) NOT NULL,
    titulo          VARCHAR(80) NOT NULL,
    mensaje         VARCHAR(200) NOT NULL,
    enlace          VARCHAR(200),
    leida_en        TIMESTAMPTZ,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_notificacion_tipo CHECK (tipo IN ('logro', 'mundo', 'sala', 'integridad')),
    CONSTRAINT ck_notificacion_enlace CHECK (enlace IS NULL OR enlace ~ '^#/[A-Za-z0-9/_?=&.-]*$')
);

CREATE INDEX idx_notificacion_usuario ON notificacion (id_usuario, fecha_creacion DESC);
CREATE INDEX idx_notificacion_pendientes ON notificacion (id_usuario) WHERE leida_en IS NULL;

COMMIT;
