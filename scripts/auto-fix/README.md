# scripts/auto-fix/

자동 교정 시스템(L1/L2/L3) 보조 스크립트.

## check-scope.ts

거부 범위 가드. 변경 파일/diff가 정책 §2의 금지 범위에 해당하는지 결정적 검증.

### 사용

```bash
pnpm auto-fix:check-scope
```

- exit 0: 통과
- exit 1: 위반 (사람 검토 필요)
- exit 2: 스크립트 실행 실패

### 호출처

- `.claude/commands/auto-fix.md` (L1, 매 수정 후)
- `.github/workflows/auto-fix-bot.yml` (L3, 8-2에서 추가)
