BEGIN;

-- El avatar pasa de {estilo, semilla} (DiceBear) a una configuración por capas (pixel art).
-- La validación fina de ids y niveles vive en backend/utils/avatarCatalog.js.
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS avatar_config JSONB;

ALTER TABLE usuario
    ADD CONSTRAINT ck_usuario_avatar_config
        CHECK (
            avatar_config IS NULL
            OR (jsonb_typeof(avatar_config) = 'object' AND octet_length(avatar_config::text) <= 600)
        );

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS ck_usuario_avatar_style;
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS ck_usuario_avatar_seed;
ALTER TABLE usuario DROP COLUMN IF EXISTS avatar_style;
ALTER TABLE usuario DROP COLUMN IF EXISTS avatar_seed;

COMMIT;
