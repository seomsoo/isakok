# 1단계: Supabase 세팅 + 시드 데이터 스펙 (SDD)

> 목표: DB 테이블 6개 + RPC 함수 2개 + 시드 데이터 46개 + Storage 버킷 + 웹앱 연동
> 이 단계가 끝나면: 웹앱에서 Supabase에 연결되고, 마스터 체크리스트 데이터가 들어있는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것
- Supabase CLI 설치 + 프로젝트 링크
- DB 마이그레이션 파일 작성 (테이블 6개 + 인덱스 + trigger)
- RPC 함수 2개 (createMoveWithChecklist, updateMoveWithReschedule)
- RLS 정책 정의 (8단계에서 켜기 — 이 시점에서는 SQL만 작성)
- 마스터 체크리스트 시드 데이터 46개 삽입
- Storage 버킷 (property-photos) 생성
- .env.local + .env.example 생성
- lib/supabase.ts 클라이언트 초기화
- @supabase/supabase-js 패키지 설치
- Supabase 타입 자동 생성 (database.ts)

### 안 하는 것
- RLS 활성화 (8단계)
- Auth 설정 — Apple/카카오/Google 소셜 로그인 (8단계)
- Edge Function 작성 (7단계)
- 실제 API 호출 코드 — services/ 함수 (2단계~)
- 프론트엔드 UI (2단계~)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
isakok/
├── .env.local                          ← 생성 (Git 제외)
├── .env.example                        ← 생성 (Git 포함, 키 값은 비움)
│
├── apps/web/
│   └── src/
│       └── lib/
│           └── supabase.ts             ← 생성 (Supabase 클라이언트 초기화)
│
├── packages/shared/
│   └── src/
│       └── types/
│           └── database.ts             ← 생성 (Supabase CLI 자동 생성)
│
└── supabase/
    ├── config.toml                     ← Supabase CLI가 생성
    ├── migrations/
    │   ├── 00001_create_tables.sql     ← 테이블 6개 + 인덱스
    │   ├── 00002_create_rpc.sql        ← RPC 함수 2개
    │   ├── 00003_create_rls.sql        ← RLS 정책 (비활성 상태)
    │   └── 00004_create_storage.sql    ← Storage 버킷
    └── seed.sql                        ← 마스터 체크리스트 46개
```

---

## 2. Supabase CLI 세팅

```bash
# Supabase CLI 설치
pnpm add -D supabase -w

# 프로젝트 초기화 (supabase/ 폴더 생성)
npx supabase init

# 원격 프로젝트 링크
npx supabase link --project-ref ybcqinanfcarhqkclvue
```

---

## 3. 환경변수

### .env.local (Git 제외 — 실제 키)
```bash
VITE_SUPABASE_URL=https://ybcqinanfcarhqkclvue.supabase.co
VITE_SUPABASE_ANON_KEY=실제_anon_key_여기에
```

### .env.example (Git 포함 — 템플릿)
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **왜 VITE_ 접두사?**: Vite는 `VITE_`로 시작하는 환경변수만 클라이언트 코드에 노출한다.
> 이 접두사가 없으면 import.meta.env에서 접근 불가.

---

## 4. DB 마이그레이션 — 테이블 6개

### 4-1. users
```sql
-- Supabase Auth 확장 — auth.users와 연결되는 공개 프로필 테이블
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nickname text,
  provider text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### 4-2. moves
```sql
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
```

### 4-3. master_checklist_items
```sql
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
```

> **housing_types가 text[] 배열인 이유**: 하나의 체크리스트 항목이 여러 주거유형에 해당할 수 있음.
> 예: "냉장고 비우기"는 원룸, 오피스텔, 빌라, 아파트, 투룸+ 전부에 해당.
> JSONB 대신 text[]를 쓰는 이유: 단순 포함 여부 체크에는 배열이 더 간단하고 빠름. (ADR: 기획정리 §10)

### 4-4. user_checklist_items
```sql
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
```

> **user_id가 왜 여기에도 있나? (비정규화)**:
> Supabase RLS는 단일 테이블 기준으로 동작함. moves를 JOIN해서 user_id를 가져올 수 없기 때문에,
> user_checklist_items에 user_id를 직접 넣어야 RLS에서 `auth.uid() = user_id` 체크가 가능.

### 4-5. property_photos
```sql
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
```

