-- GiftaGuru website leads get their own source (previously they could only arrive through the Printkee webhook).
-- Additive only: no existing rows change. Old portal leads stay WEBHOOK (the legacy system never recorded the site).
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'GIFTAGURU';
