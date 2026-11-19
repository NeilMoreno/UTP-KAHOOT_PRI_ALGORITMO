BEGIN;

-- El PDF del silabo se guarda en la base: el disco de muchos servicios (Render, Railway) es efimero.
-- Los silabos anteriores conservan su archivo en disco (contenido_pdf NULL).
ALTER TABLE silabo
    ADD COLUMN contenido_pdf BYTEA,
    ALTER COLUMN ruta_archivo DROP NOT NULL;

ALTER TABLE silabo
    ADD CONSTRAINT ck_silabo_pdf_tamano CHECK (contenido_pdf IS NULL OR octet_length(contenido_pdf) <= 10485760);

COMMIT;
