-- 구조화된 가이드 컬럼 추가
-- guide_content는 유지 (7단계 AI 가이드 폴백 + 구조화 안 된 항목 폴백)
ALTER TABLE public.master_checklist_items
  ADD COLUMN IF NOT EXISTS guide_steps text[],
  ADD COLUMN IF NOT EXISTS guide_items text[],
  ADD COLUMN IF NOT EXISTS guide_note text;
