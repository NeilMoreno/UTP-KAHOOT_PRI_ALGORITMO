BEGIN;

ALTER TABLE envio_ejercicio
    ADD COLUMN id_operacion UUID,
    ADD COLUMN estado_evaluacion VARCHAR(20);

UPDATE envio_ejercicio
   SET id_operacion = id_envio_ejercicio,
       estado_evaluacion = CASE
           WHEN NOT sintaxis_valida THEN 'rechazado_local'
           WHEN EXISTS (
               SELECT 1 FROM evaluacion_ia ev
                WHERE ev.id_envio_ejercicio = envio_ejercicio.id_envio_ejercicio
           ) THEN 'completado'
           ELSE 'fallido'
       END;

ALTER TABLE envio_ejercicio
    ALTER COLUMN id_operacion SET DEFAULT gen_random_uuid(),
    ALTER COLUMN id_operacion SET NOT NULL,
    ALTER COLUMN estado_evaluacion SET DEFAULT 'pendiente',
    ALTER COLUMN estado_evaluacion SET NOT NULL,
    ADD CONSTRAINT uq_envio_id_operacion UNIQUE (id_operacion),
    ADD CONSTRAINT ck_envio_codigo_longitud CHECK (
        length(btrim(codigo_pseint)) BETWEEN 1 AND 12000
    ),
    ADD CONSTRAINT ck_envio_mensaje_longitud CHECK (
        mensaje_sintaxis IS NULL OR length(mensaje_sintaxis) <= 8000
    ),
    ADD CONSTRAINT ck_envio_estado_evaluacion CHECK (
        estado_evaluacion IN ('rechazado_local', 'pendiente', 'procesando', 'completado', 'fallido')
    ),
    ADD CONSTRAINT ck_envio_estado_sintaxis CHECK (
        (NOT sintaxis_valida AND estado_evaluacion = 'rechazado_local')
        OR
        (sintaxis_valida AND estado_evaluacion IN ('pendiente', 'procesando', 'completado', 'fallido'))
    );

ALTER TABLE evaluacion_ia
    ADD COLUMN sugerencias JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN eficiencia_algoritmica TEXT NOT NULL DEFAULT 'No registrada.',
    ADD COLUMN codigo_sugerido_mejora TEXT NOT NULL DEFAULT '',
    ADD COLUMN modelo_ia VARCHAR(100) NOT NULL DEFAULT 'legacy',
    ADD COLUMN id_respuesta_proveedor VARCHAR(255),
    ADD CONSTRAINT ck_evaluacion_categoria CHECK (
        categoria_error IS NULL OR categoria_error IN (
            'ninguno', 'sintaxis', 'logica', 'condicion_borde', 'eficiencia', 'formato', 'otro'
        )
    ),
    ADD CONSTRAINT ck_evaluacion_retroalimentacion_longitud CHECK (
        length(btrim(retroalimentacion)) BETWEEN 10 AND 4000
    ),
    ADD CONSTRAINT ck_evaluacion_sugerencias CHECK (
        jsonb_typeof(sugerencias) = 'array' AND jsonb_array_length(sugerencias) <= 5
    ),
    ADD CONSTRAINT ck_evaluacion_eficiencia_longitud CHECK (
        length(btrim(eficiencia_algoritmica)) BETWEEN 1 AND 1000
    ),
    ADD CONSTRAINT ck_evaluacion_codigo_sugerido_longitud CHECK (
        length(codigo_sugerido_mejora) <= 12000
    );

ALTER TABLE uso_ia
    ADD COLUMN proveedor_ia VARCHAR(30),
    ADD COLUMN modelo_ia VARCHAR(100),
    ADD CONSTRAINT ck_uso_ia_proveedor CHECK (
        proveedor_ia IS NULL OR proveedor_ia IN ('gemini')
    );

CREATE INDEX idx_envio_ejercicio_estudiante_fecha
    ON envio_ejercicio (id_ejercicio, id_estudiante, fecha_envio DESC);

COMMIT;
