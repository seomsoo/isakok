# 10-1 Spike 결과 (Apple/Google linkIdentity native id_token)

## 환경

- supabase-js 버전: 2.105.4
- @react-native-google-signin/google-signin 버전: 16.1.2
- iOS Simulator (expo run:ios)
- Supabase 콘솔 Manual Linking: ON
- Supabase 콘솔 Google Skip nonce checks: ON (ADR-052)

## 결과

- [x] ✅ 통과 / [ ] ❌ 실패 / [ ] ⚠️ 미결정

## 로그

```
익명 user.id = <redacted-uuid>
is_anonymous = true
Google idToken 획득: <redacted>
linkIdentity error: null
linkIdentity data: {"session":{"access_token":"<redacted>","user":{"id":"<redacted-uuid>","is_anonymous":false,"app_metadata":{"provider":"google","providers":["google"]},"identities":[]}}}
현재 user.id = <redacted-uuid>
is_anonymous = false
identities count = 1
identities = ["google"]

✅ SPIKE 통과: link 성공, 같은 user.id 유지
```

## 분석

- `linkIdentity({ provider: 'google', token: idToken } as any)` 호출 성공
- 익명 user.id(`de50c097...`) 유지 + `is_anonymous` false 전환
- `app_metadata.provider` = "google", `providers` = ["google"] 자동 갱신
- linkIdentity 응답의 `identities`는 빈 배열이나, `getUser()` 조회 시 `["google"]` 1건 확인
- `as any` 캐스트 필요: SDK 타입 정의에 `token` 파라미터 미포함 (런타임은 정상 동작)

## 후속 조치

- 본 구현은 **메인 경로**로 진행 (linkIdentity 사용)
- `tryLinkIdentity`의 `as any` **유지** (SDK 타입이 token을 명시할 때까지)
- 폴백 경로(signInWithIdToken)는 linkIdentity 실패 시 안전망으로 보존
