-- Fruta in natura (laranja, limão...), separada de polpa congelada.
-- Fica numa migration só dela: o Postgres só deixa usar um valor novo de enum depois do commit.
ALTER TYPE tipo_ingrediente ADD VALUE IF NOT EXISTS 'FRUTA' AFTER 'POLPA';
