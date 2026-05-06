# Harness Engineering

이사앱 사이드 프로젝트에 적용한 자동 하네스 시스템 설명.

## 배경

1인 신입 개발자 사이드 프로젝트. Claude Code를 활용한 SDD(Spec-Driven Development) 워크플로우로 진행.

문제: `/verify`, `/handoff` 같은 수동 검증 도구가 있으나 사람이 까먹으면 작동 안 함. CI 부재로 PR마다 검증 강제 안 됨. AI가 만든 코드의 안전망이 약함.

해결: 3계층 자동 하네스 도입.

## 시스템 구조

### 3계층 (8-1 ~ 8-2 단계)

| 계층 | 위치               | 트리거                  | 역할                                                                     |
| ---- | ------------------ | ----------------------- | ------------------------------------------------------------------------ |
| L1   | 로컬 (Claude Code) | 사람이 `/auto-fix` 실행 | 검증→수정→재검증 루프                                                    |
| L2   | 로컬 (Sub-agent)   | 메인 세션이 위임        | 격리 컨텍스트로 단일책임 검토                                            |
| L3   | GitHub Actions     | git push (자동)         | CI 실패 → 봇이 dry-run 분석을 PR 댓글로 게시 (apply 모드는 운영 결정 후) |

### 7개 sub-agent (단일책임)

코드 안전망:

- `auto-fixer` — 격리 컨텍스트에서 최소 변경 수정
- `security-auditor` — 데이터 흐름/RLS 의미 분석

품질 검증:

- `spec-reviewer` — 스펙 <-> 구현 일치 + 컴포넌트 설계
- `ux-state-reviewer` — loading/empty/error/success 4상태
- `web-a11y-reviewer` — WCAG 2.1/2.2 의미 분석
- `native-a11y-reviewer` — RN accessibility (9단계 활성)
- `perf-budget-reviewer` — 번들/렌더링/이미지

협업 도구:

- `pr-summarizer` — PR 자동 요약 (CI 자동 호출)

## 핵심 설계 결정

### 1. 정책 단일 출처

`.claude/policies/auto-fix-scope.md`를 L1/L2/L3 모두 참조. 룰 변경은 한 파일 수정으로 끝.

### 2. 결정적 검증과 의미 분석 분리

- 결정적 (코드/도구): 거부 경로/패턴, 시크릿 스캔, 정적 a11y 룰
- 의미 분석 (에이전트): 데이터 흐름, RLS 정합성, UX 상태, WCAG 흐름, 성능

이유: LLM의 비결정성으로 보안 가드를 LLM에 맡기면 안 됨. 결정적 검증이 1차 방어선.

### 3. Web a11y vs Native a11y 분리

WCAG/ARIA와 React Native accessibility props는 룰셋이 다름. 한 에이전트가 둘 다 하면 어느 쪽도 깊지 못함.

- Web: WCAG 2.5.8 (24x24 AA) / 2.5.5 (44x44 AAA), aria-\*, focus management
- Native: iOS HIG (44 pt), Material (48 dp), accessibilityLabel/Role/Hint

### 4. 자동 머지 절대 금지

봇 PR은 사람이 직접 Approve + Merge. "테스트 약화로 통과시키는 가짜 수정"을 잡기 위함.

### 5. 6단계 가드 (defense in depth)

L3 봇:

1. CI 실패 조건
2. pull_request 한정 (main push 실패 시 미동작)
3. 봇 actor 차단 (무한 루프 방지)
4. fork 차단 (시크릿 탈취 방지)
5. 모드 토글 (off/dry-run/apply)
6. 시도 횟수 (3회) + best-effort 일일 사용량 관측 (실제 hard limit은 Anthropic Console)

### 6. 드라이런 → apply 점진 전환

처음부터 apply로 가지 않음. dry-run 1주 → 4가지 평가 기준 통과 → apply.
평가 기준: 정확도 70%, 거부 범위 위반 0, 휴리스틱 위반 0, 비용 안정성.

## 면접 한 줄

> "수동 하네스(`/verify`, `/handoff`, spec-reviewer)를 자동 하네스 3계층으로 확장했습니다.
> L1은 로컬 자동 교정 루프, L2는 sub-agent 격리, L3는 GitHub Actions에서 CI 실패 로그를 분석해
> dry-run 수정안을 PR 댓글로 제안하고, 검증이 충분히 쌓이면 apply 모드에서 봇이 수정 PR을 생성할 수 있도록 설계했습니다.
> 자동 수정은 ESLint/TypeScript 같은 deterministic 영역에만 한정하고,
> 테스트/DB 마이그레이션/인증 코드/빌드 설정은 명시적 거부 범위로 차단했으며,
> 자동 머지는 절대 허용하지 않고 사람 승인을 필수로 두었습니다.
> 시도 횟수 제한, fork PR 차단, best-effort 사용량 관측 + Anthropic Console 예산 한도로
> 비용/악의적 사용을 방어합니다."

## 학습한 것

- LLM은 만능이 아님. 결정적 검증과 의미 분석을 분리하는 것이 안전성과 깊이를 모두 잡음
- 자동화 도구는 "사람의 게으름을 보완"하는 게 아니라 "사람의 까먹음을 보완"하는 것
- 점진 전환(off → dry-run → apply)이 시스템 신뢰 구축의 핵심
- 단일 출처 정책이 룰 일관성의 시작
