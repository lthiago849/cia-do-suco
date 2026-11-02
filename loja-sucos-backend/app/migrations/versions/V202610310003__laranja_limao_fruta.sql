UPDATE ingrediente SET tipo = 'FRUTA', updated_at = now()
WHERE nome IN ('Laranja', 'Limão') AND tipo = 'POLPA';
