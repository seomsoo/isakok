-- 00016_enable_rls.sql
-- RLS 활성화 + 충돌 정책 DROP/재CREATE (soft delete 분리)

-- ============ RLS ENABLE (7개 테이블) ============
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guide_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- ============ users: SELECT만 (provider 위조 차단) ============
DROP POLICY IF EXISTS "users_all_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- ============ moves: 소유권만, deleted_at 제거, DELETE 없음 ============
DROP POLICY IF EXISTS "moves_all_own" ON public.moves;
DROP POLICY IF EXISTS "moves_delete_own" ON public.moves;
CREATE POLICY "moves_select_own" ON public.moves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "moves_insert_own" ON public.moves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "moves_update_own" ON public.moves
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ property_photos: 소유권만, deleted_at 제거, DELETE 유지 ============
DROP POLICY IF EXISTS "photos_all_own" ON public.property_photos;
CREATE POLICY "photos_select_own" ON public.property_photos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "photos_insert_own" ON public.property_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_update_own" ON public.property_photos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_delete_own" ON public.property_photos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ ai_guide_cache: service_role only (정책 제거) ============
DROP POLICY IF EXISTS "ai_cache_select_public" ON public.ai_guide_cache;
DROP POLICY IF EXISTS "ai_guide_cache_read_all" ON public.ai_guide_cache;
DROP POLICY IF EXISTS "ai_guide_cache_select_public" ON public.ai_guide_cache;

-- ============ system_config: public SELECT ============
DROP POLICY IF EXISTS "system_config_read_all" ON public.system_config;
DROP POLICY IF EXISTS "system_config_select_public" ON public.system_config;
CREATE POLICY "system_config_select_public" ON public.system_config
  FOR SELECT USING (true);

-- RPC 소유권 가드 + 권한 제한은 00020_rpc_ownership_guard.sql에서 처리
