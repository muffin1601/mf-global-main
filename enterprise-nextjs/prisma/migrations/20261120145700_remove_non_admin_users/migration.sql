-- Remove all non-admin users while preserving constraints
-- Delete dependent records first (Quotation has onDelete: Restrict)
-- Then delete users with role='USER'

DELETE FROM quotation_items
WHERE quotation_id IN (
  SELECT id FROM quotations
  WHERE user_id IN (SELECT id FROM users WHERE role = 'USER')
);

DELETE FROM quotations
WHERE user_id IN (SELECT id FROM users WHERE role = 'USER');

DELETE FROM users WHERE role = 'USER';