> **왜 image_url이 아니라 storage_path?**: Supabase Storage의 URL은 만료되는 signed URL이다.
> DB에 전체 URL을 저장하면 시간이 지나면 깨짐. 경로만 저장하고(`property-photos/user_id/move_id/room_timestamp.jpg`),
> 필요할 때 `supabase.storage.from('property-photos').createSignedUrl(path, 3600)`으로 URL을 생성하는 게 안전.

### 4-6. ai_guide_cache
```sql
CREATE TABLE public.ai_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  master_version integer NOT NULL,
  guides jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### 공통: updated_at 자동 갱신 trigger
```sql
-- 모든 테이블에 적용하는 updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 trigger 연결
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.moves
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.master_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.property_photos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ai_guide_cache
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

> **왜 trigger?**: 매번 UPDATE 쿼리에 `updated_at = now()`를 넣는 건 실수하기 쉬움.
> trigger로 자동화하면 어떤 경로로 업데이트하든 항상 갱신됨.

---

## 5. RPC 함수 2개

### 5-1. createMoveWithChecklist

이사 생성 + 마스터 체크리스트에서 조건 필터링 + user_checklist_items 복사를 **하나의 트랜잭션**으로 처리.

```sql
CREATE OR REPLACE FUNCTION public.create_move_with_checklist(
  p_user_id uuid,
  p_moving_date date,
  p_housing_type text,
  p_contract_type text,
  p_move_type text,
  p_is_first_move boolean DEFAULT false,
  p_from_address text DEFAULT NULL,
  p_to_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_move_id uuid;
BEGIN
  -- 권한 체크: 본인만 자기 이사를 생성할 수 있음
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: user_id mismatch';
  END IF;

  -- 1. 이사 생성
  INSERT INTO public.moves (user_id, moving_date, housing_type, contract_type, move_type, is_first_move, from_address, to_address)
  VALUES (p_user_id, p_moving_date, p_housing_type, p_contract_type, p_move_type, p_is_first_move, p_from_address, p_to_address)
  RETURNING id INTO v_move_id;

  -- 2. 마스터 체크리스트에서 조건 필터링 → user_checklist_items로 복사
  INSERT INTO public.user_checklist_items (move_id, user_id, master_item_id, assigned_date)
  SELECT
    v_move_id,
    p_user_id,
    m.id,
    p_moving_date + m.d_day_offset  -- 이사일 기준 실제 날짜 계산
  FROM public.master_checklist_items m
  WHERE
    p_housing_type = ANY(m.housing_types)
    AND p_contract_type = ANY(m.contract_types)
    AND p_move_type = ANY(m.move_types);

  RETURN v_move_id;
END;
$$;
```

> **왜 RPC?**: 이사 생성과 체크리스트 복사가 원자적 트랜잭션이어야 함.
> 클라이언트에서 2번 호출하면 중간에 실패 시 이사는 생겼는데 체크리스트는 없는 상태가 됨.
> **왜 SECURITY DEFINER?**: INVOKER로 하면 RLS가 INSERT를 막을 수 있음 (아직 행이 없어서 정책 평가 불가).
> DEFINER는 함수 소유자 권한으로 실행되어 RLS를 우회하되, 함수 내부에서 `auth.uid()` 검증으로 보안을 유지.
> **SET search_path = public**: DEFINER 함수에서 보안 모범 사례. search_path 조작 공격 방지.

### 5-2. updateMoveWithReschedule

이사 정보 수정 + 미완료 체크리스트 항목의 assigned_date 재계산을 **하나의 트랜잭션**으로 처리.

