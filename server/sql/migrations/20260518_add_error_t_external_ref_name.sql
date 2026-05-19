ALTER TABLE error_t
ADD COLUMN IF NOT EXISTS external_ref_name TEXT;

UPDATE error_t AS e
SET external_ref_name = p.name
FROM profiles_t AS p
WHERE e.external_ref_name IS NULL
  AND e.external_ref_type = 'profile'
  AND e.external_ref_id ~ '^[0-9]+$'
  AND p.id = e.external_ref_id::int;

UPDATE error_t AS e
SET external_ref_name = s.name
FROM sources_t AS s
WHERE e.external_ref_name IS NULL
  AND e.external_ref_type = 'source'
  AND e.external_ref_id ~ '^[0-9]+$'
  AND s.id = e.external_ref_id::int;
