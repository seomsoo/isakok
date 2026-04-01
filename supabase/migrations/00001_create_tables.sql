-- 00001_create_tables.sql
-- 테이블 6개 + 인덱스 + updated_at trigger

-- ============================================================
-- 공통: updated_at 자동 갱신 함수
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. users — auth.users와 연결되는 공개 프로필
-- ============================================================
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nickname text,
  provider text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. moves — 이사 정보
-- ============================================================
CREATE TABLE public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  moving_date date NOT NULL,
  housing_type text NOT NULL CHECK (housing_type IN ('원룸', '오피스텔', '빌라', '아파트', '투룸+')),
  contract_type text NOT NULL CHECK (contract_type IN ('월세', '전세')),
  move_type text NOT NULL CHECK (move_type IN ('용달', '반포장', '포장', '자가용')),
  is_first_move boolean DEFAULT false NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  from_address text,
  to_address text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_moves_user_id ON public.moves(user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.moves
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 3. master_checklist_items — 마스터 체크리스트 (시드 데이터용)
-- ============================================================
CREATE TABLE public.master_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  guide_content text,
  guide_url text,
  d_day_offset integer NOT NULL,
  housing_types text[] NOT NULL,
  contract_types text[] NOT NULL,
  move_types text[] NOT NULL,
  category text NOT NULL,
  sort_order integer NOT NULL,
  is_skippable boolean DEFAULT true NOT NULL,
  guide_type text NOT NULL DEFAULT 'tip' CHECK (guide_type IN ('tip', 'warning', 'critical')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.master_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 4. user_checklist_items — 유저별 체크리스트 (이사 생성 시 복사됨)
-- ============================================================
CREATE TABLE public.user_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid REFERENCES public.moves(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  master_item_id uuid REFERENCES public.master_checklist_items(id) NOT NULL,
  is_completed boolean DEFAULT false NOT NULL,
  assigned_date date NOT NULL,
  completed_at timestamptz,
  memo text,
  custom_guide text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_user_checklist_move_id ON public.user_checklist_items(move_id);
CREATE INDEX idx_user_checklist_user_id ON public.user_checklist_items(user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 5. property_photos — 집 상태 사진
-- ============================================================
CREATE TABLE public.property_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id uuid REFERENCES public.moves(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('move_in', 'move_out')),
  room text NOT NULL CHECK (room IN ('entrance', 'room', 'bathroom', 'kitchen', 'balcony', 'other')),
  location_detail text,
  group_key text,
  storage_path text NOT NULL,
  image_hash text,
  memo text,
  taken_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE INDEX idx_photos_move_id ON public.property_photos(move_id);
CREATE INDEX idx_photos_user_id ON public.property_photos(user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.property_photos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 6. ai_guide_cache — AI 맞춤 가이드 캐시
-- ============================================================
CREATE TABLE public.ai_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  master_version integer NOT NULL,
  guides jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_guide_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