```sql
CREATE OR REPLACE FUNCTION public.update_move_with_reschedule(
  p_move_id uuid,
  p_moving_date date,
  p_housing_type text,
  p_contract_type text,
  p_move_type text,
  p_is_first_move boolean DEFAULT false,
  p_from_address text DEFAULT NULL,
  p_to_address text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 권한 체크: 본인 이사만 수정 가능
  IF NOT EXISTS (
    SELECT 1 FROM public.moves
    WHERE id = p_move_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized: move not found or not owned';
  END IF;

  -- 1. 이사 정보 업데이트
  UPDATE public.moves
  SET
    moving_date = p_moving_date,
    housing_type = p_housing_type,
    contract_type = p_contract_type,
    move_type = p_move_type,
    is_first_move = p_is_first_move,
    from_address = p_from_address,
    to_address = p_to_address
  WHERE id = p_move_id;

  -- 2. 미완료 항목만 날짜 재계산 (완료된 항목은 건드리지 않음)
  UPDATE public.user_checklist_items uci
  SET assigned_date = p_moving_date + m.d_day_offset
  FROM public.master_checklist_items m
  WHERE uci.move_id = p_move_id
    AND uci.master_item_id = m.id
    AND uci.is_completed = false;

  -- 3. 조건 변경으로 새로 해당되는 항목 추가 (NOT EXISTS 사용 — NOT IN보다 안전하고 빠름)
  INSERT INTO public.user_checklist_items (move_id, user_id, master_item_id, assigned_date)
  SELECT
    p_move_id,
    (SELECT user_id FROM public.moves WHERE id = p_move_id),
    m.id,
    p_moving_date + m.d_day_offset
  FROM public.master_checklist_items m
  WHERE
    p_housing_type = ANY(m.housing_types)
    AND p_contract_type = ANY(m.contract_types)
    AND p_move_type = ANY(m.move_types)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_checklist_items uci
      WHERE uci.move_id = p_move_id AND uci.master_item_id = m.id
    );

  -- 4. 조건 변경으로 더 이상 해당 안 되는 미완료 항목 삭제
  DELETE FROM public.user_checklist_items uci
  USING public.master_checklist_items m
  WHERE uci.move_id = p_move_id
    AND uci.master_item_id = m.id
    AND uci.is_completed = false
    AND (
      NOT (p_housing_type = ANY(m.housing_types))
      OR NOT (p_contract_type = ANY(m.contract_types))
      OR NOT (p_move_type = ANY(m.move_types))
    );
END;
$$;
```

> **왜 미완료만 재계산?**: 이미 체크한 항목의 날짜를 바꾸면 유저가 혼란스러움.
> 완료된 항목은 그대로 유지, 미완료 항목만 새 이사일 기준으로 날짜 재배치.
> **3번/4번이 왜 필요?**: 이사 방식을 "용달→포장"으로 바꾸면
> "이사박스 준비(#18)"는 제거되고(포장이사는 업체가 제공), 새 조건에 맞는 항목이 추가될 수 있음.
> **NOT EXISTS vs NOT IN**: NOT IN은 서브쿼리에 NULL이 있으면 전체 결과가 빈 집합이 됨. NOT EXISTS는 이 문제가 없고 일반적으로 더 빠름.

---

## 6. RLS 정책 (SQL만 작성, 8단계에서 활성화)

```sql
-- ⚠️ 이 마이그레이션은 RLS를 아직 켜지 않음 (ALTER TABLE ... ENABLE ROW LEVEL SECURITY 없음)
-- 8단계에서 아래 주석을 해제하고 RLS를 활성화할 것

-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.master_checklist_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_checklist_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.ai_guide_cache ENABLE ROW LEVEL SECURITY;

-- 정책 정의 (RLS 켜지면 자동 적용)
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
```

---

## 7. Storage 버킷

```sql
-- property-photos 버킷 생성 (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', false);
```

> **왜 private?**: 집 상태 사진은 개인 증거 자료. public이면 URL만 알면 누구나 볼 수 있음.
> private이면 Supabase Auth 인증된 유저만 접근 가능.

---

## 8. 시드 데이터

마스터 체크리스트 46개 항목을 `supabase/seed.sql`에 INSERT문으로 작성.

데이터 원본: `docs/마스터_체크리스트_데이터.md` (46개 항목)

### 반영해야 할 수정사항 (설계 결정사항 v2 §9-2, §9-3):
1. #01 이사 비용: 2026 시세 반영 (원룸 용달 5~15만, 반포장 20~35만, 포장 35~70만)
2. #31 한전 앱: "스마트 한전" → "한전ON"
3. #41 전입신고: 정부24 모바일 동시 처리, 수수료 500원
4. #13 전입신고 서류: 온라인 동시 처리 가능
5. #46 새 집 사전 실측 추가 (D-14)
6. guide_url 15개+ 확충 (빼기 앱, 가스앱, KT Moving 등)

### 시드 데이터 형식 예시 (1개)
```sql
INSERT INTO public.master_checklist_items
  (title, description, guide_content, guide_url, d_day_offset, housing_types, contract_types, move_types, category, sort_order, is_skippable, guide_type)
VALUES
  (
    '이사 방식 결정하기',
    '짐 양에 따라 용달/반포장/포장이사 중 선택',
    '원룸 짐 적으면 용달(5~15만), 가전가구 있으면 반포장(20~35만), 모든 짐 포장 맡기려면 포장이사(35~70만). 자가용은 정말 짐이 몇 박스일 때만.',
    NULL,
    -30,
    ARRAY['원룸', '오피스텔', '빌라', '아파트', '투룸+'],
    ARRAY['월세', '전세'],
    ARRAY['용달', '반포장', '포장', '자가용'],
    '업체/이사방법',
    1,
    false,
    'tip'
  );
-- ... 나머지 45개 항목
```

