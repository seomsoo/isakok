# docs/ — 기획 문서 & 스펙

## 기획 문서 (읽기 전용 참조)

### project-overview.md

프로젝트 전체 기획. 타겟, 문제 정의, MVP 기능, 유저 플로우, 기술 스택, DB 스키마, API 설계,

### DECISIONS.md

**기획 시점 초기 설계 스냅샷(§1~13)** — 프로젝트 개요, UI/UX, 인증 전략, AI 맞춤 가이드 설계, 집 상태 기록, 스마트 재배치, WebView 아키텍처, Apple 심사 체크리스트, 경쟁 분석, 면접 대비 포인트. 작성 후 미갱신 — 이후 변경·정본 결정은 ADR.md 참조.

### ADR.md

기술적 의사결정 기록(ADR-001~). 설계 진화의 정본 로그. 번호로 인용(`ADR-NNN`). (2026-06-05 DECISIONS.md §14에서 분리)

### UI-POLISH.md

UI/UX 폴리싱 기록. 네이티브 탭바·전환 애니메이션(SSGOI)·스와이프백·브릿지 확장·소셜 버튼 브랜드·WebView 로딩 견고화 등 단계별 다듬기 이력.

### DESIGN.md

디자인 스타일 가이드. 토스 스타일 기반 디자인 원칙, 타이포그래피, 간격 체계, 둥글기/그림자, 컬러 사용 원칙, 아이콘, 애니메이션 기준. 컴포넌트 구현 시 이 문서의 수치를 따른다. 문구·말투는 `ux-writing-guide.md`가 정본.

### ux-writing-guide.md

UX 라이팅 가이드. 앱 안 모든 문구(버튼·안내·에러·알림·빈 상태)의 정본. 해요체 통일, 능동·긍정형, 캐주얼 경어, 버튼 작성법, 민감 정보 안심 문구, D-day 카피, 예외 규칙. 문구를 쓰거나 고칠 때 이 문서를 따른다 (시각 토큰은 `DESIGN.md`).

### master-checklist-data.md

시드 데이터 원본. 46개 체크리스트 항목의 상세 정보 (title, description, guide_content, d_day_offset, 조건 태그, guide_url 등).

## 스펙 파일 (SDD)

각 개발 단계 시작 전에 명세를 작성하고, 구현 후에도 유지.

```
docs/specs/
├── 00-project-setup.md         ← 0단계 스펙
├── 01-supabase-setup.md        ← 1단계 스펙
├── 02-onboarding.md            ← 2단계 스펙
├── component-design-spec.md    ← 공통 컴포넌트 디자인 스펙
├── ...
```

### 스펙 작성 규칙

- 만들 것의 목록 (어떤 파일, 어떤 함수, 어떤 컴포넌트)
- 입력/출력 정의
- 엣지케이스 나열
- 구현 후 스펙과 코드가 맞는지 확인
- 스펙은 삭제하지 않음 (변경 이력 역할)

### Claude Code에게 스펙 활용 방법

작업 지시 시 "docs/specs/02-onboarding.md 보고 구현해줘"로 명세를 직접 참조시킬 것.
