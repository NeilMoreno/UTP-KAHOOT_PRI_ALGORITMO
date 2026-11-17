BEGIN;

LOCK TABLE usuario IN SHARE ROW EXCLUSIVE MODE;

-- Normaliza únicamente las identidades demo conocidas de las fases anteriores.
UPDATE usuario
   SET email = 'docente.demo@utp.edu.pe'
 WHERE rol = 'docente'
   AND email = 'docente@codeint.test';

UPDATE usuario
   SET email = 'estudiante.demo@utp.edu.pe'
 WHERE rol = 'estudiante'
   AND email = 'estudiante@codeint.test';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM usuario u
         WHERE u.rol IN ('docente', 'estudiante')
           AND NOT EXISTS (
               SELECT 1
                 FROM institucion_dominio d
                WHERE d.id_institucion = u.id_institucion
                  AND d.dominio = split_part(u.email, '@', 2)
                  AND d.estado = 'activo'
           )
    ) THEN
        RAISE EXCEPTION
            'Existen usuarios no administrativos sin un dominio institucional activo.';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION validar_usuario_dominio_institucional()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_validar_usuario_dominio_institucional ON usuario;
CREATE TRIGGER trg_validar_usuario_dominio_institucional
    BEFORE INSERT OR UPDATE OF id_institucion, email, rol ON usuario
    FOR EACH ROW EXECUTE FUNCTION validar_usuario_dominio_institucional();

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
    'DOMINIO_USUARIO_REFORZADO',
    'usuario',
    id_usuario,
    'exitoso',
    jsonb_build_object('dominio_institucional', 'utp.edu.pe')
FROM usuario
WHERE rol = 'superadministrador';

COMMIT;