> 전체 46개의 INSERT문은 Claude Code가 `docs/마스터_체크리스트_데이터.md`를 읽고 자동 생성.
> 수정사항 6개를 반드시 반영해야 함.

---

## 9. 웹앱 연동 파일

### apps/web/src/lib/supabase.ts
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL 또는 Anon Key가 설정되지 않았습니다. .env.local 파일을 확인하세요.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

> **왜 여기서 에러를 throw?**: 환경변수 없이 앱이 실행되면 아무 기능도 안 되는데
> 에러 메시지 없이 조용히 실패하면 디버깅이 어려움. 빠르게 실패(fail fast)하는 게 좋음.

### 패키지 설치
```bash
cd apps/web
pnpm add @supabase/supabase-js
```

### Supabase 타입 자동 생성
```bash
# 루트에서 실행
npx supabase gen types typescript --project-id ybcqinanfcarhqkclvue > packages/shared/src/types/database.ts
```

> 이 명령은 Supabase DB 스키마를 읽어서 TypeScript 타입을 자동 생성함.
> 테이블/컬럼이 바뀔 때마다 다시 실행하면 됨.

---

## 10. 완료 확인 기준 (체크리스트)

- [ ] `npx supabase db push` → 마이그레이션 적용 성공
- [ ] Supabase 대시보드 → Table Editor에서 6개 테이블 확인
- [ ] master_checklist_items에 46개 행 존재 (시드 데이터)
- [ ] `select * from master_checklist_items where d_day_offset = -30` → 결과 있음
- [ ] RPC 테스트: Supabase SQL Editor에서 `select create_move_with_checklist(...)` 실행 → 정상
- [ ] Storage → property-photos 버킷 존재 (private)
- [ ] .env.local 존재 + .gitignore에 포함됨
- [ ] .env.example 존재 (키 값 비어있음)
- [ ] apps/web에서 `import { supabase } from '@/lib/supabase'` → 에러 없음
- [ ] packages/shared/src/types/database.ts 존재 (Supabase 자동 생성)
- [ ] `pnpm build` → 에러 없음
- [ ] Git에 .env.local이 포함되지 않음

---

## 11. 엣지케이스 / 주의사항

### Supabase CLI vs 대시보드
- 테이블 생성은 **반드시 마이그레이션 파일**로 (대시보드에서 수동 생성하면 마이그레이션 이력이 안 남음)
- 마이그레이션 파일이 있어야 나중에 다른 환경에서 재현 가능

### 시드 데이터 주의
- `seed.sql`은 `npx supabase db reset` 할 때만 자동 실행됨
- 원격 DB에 시드 넣으려면 `npx supabase db push` 후 별도로 SQL Editor에서 실행하거나 `psql`로 직접 실행

### housing_types 배열에 '아파트' 포함
- 설계 결정사항 v2에서 추가됨 (ADR-012)
- 기존 마스터 체크리스트 데이터에서 `[전체]`로 표시된 항목은 `ARRAY['원룸', '오피스텔', '빌라', '아파트', '투룸+']`로 변환

### RLS 정책은 만들되 켜지 않음
- CREATE POLICY는 RLS가 꺼져 있어도 생성 가능
- ENABLE ROW LEVEL SECURITY가 없으면 정책이 존재하지만 적용되지 않음
- 8단계에서 ALTER TABLE ... ENABLE ROW LEVEL SECURITY 실행하면 즉시 적용

### database.ts 타입 자동 생성 타이밍
- 마이그레이션을 push한 후에 실행해야 최신 스키마가 반영됨
- 순서: 마이그레이션 push → 타입 생성 → 코드에서 import

---

## 12. 다음 단계 연결

1단계 완료 후 → **2단계: 온보딩 → 체크리스트 생성** (`docs/specs/02-onboarding.md`)
- 온보딩 4단계 폼 (이사일, 주거유형, 계약유형, 첫이사 여부)
- createMoveWithChecklist RPC 호출
- 온보딩 완료 → 대시보드로 이동
- react-router-dom 설치 + 라우팅 설정
- TanStack Query 설치 + 첫 번째 서비스 함수
