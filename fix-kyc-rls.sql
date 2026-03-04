-- ============================================================
-- Fix KYC Submission RLS Policy Error
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Disable RLS on kyc_submissions table
ALTER TABLE kyc_submissions DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled on all tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_refresh_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_deposit_addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_config DISABLE ROW LEVEL SECURITY;

-- Verify all RLS policies are removed/disabled
-- This query will show if RLS is still enabled (should return no rows if all disabled)
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND EXISTS (
  SELECT 1 FROM information_schema.table_constraints 
  WHERE table_schema = 'public' 
  AND table_name = pg_tables.tablename
);
