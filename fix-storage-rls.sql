-- ============================================================
-- Fix Supabase Storage Bucket RLS Policies
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Disable RLS on storage.objects table (affects all buckets)
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Remove any existing RLS policies on storage.objects
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "User can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "User can read own folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read public buckets" ON storage.objects;

-- Remove any policies on storage.buckets
DROP POLICY IF EXISTS "Public buckets are viewable by everyone" ON storage.buckets;
DROP POLICY IF EXISTS "Authenticated users can create buckets" ON storage.buckets;

-- Verify storage tables have RLS disabled
SELECT 
  schemaname, 
  tablename, 
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = pg_tables.tablename AND schemaname = pg_tables.schemaname) as policy_count
FROM pg_tables
WHERE schemaname = 'storage'
ORDER BY tablename;
