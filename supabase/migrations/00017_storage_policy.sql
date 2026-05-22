-- 00017_storage_policy.sql
-- dev permissive 정책 DROP + 본인 경로 정책 (property-photos 버킷)

-- ============ 기존 dev permissive 정책 제거 ============
DROP POLICY IF EXISTS "dev_allow_all_delete" ON storage.objects;
DROP POLICY IF EXISTS "dev_allow_all_select" ON storage.objects;
DROP POLICY IF EXISTS "dev_allow_all_upload" ON storage.objects;
DROP POLICY IF EXISTS "dev_allow_all_update" ON storage.objects;

-- ============ 본인 경로 정책 (재시도 안전) ============
DROP POLICY IF EXISTS "photos_select_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete_own" ON storage.objects;

-- (storage.foldername(name))[1] = 경로 첫 세그먼트 = {userId}
CREATE POLICY "photos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "photos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
