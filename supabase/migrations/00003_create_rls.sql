-- 00003_create_rls.sql
-- RLS 정책 정의 (8단계에서 ENABLE ROW LEVEL SECURITY 활성화)

-- ============================================================
-- RLS 활성화는 8단계에서 아래 주석 해제
-- ============================================================
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.master_checklist_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ai_guide_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 정책 정의 (RLS 켜지면 자동 적용)
-- ============================================================

CREATE POLICY "users_all_own" ON public.users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "moves_all_own" ON public.moves
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "master_select_public" ON public.master_checklist_items
  FOR SELECT USING (true);

CREATE POLICY "user_checklist_all_own" ON public.user_checklist_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "photos_all_own" ON public.property_photos
  FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "ai_cache_select_public" ON public.ai_guide_cache
  FOR SELECT USING (true);
