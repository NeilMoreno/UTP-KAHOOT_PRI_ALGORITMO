BEGIN;

ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS avatar_style VARCHAR(20) NOT NULL DEFAULT 'adventurer',
    ADD COLUMN IF NOT EXISTS avatar_seed  VARCHAR(40);

ALTER TABLE usuario
    ADD CONSTRAINT ck_usuario_avatar_style
        CHECK (avatar_style IN ('adventurer', 'bottts', 'pixelArt', 'funEmoji')),
    ADD CONSTRAINT ck_usuario_avatar_seed
        CHECK (avatar_seed IS NULL OR avatar_seed ~ '^[A-Za-z0-9_-]{1,40}$');

COMMIT;
