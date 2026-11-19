BEGIN;

-- El docente puede permitir (por defecto) o cerrar que los estudiantes de su institucion se unan con el codigo del curso.
ALTER TABLE curso
    ADD COLUMN union_por_codigo BOOLEAN NOT NULL DEFAULT true;

-- Nuevo tipo de notificacion: un estudiante se unio al curso.
ALTER TABLE notificacion DROP CONSTRAINT ck_notificacion_tipo;
ALTER TABLE notificacion
    ADD CONSTRAINT ck_notificacion_tipo CHECK (tipo IN ('logro', 'mundo', 'sala', 'integridad', 'matricula'));

COMMIT;
