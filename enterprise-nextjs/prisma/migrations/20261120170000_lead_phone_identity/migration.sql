-- Preserve original display values and all existing rows, including historical duplicates.
CREATE FUNCTION lead_phone_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT CASE WHEN value ~ '^[+0-9 ().-]+$' AND value ~ '[0-9]'
    THEN regexp_replace(translate(value, '+ ().-', ''), '^(91|0)([0-9]{10})$', '\2')
    ELSE btrim(value) END
$$;
CREATE INDEX leads_phone_identity_idx ON leads (lead_phone_key(phone));
CREATE INDEX leads_contact_identity_idx ON leads (lead_phone_key(contact));
