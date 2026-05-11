-- Shared trigger function to auto-update updated_ts on row modification.
-- Referenced by BEFORE UPDATE triggers on every table that has updated_ts.
CREATE FUNCTION set_updated_ts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_ts = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
