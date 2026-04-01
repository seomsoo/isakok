# 프로젝트 상태

> 마지막 업데이트: 2026-04-01

## 현재 단계

1단계: Supabase 세팅 — 검증완료

## 완료된 것

- supabase/migrations/00001_create_tables.sql: 6개 테이블 생성
- supabase/migrations/00002_create_rpc.sql: RPC 2개 (create_move_with_checklist, update_move_with_reschedule) + IS DISTINCT FROM 보안 수정
- supabase/migrations/00003_create_rls.sql: RLS 정책 6개 (8단계에서 활성화)
- supabase/migrations/00004_create_storage.sql: property-photos 버킷 (private)
- supabase/seed.sql: 마스터 체크리스트 시드 데이터 46개
- apps/web/src/lib/supabase.ts: Supabase 클라이언트 초기화
- packages/shared/src/types/database.ts: Supabase 타입 정의
- apps/web/src/vite-env.d.ts: Vite 환경변수 타입
- docs/specs/01-supabase-setup.md: 1단계 스펙
- docs/specs/01-verify.md: 1단계 검증 결과 (12/12 통과)
- supabase/CLAUDE.md: RPC SECURITY DEFINER 허용 조건 명시 + image_url → storage_path 수정

## 진행 중인 것

- 없음

## 다음 할 것

1. feat/supabase-setup 브랜치 커밋 + PR 생성 → main 머지
2. 2단계 스펙 작성: docs/specs/02-onboarding.md
3. 2단계 구현: 온보딩 4단계 폼 + createMoveWithChecklist RPC 호출

## 알려진 문제

- 없음

## 실패한 접근 (반복 금지)

- RPC 권한 체크에 `!=` 사용 금지 — auth.uid()가 NULL일 때 가드 스킵됨. 반드시 `IS DISTINCT FROM` 사용
