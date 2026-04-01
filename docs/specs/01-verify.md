# 1단계 검증 결과

> 검증 일시: 2026-04-01

## 완료 확인 기준 결과

- [x] 마이그레이션 파일 4개 존재 (`00001_create_tables.sql`, `00002_create_rpc.sql`, `00003_create_rls.sql`, `00004_create_storage.sql`)
- [x] 6개 테이블 CREATE TABLE 존재 (users, moves, master_checklist_items, user_checklist_items, property_photos, ai_guide_cache)
- [x] 시드 데이터 46개 행 — seed.sql VALUES 행 정확히 46개
- [x] d_day_offset = -30 항목 존재 — seed.sql 18번 줄 (#01 이사 방식 결정하기)
- [x] RPC create_move_with_checklist 정의 — 00002_create_rpc.sql에 스펙 동일 구현
- [x] RPC update_move_with_reschedule 정의 — 00002_create_rpc.sql에 스펙 동일 구현
- [x] Storage property-photos 버킷 생성 — 00004_create_storage.sql에 `public = false` 확인
- [x] .env.local 존재 + .gitignore에 포함됨
- [x] .env.local 존재 + .gitignore에 포함됨 (.env.example → .env.local로 사용자가 직접 변환)
- [x] apps/web에서 `import { supabase } from '@/lib/supabase'` — supabase.ts 존재, 스펙과 코드 일치
- [x] packages/shared/src/types/database.ts 존재 — 6개 테이블 + 2개 RPC 타입 정의
- [x] `pnpm build` → 에러 없음
- [x] Git에 .env.local이 포함되지 않음

## 누락 (스펙에 있는데 구현 안 됨)

없음

## 스코프 크립 (구현했는데 스펙에 없음)

없음

## 컨벤션 위반

없음 (아래 항목 수정 완료)

- ~~`supabase/CLAUDE.md` RPC SECURITY 모드 기술 불일치~~ → DEFINER 허용 조건 명시로 수정 완료
- ~~`supabase/CLAUDE.md` property_photos `image_url` → `storage_path`~~ → 수정 완료
- ~~`00002_create_rpc.sql` NULL-safe 권한 체크 누락~~ → `IS DISTINCT FROM` 적용 완료

## 종합 판정

✅ 통과

12/12 항목 충족. 보안 수정(IS DISTINCT FROM) 및 CLAUDE.md 불일치 3건 모두 해결 완료.
