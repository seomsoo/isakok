# 이사일정관리 웹앱 — 설계 결정사항 통합 문서 v2

> 이 문서는 설계 단계에서 결정한 모든 사항을 포함합니다.
> Claude Code 컨텍스트로 바로 사용 가능합니다.
> 기획 원본: /mnt/project/이사일정관리*기획정리.md
> 체크리스트 데이터: /mnt/project/마스터*체크리스트\_데이터.md
> v2 업데이트: 2026-03-30 (AI 맞춤 가이드, 체크리스트 보완, 가입 유도 재설계, 아파트 세입자 커버, 경쟁 분석 업데이트)

---

## 1. 프로젝트 개요

이사일을 입력하면 할 일이 자동으로 일정에 배치되고, 집 상태를 사진으로 기록해 보관할 수 있는 앱

- 타겟: 직장인 잦은 이사러 (28세 전후, 원룸/오피스텔/빌라/아파트 세입자)
- 1인 사이드프로젝트, 포트폴리오 + 실사용 서비스 목표
- 기술 스택: Expo(React Native) 셸 + React(Vite) WebView + Supabase
- **차별화 포지션**: "이사 과정 관리 + 집 상태 기록 + AI 맞춤 가이드 + 한국 청년 세입자 최적화"

---

## 2. UI/UX 설계

### 2-1. 와이어프레임 도구

- Google Stitch (3 Flash 모드) — 7개 화면 전부 완료
- Stitch 디자인 브리프 문서: /mnt/user-data/outputs/Stitch*디자인*브리프.md

### 2-2. 톤/무드

- 깔끔하고 미니멀한 (토스 스타일 — 정보 중심, 여백 넉넉, 장식 최소)
- ~~따뜻하고 친근한 (당근마켓/오늘의집 스타일)~~ → 2026-04-02 변경
- 상세 기준: docs/DESIGN.md 참조

### 2-3. 컬러 시스템

포맷: OKLCH (지각 균일, 파생색 L값 조절, Tailwind v4 네이티브 지원). HEX는 참고용.

```
Primary:         oklch(0.51 0.086 186.4)  #0F766E  Deep Teal
Secondary:       oklch(0.33 0.030 285)    #333344  Dark Navy
Tertiary:        oklch(0.95 0.019 193)    #E0F2F1  Light Mint
Neutral:         oklch(0.98 0.003 85)     #F8F7F5  Warm Gray
System Warning:  oklch(0.70 0.187 48)     #F97316  Amber — 밀린 할 일
System Critical: oklch(0.64 0.208 25)     #EF4444  Red — 필수 뱃지
System Success:  oklch(0.70 0.149 163)    #10B981  Green — 완료 상태
```

전체 컬러 시스템(확장 토큰, 파생색 규칙 포함): docs/DESIGN.md 참조

### 2-4. 네비게이션

- 3탭: 홈(대시보드), 타임라인, 집기록
- "더보기" 탭 제거 — 핵심 기능이 아닌 항목에 탭 낭비 불필요
- 설정은 상단 우측 톱니바퀴 아이콘으로 접근
- 하단 탭바는 Expo 네이티브 (WebView 탭바 아님 — Apple Guideline 4.2 대응)

### 2-5. 설정 화면 구성

- 이사 관리: 이사 정보 수정
- 계정: 로그인/회원가입(비회원), 연결된 계정/로그아웃/계정 삭제(회원)
- 정보: 개인정보처리방침, 이용약관, 문의하기, 앱 버전
- 계정 삭제는 Apple 필수 요구사항

### 2-6. 필요 화면 (7개)

랜딩, 온보딩 폼, 대시보드(메인), 타임라인 뷰, 항목 상세, 집 상태 기록, 상태 리포트 + 설정

### 2-7. 항목 상세 화면 (v2 업데이트)

- 상단: 체크박스 + 제목 + 카테고리 태그 + 날짜 + 뱃지
- 중간: **AI 맞춤 가이드** (우선 표시) → "원본 가이드 보기" (접힘/accordion) → 관련 링크 → 메모
- 하단: 완료 처리 버튼
- AI 가이드 없으면 (에러/미생성) 기존 guide_content를 그대로 표시

### 2-8. 이사 완료 대시보드 (v2 신규)

- "이사 잘 마무리했어요!" + 입주 상태 기록 보기 (퇴실 때 필요하니 보관 안내)
- 계약 만료일 표시 (v1.1에서 알림 연결)
- "새 이사 시작하기" 버튼
- 리텐션 핵심: 입주 사진 = 퇴실 때까지 보관 필요 → 앱 삭제 방지

---

## 3. 로그인/인증 전략

### 3-1. 비회원 우선 전략

- "가입 없이 시작 → 자연스러운 시점에 가입 유도"
- Apple 정책상 로그인 강제 금지 — 이 설계가 정책에 부합
- 비회원은 IndexedDB로 로컬 동작, 가입 시 로컬 → 서버 마이그레이션

### 3-2. 가입 유도 포인트 (v2 재설계 — 3단계)

**1차: 사진 촬영 시 (가장 강력)**

- "사진을 안전하게 보관하려면 로그인이 필요해요. 로그인하지 않으면 기기에만 저장되어 폰 교체/앱 삭제 시 사라질 수 있어요."
- [로그인하고 안전하게 보관] ← 강조 / [일단 기기에만 저장] ← 가능은 하게
- 기기 저장 선택 시 경고 배너 유지

**2차: 이사 완료 시 (기존 Step 9)**

- "다음 이사 때 데이터 이어서 쓰기" 동기

**3차: AI 가이드 재생성 시 (보조)**

- 비회원이 이사 조건 변경 시 "로그인하면 맞춤 가이드가 새로 업데이트돼요"

**비회원/회원 기능 차이:**

| 기능           | 비회원                  | 회원                   |
| -------------- | ----------------------- | ---------------------- |
| 체크리스트     | ✅ 로컬 저장            | ✅ 서버 저장 + 동기화  |
| AI 맞춤 가이드 | ✅ 최초 1회 생성        | ✅ 조건 변경 시 재생성 |
| 사진 촬영      | ✅ 기기에만 저장 (위험) | ✅ 서버 업로드 (안전)  |
| 이사 히스토리  | ❌ 기기 바꾸면 사라짐   | ✅ 영구 보관           |

### 3-3. 소셜 로그인

- Apple(필수) + 카카오 + Google
- iOS에서 Apple 최상단, Android에서 카카오 최상단 (Platform.OS 분기)
- 프로필/닉네임 설정 불필요 — 도구형 앱이라 다른 유저에게 보여줄 정보 없음

### 3-4. 인증 아키텍처

- 인증은 네이티브(Expo)가 전담
- 소셜 로그인 → 네이티브 SDK → Supabase Auth → Expo SecureStore에 토큰 저장
- WebView에 postMessage로 세션 전달 → 웹은 토큰으로 API 호출만
- 웹앱에 인증 로직 없음 (보안 + 관심사 분리)

---

## 4. AI 맞춤 가이드 설계 (v2 신규)

### 4-1. 개요

- 온보딩 정보(주거유형, 계약유형, 이사방식, 첫이사 여부)를 기반으로
- 체크리스트 항목별 가이드를 유저 상황에 맞게 AI가 재작성
- 기존 guide_content가 "정답 원본", AI는 유저 눈높이에 맞게 번역하는 역할
- 국내외 이사 앱 중 유일한 AI 기능 (짐싸/짐카/이사모아/MoveAdvisor 모두 AI 없음)

### 4-2. 아키텍처

```
유저 온보딩
    ↓
프론트: Supabase Edge Function 호출 (인증 불필요 — 비회원도 사용)
    ↓
Edge Function: 캐시 확인 (ai_guide_cache 테이블)
    ├── 캐시 있음 + 버전 일치 → 바로 반환
    └── 캐시 없음 or 버전 불일치 → Claude API 호출 → 캐시 저장 → 반환
    ↓
프론트: custom_guide를 user_checklist_items에 저장 (회원=DB, 비회원=IndexedDB)
    ↓
항목 상세 화면: custom_guide 우선 표시, 없으면 guide_content 폴백
```

### 4-3. 온보딩 입력 (4단계)

1. 이사 예정일 (기존)
2. 주거 유형 (기존) — 원룸/오피스텔/빌라/아파트/투룸+
3. 계약 유형 (기존) — 월세/전세
4. **첫 이사인가요?** (v2 신규) — 예/아니오

이사방식은 기존 온보딩에 이미 포함 (용달/반포장/포장/자가용)

### 4-4. Edge Function → Claude API 호출

- 모델: Claude Haiku (claude-haiku-4-5-20251001) — ADR-021 참조
- 입력: 유저 조건 + 필터링된 체크리스트 항목(제목+기존 가이드) 15~25개
- 출력: JSON 배열 [{id, custom_guide}, ...]
- 프롬프트 규칙: 첫 이사면 용어 쉽게, 해당 조건에 맞는 내용만 강조, 항목당 2~4문장

### 4-5. 캐싱 전략

- 캐시 키: `${housing_type}_${contract_type}_${move_type}_${is_first_move}`
- 이론적 최대 조합: 5×2×4×2 = 80가지, 실제 사용 20~30가지
- **비용: 조합당 약 40원(Haiku), 전체 캐싱 완료 시 약 1,600원 (1회성)**
- 이후 유저 수와 무관하게 추가 비용 0원
- master_version 컬럼으로 마스터 데이터 수정 시 캐시 자동 무효화

### 4-6. DB 변경사항

```sql
-- 새 테이블: AI 가이드 캐시
CREATE TABLE ai_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,       -- "원룸_월세_용달_true"
  master_version integer NOT NULL,       -- 마스터 데이터 버전 (변경 시 캐시 무효화)
  guides jsonb NOT NULL,                 -- [{id, custom_guide}, ...]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- user_checklist_items에 컬럼 추가
ALTER TABLE user_checklist_items ADD COLUMN custom_guide text;
```

### 4-7. 에러 처리

| 상황                    | 처리                                      |
| ----------------------- | ----------------------------------------- |
| API 호출 실패           | 기존 guide_content 폴백, 에러 로깅        |
| 응답 JSON 파싱 실패     | 기존 guide_content 폴백, 재시도 가능      |
| 응답에 특정 항목 누락   | 해당 항목만 기존 guide_content 사용       |
| 캐시-마스터 버전 불일치 | 캐시 무효화 → 자동 재생성                 |
| 비회원 남용             | IP rate limit (1일 3회)                   |
| 동시 요청 중복 호출     | 무시 (비용 미미, 나중 결과가 캐시 덮어씀) |
| API 응답 지연 (5~10초)  | 로딩 UX 또는 백그라운드 생성 후 갱신      |

### 4-8. 면접 포인트

- "단순 CRUD가 아니라 LLM을 프로덕션에 적용하면서 생기는 실제 문제를 해결한 경험"
- 프롬프트 설계, 조건별 캐싱으로 비용 고정비화, API 실패 시 폴백, 법적 정보 할루시네이션 리스크 관리
- "국내외 이사 앱 중 유일한 AI 기능"

---

## 5. 집 상태 기록 설계

### 5-1. 방 목록

6개 고정: entrance, room, bathroom, kitchen, balcony, other

- "기타" 선택 시 location_detail 컬럼에 자유 입력 (스키마 변경 없이 활용)
- 입주/퇴실 토글로 구분, 리포트는 집기록 탭 하위 화면

### 5-2. 사진 증거력 4단계

1. EXIF 메타데이터 추출 (촬영시간/GPS → DB 저장)
2. SHA-256 해시값 (Web Crypto API → DB image_hash 컬럼)
3. 서버 타임스탬프 (Supabase uploaded_at 자동)
4. 이메일 리포트 발송 (제3자 타임스탬프, 회원 전용 → 가입 유도 포인트)

- 카카오 알림톡: 사업자등록/딜러사 계약/건당 비용/템플릿 심사 → MVP에서 비현실적
- RFC 3161 TSA: 오버엔지니어링 → 이메일로 충분
- DB 변경: property_photos에 image_hash(text) 컬럼 추가

### 5-3. 사진 촬영 시 가입 유도 (v2 신규)

- 비회원이 사진 촬영 시 → 로그인 안내 팝업 (강제 아님)
- 로그인 선택 → 서버 업로드 (안전)
- 기기 저장 선택 → IndexedDB 저장 + 경고 배너 유지
- 이 시점이 가입 전환율이 가장 높을 것으로 예상 (증거 사진 보호 동기)

---

## 6. 스마트 재배치 로직

### 6-1. 4모드 (남은 기간 기준)

- 여유 모드 (30일+): 현재 설계 그대로, d_day_offset 기준 날짜 배치
- 빠듯 모드 (14~29일): 과거 항목 → 오늘~7일 재배치
- 급한 모드 (7~13일): "지금 바로"/"이번 주"/"이사 전날"/"이사 당일" 4단계 재그룹핑
- 초급한 모드 (1~6일): 필수만 강조, 나머지 "여유 되면" 접힘

### 6-2. 모드별 UI 텍스트 변경

```
여유: "밀린 할 일" / "12/22 완료"
빠듯: "먼저 챙기면 좋은 것" / "12/22 완료"
급한: "지금 바로" / "필수 2/5 완료"
초급한: "꼭 해야 할 것" / "필수 2/5 완료" + "다 못해도 괜찮아요"
```

### 6-3. 구현 방식

- DB 변경 없음 — 프론트엔드 표시 레이어에서 처리
- assigned_date는 원래 날짜 유지, 표시용 날짜만 프론트에서 오버라이드
- 텍스트를 상수 파일 하나에 모드별로 관리
- 진행률: 여유/빠듯 → 전체 기준, 급한/초급한 → 필수(is_skippable=false) 기준

### 6-4. 2달+ 여유 유저의 빈 기간 처리

- "여유 대시보드" 패턴: D-Day 카운터 + "아직 여유 있어요" 메시지
- "지금 할 수 있는 한 가지" → 퇴실 사진 미리 찍기 유도 (핵심 기능 F4 체험)
- "앞으로의 일정 미리보기" 읽기 전용 리스트

---

## 7. WebView/네이티브 아키텍처

### 7-1. Apple Guideline 4.2 대응

네이티브(Expo)로 반드시 해야 하는 것:

- 하단 탭바 (3탭 네이티브)
- 소셜 로그인 (Apple/카카오/Google 네이티브 SDK)
- 카메라 접근 (네이티브 카메라 API + EXIF 추출)
- 푸시 알림 기반 (v1.1이지만 세팅은 미리)
- 스플래시 스크린 + 앱 아이콘
- 오프라인 처리
- 인증 토큰 관리 (Expo SecureStore)

WebView(React 웹앱)로 하는 것:

- 대시보드, 타임라인, 항목 상세, 상태 리포트, 온보딩, 설정

### 7-2. 네이티브 ↔ 웹 통신

- Expo(react-native-webview) 환경에서 postMessage + injectJavaScript 방식
- 브릿지 추상화 레이어(NativeBridge 클래스)로 사용 측에서는 bridge.openCamera() 형태로 호출

### 7-3. 브릿지 메시지 타입

```typescript
// 웹 → 네이티브
type WebToNative =
  | { type: 'OPEN_CAMERA'; room: string }
  | { type: 'REQUEST_LOGIN' }
  | { type: 'REQUEST_LOGOUT' }
  | { type: 'SHARE_PDF'; url: string }
  | { type: 'OPEN_EXTERNAL_LINK'; url: string }

// 네이티브 → 웹
type NativeToWeb =
  | { type: 'AUTH_SESSION'; token: string; user: object }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'PHOTO_TAKEN'; uri: string; exif: object; hash: string }
  | { type: 'NETWORK_STATUS'; online: boolean }
```

### 7-4. 빅테크 참고 패턴

- 토스: React Native 마이크로 프론트엔드 (Shared번들 + Service번들 동적 로드)
- 당근: 네이티브(Swift/Kotlin) + WebView 하이브리드 (변경 잦은 화면만 웹)
- 이 앱: 동일 패턴, 1인 개발 규모에 맞게 웹 비중 조절

---

## 8. Apple App Store 필수 체크리스트

- [ ] 개인정보처리방침 URL (앱 내 + App Store Connect)
- [ ] 계정 삭제 기능 (설정 > 계정 삭제)
- [ ] Sign in with Apple (서드파티 로그인 제공 시 필수)
- [ ] 로그인 강제 금지 (비회원도 핵심 기능 사용 가능)
- [ ] App Store 개인정보 라벨 (수집 데이터 명시)

---

## 9. 마스터 체크리스트 검증 및 보완

### 9-1. 검증 결과 (2026년 3월 26일)

- 45개 전체 검증 완료
- ✅ 정확 32개(71%), ⚠️ 보완 필요 13개(29%), ❌ 부정확 0개

### 9-2. 즉시 수정 필요 (Supabase 시드 데이터에 반영):

1. #31 한전 앱: "스마트 한전" → "한전ON"
2. #41 전입신고: 정부24 모바일 동시 처리, 수수료 500원
3. #01 이사 비용: 2026 시세 반영 (원룸 용달 5~15만, 반포장 20~35만, 포장 35~70만)
4. #13 전입신고 서류: 온라인 동시 처리 가능

### 9-3. Threads 분석 기반 보완사항 (v2 신규)

**새 항목 추가:**

- #46 새 집 사전 실측 (D-14): 현관문/엘리베이터 폭, 가구/가전 사이즈 확인, 세탁기 배수구 위치, 커튼 높이 측정

**가이드 내용(guide_content) 보강:**

- #38 새 집 하자 체크: 수압 확인, 배수구 위치, 샤워기 누수, 벽지/타일 마감, 소음 확인, 인터폰 작동 등 세부 가이드 추가
- #03 인터넷 이전: "당일 오전 설치 피하기" 팁 + "공유기/모뎀/셋탑박스/리모컨 미리 준비" 추가
- #44 주소변경: KT Moving 서비스 정보 추가 (200개 기관 일괄 변경, KT 미사용자도 가능)
- #23 우편물 주소이전: 기간 수정 (3개월 → 최대 1년 선택 가능)
- #39 짐 하차: 가전 설치 순서 팁 추가 (냉장고 먼저 → 세탁기)
- #10 폐가전 수거: "빼기" 앱, "한국그린센터" 대안 서비스 정보 추가

**guide_url 대폭 확충 (4~5개 → 15개+):**

- 빼기 앱 (대형폐기물), 가스앱 (도시가스 전출/전입), 정부24, KT Moving, 인터넷우체국, 폐가전무상배출예약시스템, 짐싸/짐카/이사모아 (견적 비교 안내), 숨고/미소 (입주청소) 등
- 복수 서비스 중립적 나열 (특정 업체 추천 아님)

**housing_types 옵션 추가:**

- 기존: 원룸, 오피스텔, 빌라, 투룸+
- 변경: 원룸, 오피스텔, 빌라, **아파트**, 투룸+
- 아파트 세입자(전세/월세)만 커버, 신축 입주/매매는 스코프 밖
- 사전점검(470개 항목)은 별도 서비스 영역 — 새집엔, 홈체크 등이 이미 존재

### 9-4. 앱 면책 문구

> 이 가이드는 참고용이며, 정확한 절차와 비용은 관련 기관에 직접 확인해주세요.
> 법적 사항은 전문가 상담을 권장합니다.

---

## 10. 경쟁 서비스 분석 (v2 업데이트)

### 10-1. 한국 시장

- 짐싸, 짐카, 이사모아: 견적 비교/업체 연결에 집중. 이사 과정 관리 없음. **AI 기능 없음.**
- 다방, 오늘의집: 정적 체크리스트 블로그 콘텐츠만 제공
- 아파트너, 새집엔, 홈체크: 신축 아파트 사전점검 특화 (타겟 다름)

### 10-2. 해외

- MoveAdvisor: 가장 가까운 경쟁자 (타임라인+체크리스트+인벤토리), 영어 전용/미국 최적화. **AI 기능 없음** — 규칙 기반 로직만.
- Sortly: 짐 인벤토리 특화 (사진 기반 카테고리 관리)
- Pro Moving Planner: 가구 배치/예산 추적

### 10-3. 빈 포지션 (v2 강화)

"이사 과정 관리 + 집 상태 기록 + **AI 맞춤 가이드** + 한국 청년 세입자 최적화" 조합은 국내외 없음.
업체 연결은 의도적으로 제외 — 짐싸/짐카가 이미 하고 있고, 1인 개발로 업체 DB 구축은 비현실적. 체크리스트 가이드에서 외부 서비스로 중립적 안내.

---

## 11. DB 스키마 변경사항 (기획서 대비)

### 기존 변경

- property_photos 테이블에 image_hash(text) 컬럼 추가 (SHA-256 해시)

### v2 추가 변경

- ai_guide_cache 테이블 신규 (캐시 키, 마스터 버전, 가이드 JSON)
- user_checklist_items에 custom_guide(text) 컬럼 추가
- housing_types CHECK 제약조건에 '아파트' 추가
- 나머지 스키마는 기획서 그대로 유지

---

## 12. 면접 대비 핵심 포인트

### 기존

- "왜 3탭인가?" → MVP 핵심 기능 3개, 확장 시 4탭 전환 계획
- "사진 증거력?" → 4단계 (EXIF+해시+서버타임스탬프+이메일), RFC 3161 검토 후 이메일 선택
- "왜 postMessage?" → Expo 환경 표준, 브릿지 추상화로 Interface 방식과 동일한 DX
- "WebView인데 앱스토어 통과?" → Guideline 4.2 대응 (네이티브 탭바/카메라/오프라인/소셜로그인)
- "빅테크와 비교?" → 토스(RN 마이크로FE), 당근(네이티브+WebView 하이브리드)과 동일 패턴
- "프로필 왜 없나?" → 도구형 앱, 소셜 로그인으로 계정 식별 충분
- "가이드 정확성?" → critical 항목 공식 법령 검증, 서버 DB라 앱 업데이트 없이 수정 가능
- "스마트 재배치?" → DB 변경 없이 프론트 표시 레이어에서 4모드 전환, 격려형 UX
- "왜 순수 RN이 아니라 Expo?" → 네이티브 빌드 삽질 대신 기능 개발에 시간 투자

### v2 추가

- "AI를 왜 넣었나?" → 국내외 이사 앱 전부 AI 없음, 정적 체크리스트와의 차별화. 같은 항목이어도 유저 상황에 맞게 가이드 톤/내용이 달라짐.
- "AI 비용은?" → 조건 조합별 캐싱으로 전체 ~1,600원 1회성, 이후 유저 수 무관하게 0원. 스케일 후에는 회원 전용으로 전환해 비용 통제 + 가입 유도.
- "할루시네이션 리스크?" → AI가 새 정보를 만드는 게 아니라 기존 가이드를 유저 눈높이에 맞게 재작성. 원본 가이드가 정답 역할. 법적 정보 면책 문구 포함.
- "업체 연결은 왜 안 넣었나?" → 짐싸/짐카가 이미 잘 하는 영역, 1인 개발로 업체 DB 구축 비현실적. 가이드에서 외부 서비스로 중립 안내. 스코프 조절 판단.
- "아파트는 왜 신축 빼고 세입자만?" → 신축 입주 사전점검은 470개 항목 별도 영역, 새집엔/홈체크가 이미 존재. 타겟(잦은 이사 세입자) 리텐션 구조와 안 맞음. 코어 타겟 집중 판단.
- "가입 유도 전략?" → 사진 촬영 시점이 가장 강력 (증거 보호 동기). 강제가 아니라 안전/편의 차이로 유도. Apple 정책 준수.

---

## 13. 다음 단계 (개발 로드맵)

### 2단계: 프로젝트 초기 세팅

- React + Vite + TypeScript 프로젝트 생성
- 폴더 구조 (서비스 레이어 패턴: services/ → hooks/ → components/)
- Tailwind 설정 (디자인 토큰 반영)
- ESLint + Prettier
- TypeScript 타입 정의 (DB 스키마 기반)
- Git 초기화

### 3단계: Supabase 세팅

- DB 테이블 생성 (5개 + image_hash 컬럼 + ai_guide_cache 테이블 + custom_guide 컬럼)
- RLS 정책, Auth(Apple/카카오/Google), Storage
- 마스터 체크리스트 시드 데이터 (46개, 검증+Threads 분석 반영)
- Supabase Edge Function 세팅 (AI 가이드 생성용)

### 4단계: 핵심 기능 개발

- 온보딩 (4단계 폼, 첫이사 여부 추가) → 대시보드 → 타임라인 → 항목 상세 (AI 가이드 표시) → 집 상태 기록 → 리포트

### 5단계: AI + 인증 + 증거력

- Edge Function + Claude API 연동, 캐싱 로직
- 소셜 로그인, 비회원→회원 마이그레이션
- 사진 촬영 시 가입 유도 UX
- EXIF+해시, 이메일 리포트

### 6단계: 배포 준비

- Vercel(웹앱), Expo 빌드, 개인정보처리방침/이용약관, 스토어 등록

### 7단계: 출시 후

- 랜딩 페이지, 분석 도구, 유저 피드백 루프, v1.1 계획

---

## 14. 기술적 의사결정 기록 (ADR) —

### ADR-001: Expo 선택 (vs Capacitor, vs 순수 RN)

- 결정: Expo (React Native)
- 이유: 앱스토어/플레이스토어 양쪽 배포 목표, EAS Build로 클라우드 빌드 가능
- 트레이드오프: 웹 버전 코드 공유 제한 (별도 React 웹앱 필요)

### ADR-002: React(Vite) 선택 (vs Next.js)

- 결정: React + Vite
- 이유: WebView 안에서 동작하는 SPA라 SSR 불필요. 서버 컴포넌트/클라이언트 컴포넌트 구분 같은 불필요한 복잡도 제거. Supabase 클라이언트 SDK로 직접 통신하니 API Routes 불필요. Vite 빌드가 빠르고 정적 파일 결과물이라 배포 유연
- 트레이드오프: SEO 없음 (WebView 안이라 필요 없음). 랜딩 페이지가 필요하면 별도 Next.js 앱 추가 (모노레포)

### ADR-003: Supabase 선택 (vs Firebase)

- 결정: Supabase
- 이유: PostgreSQL 기반으로 관계형 데이터(유저↔이사↔체크리스트)에 자연스러움. RLS로 보안 처리. Auth+Storage 통합. SQL 기반이라 면접에서 DB 설계 설명 용이
- 트레이드오프: Firebase 대비 실시간 기능 약간 제한 (이 앱에서는 불필요)

### ADR-004: 오프라인 전략 — IndexedDB + 동기화

- 결정: 핵심 기능(사진 촬영, 체크리스트) 오프라인 동작
- 이유: 이사 당일 새 집에 인터넷 없는 시나리오 대응. 서비스 핵심 순간에 못 쓰면 치명적
- 구현: Service Worker(캐싱) + IndexedDB(데이터/사진 저장) + 온라인 복귀 시 자동 동기화

### ADR-005: 상태관리 분리 — TanStack Query + Zustand

- 결정: 서버 상태는 TanStack Query, 클라이언트 상태는 Zustand
- 이유: 서버 데이터(체크리스트, 사진)는 캐싱, 낙관적 업데이트, 백그라운드 리페칭이 필요하고, UI 상태(모달, 현재 이사 ID)는 불필요. 하나의 도구로 둘 다 관리하면 역할이 뒤섞임
- 트레이드오프: 라이브러리 2개 학습 필요. 하지만 둘 다 API가 작아서 학습 비용 낮음

### ADR-006: 서비스 레이어 패턴 (과도한 추상화 지양)

- 결정: services/ 폴더에 순수 함수로 분리. Interface/Repository 패턴은 미사용
- 이유: 관심사 분리(데이터 호출 vs 상태 관리 vs UI)가 주 목적. 구현체가 Supabase 하나뿐이라 Interface는 불필요한 추상화. "2번 이상 쓰이는가?" 기준으로 분리 판단
- 트레이드오프: 백엔드 교체 시 Interface가 없어서 서비스 함수 내부를 직접 수정해야 함. 하지만 그 시점에 추상화해도 늦지 않음

### ADR-007: Vite 선택 (vs CRA)

- 결정: Vite
- 이유: CRA는 2023년에 유지보수 중단. 공식 React 문서에서도 비추천. 2025-2026년 기준으로 React SPA의 표준 빌드 도구가 Vite. CRA를 쓰면 면접에서 "deprecated된 도구를 왜 썼나" 질문 가능
- 비교 대상이 아님: CRA vs Vite 비교가 아니라, CRA가 선택지에서 이미 빠진 상태

### ADR-008: Supabase 확장성 판단

- 결정: MVP~MAU 1만 수준까지 Supabase 유지. 그 이상은 그때 판단
- 근거: 이사 앱 특성상 유저당 데이터 매우 작음 (체크리스트 20개 + 사진 10-20장). Supabase Free(500MB DB, 1GB Storage)로 MVP 충분. Pro($25/월)면 MAU 1만도 커버
- Supabase 한계가 오는 시점: 복잡한 백그라운드 잡, 커스텀 인증 플로우, 대량 외부 API 연동 등이 필요해질 때. 이때 서비스 레이어 패턴(ADR-006) 덕분에 교체 비용 최소화 가능

### ADR-009: AI 맞춤 가이드 도입

- 결정: 체크리스트 항목별 AI 맞춤 가이드 생성 (조건별 캐싱)
- 이유: 국내외 이사 앱 중 AI 기능 전무 → 명확한 차별화. 면접에서 "LLM 프로덕션 적용 경험" 어필.
- 트레이드오프: API 비용 발생하지만 캐싱으로 1,600원 1회성. 프롬프트 품질 튜닝에 시간 필요.

### ADR-010: Supabase Edge Function 선택 (API 키 보안)

- 결정: Claude API 호출을 Edge Function에서 처리 (프론트 직접 호출 안 함)
- 이유: API 키가 클라이언트에 노출되면 보안 위험. Edge Function은 서버리스라 별도 서버 없이 안전하게 호출 가능.
- 트레이드오프: Edge Function 학습 비용. 하지만 Supabase 생태계 안이라 러닝커브 낮음.

### ADR-011: 가입 유도 시점 변경 (사진 촬영 시)

- 결정: 기존 Step 9(이사 완료 후)에 더해, 사진 촬영 시점을 1차 가입 유도로 추가
- 이유: 사진 = 보증금 증거. "증거 사진 보호"가 가장 강한 가입 동기. 이사 완료 후보다 전환율 높을 것으로 예상.
- 트레이드오프: 촬영 플로우에 팝업이 추가되어 UX 마찰 약간 발생. 하지만 "기기에만 저장" 옵션으로 강제 아님.

### ADR-012: 아파트 세입자 커버 (신축 입주 제외)

- 결정: housing_types에 "아파트" 추가하되, 신축 입주/매매 관련 항목(사전점검 등)은 추가 안 함
- 이유: 아파트 세입자의 이사 여정은 오피스텔/빌라 세입자와 거의 동일. 신축 입주는 타겟/경쟁/리텐션 구조가 완전히 다른 별도 영역.
- 트레이드오프: 신축 아파트 입주자는 커버 못 함. 하지만 코어 타겟(잦은 이사 세입자)에 집중하는 게 1인 개발에서 맞는 판단.

### ADR-013: 업체 연결 미구현

- 결정: 이사업체/청소업체 연결 기능 미구현. 체크리스트 가이드에서 외부 서비스(짐싸, 숨고 등)로 중립적 안내.
- 이유: 업체 매칭은 짐싸/짐카/이사모아가 이미 포화. 1인 개발로 업체 DB/계약/CS 구축 비현실적. 앱 정체성("관리 도구")이 흐려짐.
- 트레이드오프: 수익화 기회 일부 포기. 하지만 스코프를 적절히 조절해 핵심 가치에 집중.

### ADR-014: 첫 이사 여부는 AI 가이드 조건에서 제외

- 결정: AI 맞춤 가이드를 만들 때 “첫 이사인지 여부”는 조건으로 사용하지 않는다. DB에는 첫 이사 여부를 저장할 수 있는 값이 있지만, 7단계 AI 캐시 키와 프롬프트 분기에는 포함하지 않는다. (`moves.is_first_move`)
- 이유: 첫 이사 여부로 내용이 크게 달라지는 항목은 적고, 대부분은 표현 난이도 차이에 가깝다. 이 조건을 넣으면 캐시 조합이 40개에서 80개로 늘어난다.
- 대안: 프롬프트에서 모든 유저가 이해할 수 있도록 전문 용어를 쉽게 풀어쓰게 한다.
- 트레이드오프: 첫 이사 전용 개인화는 약해지지만, 온보딩과 캐시 구조가 단순해진다.

### ADR-015: AI는 전체 가이드가 아니라 참고 문구만 보강

- 결정: AI는 체크리스트의 절차나 준비물은 바꾸지 않고, 상세페이지의 참고 문구만 맞춤형으로 보강한다. (`custom_guide`)
- 이유: 절차와 준비물은 사실 정보라 잘못 바뀌면 위험하다. 반면 참고 문구는 유저 상황에 맞게 쉽게 풀어써도 위험이 낮다.
- 트레이드오프: 완전한 개인화는 아니지만, 기존 UI 구조를 유지하면서 AI 효과를 줄 수 있다.

### ADR-016: 전세사기 예방 콘텐츠는 별도 단계로 분리

- 결정: 전세사기 예방, 계약 전 확인사항, 분쟁 대응 같은 법률성 콘텐츠는 7단계 AI 기능에 섞지 않고 별도 단계에서 추가한다.
- 이유: 7단계는 AI 호출, 캐싱, Edge Function 구현이 핵심이다. 법률성 콘텐츠까지 같이 넣으면 스코프가 너무 커지고 검증 부담도 커진다.
- 트레이드오프: v1.0의 보증금 보호 포지션은 약해지지만, AI 기능 구현 범위를 안정적으로 유지할 수 있다.

### ADR-017: 기존 AI 캐시 테이블을 새로 만들지 않고 확장

- 결정: AI 가이드 캐시 테이블은 이미 1단계에서 만들어졌기 때문에, 7단계에서는 새로 만들지 않고 “생성 중 상태를 기록하는 컬럼”만 추가한다. (`ai_guide_cache.generating_at`)
- 이유: 같은 테이블을 다시 생성하면 마이그레이션이 실패한다. 기존 테이블을 확장하는 방식이 실제 DB 상태와 맞다.
- 트레이드오프: 초기 스키마와 7단계 요구사항이 나뉘지만, 마이그레이션 이력이 명확해진다.

### ADR-018: AI 생성에 필요한 데이터는 서버에서 직접 조회

- 결정: 클라이언트는 AI 생성 요청 시 현재 이사 ID만 보낸다. 주거유형, 계약유형, 이사방법, 체크리스트 내용은 Edge Function이 DB에서 직접 조회한다. (`moveId`)
- 이유: 클라이언트가 체크리스트 내용을 조작해서 보내면, 조건별 AI 캐시가 오염될 수 있다. 캐시는 여러 유저가 공유하므로 서버 데이터를 기준으로 만들어야 한다.
- 트레이드오프: Edge Function 안에서 DB 조회가 늘어나지만, 보안과 데이터 정합성이 좋아진다.

### ADR-019: 같은 조건의 AI 중복 생성을 막는다

- 결정: 같은 조건 조합에 대해 AI 가이드가 동시에 여러 번 생성되지 않도록 DB 함수로 잠금 처리를 한다. (`claim_ai_guide_generation`)
- 이유: 동시에 요청이 들어오면 같은 AI 가이드를 여러 번 생성해 비용이 낭비될 수 있다. DB에서 원자적으로 잠금을 잡으면 중복 호출을 막을 수 있다.
- 트레이드오프: SQL 함수가 하나 추가되지만, 외부 AI API 비용과 race condition을 줄일 수 있다.

### ADR-020: 상세페이지를 보는 중에는 AI 문구가 갑자기 바뀌지 않게 한다

- 결정: 유저가 상세페이지를 보고 있는 동안에는 AI 가이드가 생성 완료되어도 화면 내용을 즉시 바꾸지 않는다. 처음 진입했을 때의 값을 유지하고, 다시 들어왔을 때 최신 값을 보여준다.
- 이유: 읽는 중에 텍스트가 갑자기 바뀌면 버그처럼 느껴질 수 있다. AI는 조용히 보강되는 기능이어야 한다.
- 트레이드오프: 첫 진입 중 AI 생성이 끝나도 바로 보이지 않는다. 대신 다음 진입부터 자연스럽게 반영된다.

### ADR-021: AI 가이드 모델을 Sonnet에서 Haiku로 전환

- 결정: Edge Function의 기본 AI 모델을 `claude-sonnet-4-6`에서 `claude-haiku-4-5-20251001`로 변경한다.
- 이유: 실측 결과 Sonnet은 37개 항목 생성에 ~120초 소요되어 Supabase Edge Function 무료 티어 wall-clock 한도(150초)에 근접했다. Haiku는 동일 작업을 ~60초에 완료하며, 비용도 조합당 150원→40원으로 ~75% 절감된다. 37개 항목 전량 생성 성공(stop_reason: end_turn), 한국어 품질도 가이드 재작성 용도에 충분하다.
- 실측 데이터:
  - Sonnet: 119,505ms / 5,667 input + 6,304 output tokens / ~53 tok/sec / 조합당 ~150원
  - Haiku: ~60,000ms / 5,667 input + ~5,700 output tokens / ~95 tok/sec / 조합당 ~40원
- 트레이드오프: Sonnet 대비 복잡한 맥락 추론이나 미묘한 톤 조절이 약해질 수 있다. 하지만 이 기능은 기존 가이드를 유저 조건에 맞게 재작성하는 것이라 사실 정보 생성이 아닌 재구성 작업이므로 Haiku로 충분하다. 필요 시 `ANTHROPIC_MODEL` 환경변수로 재배포 없이 Sonnet으로 복원 가능.

### ADR-022: 프롬프트 버전을 캐시 키에 포함 + 크로스오염 방지 규칙

- 결정: `CHECKLIST_GUIDE_PROMPT_VERSION`을 도입하고 캐시 키에 포함시킨다. 프롬프트 규칙에 항목 간 크로스오염 방지 규칙(2번, 3번, 6번)을 추가한다.
- 이유: Codex 리뷰에서 AI가 항목 A의 기관명·URL을 항목 B에 섞어 넣는 크로스오염 사례가 발견됐다. 또한 프롬프트 수정 시 이전 캐시가 계속 사용되면 수정 효과가 즉시 반영되지 않는 문제가 있었다.
- 구현:
  - 캐시 키: `${housing_type}_${contract_type}_${move_type}_${prompt_version}` (기존 3요소에서 4요소)
  - 프롬프트 v1.0.1: 규칙 7개 → 9개. 항목별 독립 작성 강제, 원본에 없는 정보 추가 금지, 용어 풀이 시 새 절차 추가 금지
  - 마이그레이션 00010: sort_order 오프셋 보정 (확정일자·도배장판 내용이 잘못된 행에 들어간 것 수정)
  - 마이그레이션 00011: `claim_ai_guide_generation` INSERT 성공 시 즉시 true 반환하도록 수정
- 트레이드오프: 프롬프트 버전 변경 시 전체 캐시가 무효화되어 첫 요청에 API 호출이 발생한다. 하지만 조합 수가 제한적(최대 40개)이므로 비용 영향은 미미하다.

### ADR-023: 정책 단일 출처

- 결정: `.claude/policies/auto-fix-scope.md`를 단일 출처로 하고, L1(pre-commit)/L2(CI)/L3(봇) 모두 이 파일을 참조
- 대안: (A) 각 시스템에 룰 복사 → 변경 시 동기화 누락 위험 / (B) 단일 출처 (채택) → 변경이 한 곳에서 끝남, 시스템마다 "정책 출처" 명시로 미참조 방지 / (C) 코드 상수 → .claude는 마크다운 위주 환경이라 부적합
- 근거: 1인 운영 환경에서 룰 분기 관리는 불가능에 가깝다. 단일 출처가 현실적.

### ADR-024: 거부 범위 가드는 코드, 의미 분석은 에이전트

- 결정: 결정적 검증(거부 경로/패턴)은 `check-scope.ts`로, 의미 분석(보안/품질)은 sub-agent로 분리
- 대안: (A) 모두 sub-agent → LLM의 비결정성으로 거부 범위 놓침 위험 / (B) 모두 코드 → 의미 분석 불가능 / (C) 코드 + 에이전트 분리 (채택) → 안전성 + 깊이 둘 다 확보
- 근거: 보안/안전 가드는 결정적이어야 한다. LLM 판단은 의미 영역에서만 가치 있다.

### ADR-025: pre-commit/pre-push 분리

- 결정: pre-commit은 1초 미만 검증만(lint-staged), pre-push에서 typecheck + lint 전체 실행
- 대안: (A) pre-commit에 모든 검증 → 사람이 `--no-verify`로 우회 시작 / (B) pre-push에 모든 검증 → 커밋 단계에서 잘못된 포맷 통과 / (C) 분리 (채택) → 빠른 피드백(commit) + 안전망(push) 균형
- 근거: 1초 룰을 깨면 무력화된다. 실측 결과 lint-staged는 항상 1초 미만.

### ADR-026: commitlint scope는 8단계에선 강제 안 함

- 결정: type(feat/fix/refactor/...)과 subject 형식만 강제. scope 누락 허용
- 대안: (A) scope 강제 → 1인 개발 시 작은 커밋에서 짜증, `--no-verify` 시작 / (B) scope 권장만 (채택) → 자유도 유지, MVP 출시 후 강제로 변경 검토
- 근거: 강제 룰이 무력화되면 룰이 없는 것보다 나쁘다. 단계적 도입.

### ADR-027: test-writer 에이전트 미도입

- 결정: 자동 테스트 작성 에이전트(test-writer)를 만들지 않음
- 대안: (A) test-writer 도입 → 트리비얼 테스트만 양산 + 코드에 맞춘 테스트(역방향 TDD) 위험 / (B) 미도입 (채택) → 테스트는 메인 세션 또는 사람이 직접 작성
- 근거: 테스트는 "코드가 무엇을 보장하는가"의 정의. LLM이 코드 컨텍스트 없이 짜면 가짜 안전감만 생성.

### ADR-028: pr-summarizer는 평가 금지, 사실 요약만

- 결정: pr-summarizer 에이전트가 코드 평가/의견 표명 금지. 사실 기반 요약만
- 대안: (A) 평가 포함 → "잘 짜졌습니다" 같은 무가치 칭찬 + LLM 추측 노출 / (B) 사실만 (채택) → 변경 통계, 영향 영역, 검증 권장 사항만
- 근거: 평가는 다른 전담 에이전트의 역할. pr-summarizer는 "사람의 리뷰 시작점"을 제공.

### ADR-029: web/native a11y 에이전트 분리

- 결정: WCAG/ARIA(Web)와 RN accessibility props(Native)를 별도 에이전트로 분리
- 대안: (A) 단일 에이전트 → 룰셋이 너무 달라 어느 쪽도 깊지 못함 / (B) 분리 (채택) → 도메인별 깊이 확보, native는 9단계(Expo 셸)부터 활성
- 근거: WCAG는 데스크탑/Web 중심, iOS HIG와 Material은 모바일 네이티브 중심. 같은 a11y라도 평가 기준 자체가 다름.

### ADR-030: L3 봇은 dry-run 우선, 점진 전환

- 결정: L3 자율 봇은 처음부터 apply 모드가 아닌 dry-run 모드로 시작
- 대안: (A) 처음부터 apply → 잘못된 patch가 PR로 만들어짐, 학습 곡선 가팔라짐 / (B) 단계 전환 (채택) → 1주 dry-run → 평가 → apply
- 근거: 시스템 신뢰는 점진적으로 구축됨. 처음 1주는 "어떤 식으로 동작하는지" 패턴 파악이 우선.

### ADR-031: 자동 머지 절대 금지

- 결정: 봇 PR은 사람이 직접 Approve + Merge. 자동 머지 규칙 절대 없음
- 대안: (A) auto-merge enable → "테스트 약화로 통과시키는 가짜 수정"을 잡지 못함 / (B) 사람 승인 필수 (채택) → 봇은 제안, 사람은 결정
- 근거: 봇이 모든 안전 가드를 통과해도, 진짜 의미 있는 수정인지는 사람만 판단 가능.

### ADR-032: 시도 횟수 + fork 차단 + best-effort 관측 (defense in depth)

- 결정: 6단계 가드 (CI 실패 / pull_request 한정 / 봇 actor / fork 차단 / 모드 / 시도 횟수 + 일일 사용량 best-effort 관측)
- 대안: (A) 한 가드만 → 한 가드 깨지면 전체 무방비 / (B) 다층 (채택) → 한 가드 깨져도 다음 가드가 잡음 / (C) 일일 토큰 hard limit → runner stateless라 정확히 구현 불가능, best-effort 관측치로 대체하고 hard limit은 Anthropic Console에 위임
- 근거: 비용 폭주, 무한 루프, 시크릿 탈취 같은 사고는 한 번 나면 복구 비용이 큼. 중복 비용보다 안전이 우선. hard limit이 어려운 영역은 정직하게 best-effort 표시, 진짜 hard limit은 외부 시스템에 위임.

### ADR-033: budget-guard는 파일로 누적

- 결정: 일일 토큰 사용량을 별도 DB 없이 `docs/auto-fix-log/budget-{date}.json`에 누적
- 대안: (A) 외부 DB (Supabase 등) → 1인 사이드프로젝트엔 오버킬 / (B) GitHub Actions Cache → 만료 정책 복잡 / (C) 파일 (채택) → 단순, workflow_run에서 push 권한 필요
- 근거: 단순함이 우선. 한도 추적이 정밀할 필요 없음 (대략 한도 안인지만 확인).

### ADR-034: Expo 셸 먼저, 인증은 다음 단계로

- 결정: 원래 8단계(인증+RLS) → 9단계(Expo 셸)로 계획되어 있었으나 순서를 바꿈. 9단계에서 Expo 셸을 먼저 구축하고, 10단계에서 인증+RLS를 구현한다.
- 이유: DECISIONS.md에 "인증은 네이티브(Expo)가 전담"으로 확정. 소셜 로그인은 네이티브 SDK → Supabase Auth → SecureStore → WebView postMessage 구조. Expo 셸 없이 웹에서 인증을 구현하면 네이티브 전환 시 인증 코드 전체를 다시 짜야 함.
- 트레이드오프: 인증 없이 앱이 돌아가는 기간이 한 단계 더 늘어남. 하지만 guest_id 기반 비회원 사용이 이미 동작하므로 기능적 문제 없음.

### ADR-035: 탭별 WebView 3개 구조 (vs 단일 WebView)

- 결정: Expo Router Tabs에서 탭별로 독립 WebView를 보유하는 3개 구조로 구현. 단일 WebView + 커스텀 탭바는 채택하지 않음.
- 이유: Expo Router Tabs와 자연스럽게 통합. 탭 전환 시 WebView 리로드 없음 (unmountOnBlur=false). 구현 단순성. 9단계에서는 인증이 없으므로 세션 동기화 문제 없음.
- 트레이드오프: 10단계 인증 도입 시 AUTH_SESSION/AUTH_LOGOUT 메시지를 모든 활성 WebView에 브로드캐스트해야 함. 세션 동기화가 복잡해지면 단일 WebView + 커스텀 네이티브 탭바 구조로 전환 재검토.

### ADR-036: WebView 원격 URL 로드 (vs 로컬 번들)

- 결정: Vercel에 배포된 웹앱 URL을 WebView `source.uri`로 로드. 로컬 번들(앱 assets에 빌드 포함)이나 프리캐싱은 채택하지 않음.
- 이유: 웹앱 수정 시 앱스토어 업데이트 없이 Vercel 배포만으로 반영. 1인 개발에서 운영 부담 최소화. 스플래시 스크린으로 초기 로딩 커버.
- 트레이드오프: 네트워크 필수 (첫 실행 시). 오프라인 첫 실행 불가. 이사 당일 오프라인 대응은 10단계+에서 Service Worker/IndexedDB 프리캐싱 전략과 함께 재검토.

### ADR-037: 로그인 분기 랜딩 페이지 제거 + 트렌드 반영

- 결정: 기존 웹앱의 LandingPage를 삭제하고 EntryRedirect로 교체. 앱 시작 → 바로 온보딩/대시보드 진입. 로그인/비회원 분기 화면 없음.
- 이유:
  1. 트렌드: 도구형 앱은 가입/로그인 벽을 최대한 늦추는 방향. 토스, 당근 등 참고.
  2. Apple Guideline: 로그인 없이 핵심 기능 사용 가능해야 함.
  3. 아키텍처: 10단계에서 소셜 로그인은 네이티브 화면에서 처리. 웹의 랜딩 페이지를 재활용할 수 없음.
  4. 기존 회원 복귀 경로: 10단계에서 온보딩 우상단에 "로그인" 텍스트 버튼 추가 (브릿지 REQUEST_LOGIN).
- 트레이드오프: 기존 회원이 재설치 시 바로 로그인할 수 있는 진입점이 일시적으로 없음. 10단계에서 해결.

### ADR-038: 네이티브→웹 브릿지에 dispatchEvent 방식 채택

- 결정: 네이티브에서 WebView로 메시지를 보낼 때 `window.postMessage` 대신 `window.dispatchEvent(new MessageEvent('message', { data }))` 방식 사용.
- 이유: `window.postMessage`는 origin 체크가 복잡해질 수 있음. `dispatchEvent`는 같은 `message` 이벤트를 발생시키면서 origin 이슈가 없음. 웹 측 리스너(`window.addEventListener('message', ...)`)와 자연스럽게 호환.
- 트레이드오프: `dispatchEvent`는 표준 postMessage와 다른 호출 경로이므로, 서드파티 라이브러리가 `event.origin`을 체크하면 문제될 수 있음. 현재 앱에서는 자체 브릿지만 사용하므로 문제 없음.

### ADR-039: 네이티브 환경 플래그 사전 주입 (injectedJavaScriptBeforeContentLoaded)

- 결정: WebView의 `injectedJavaScriptBeforeContentLoaded`로 `window.__IS_NATIVE_WEBVIEW__ = true`와 `body.native-webview` 클래스를 콘텐츠 로드 전에 주입. `isNativeWebView()` 함수는 `__IS_NATIVE_WEBVIEW__`와 `ReactNativeWebView` 두 가지를 모두 체크.
- 이유: `window.ReactNativeWebView`는 react-native-webview가 주입하는데, 타이밍상 React 앱 마운트보다 늦을 수 있음. 이 경우 DevTabBar가 첫 렌더에서 잠깐 보이는 깜빡임 발생. `__IS_NATIVE_WEBVIEW__`를 먼저 주입하면 첫 렌더부터 정확하게 감지.
- 트레이드오프: 플래그가 두 개(`__IS_NATIVE_WEBVIEW__`, `ReactNativeWebView`)로 늘어남. 하지만 둘 다 같은 의미이므로 혼란 없음. `isNativeWebView()` 유틸로 추상화.

### ADR-040: 네이티브 카메라 전환은 인증 이후로 (9단계에서 미구현)

- 결정: 9단계에서는 기존 웹의 `<input type="file">` 방식을 WebView에서 그대로 사용하고, 네이티브 카메라(expo-image-picker/expo-camera)로의 전환은 10단계 이후로 미룸. 브릿지 프로토콜 타입만 정의.
- 이유:
  1. 네이티브 카메라 결과는 `uri` 기반, 기존 웹 업로드 로직은 `File` 객체 기반 → 변환 필요
  2. WebView로 base64를 넘기면 용량/성능 부담
  3. 네이티브가 직접 Supabase Storage에 업로드하려면 인증 토큰/세션 전달 구조 필요 → 10단계 인증이 선행되어야 함
- 트레이드오프: WebView 파일 업로드가 iOS/Android 특정 버전에서 동작하지 않을 수 있음. 이 경우 STATUS.md에 기록하고 10단계에서 네이티브 업로드로 전환.

### ADR-041: Native가 세션 소유자 (Session Owner)

- 결정: 네이티브 앱(Expo)이 Supabase 세션의 유일한 소유자. WebView는 세션을 직접 관리하지 않고, 네이티브로부터 브릿지를 통해 주입받는다.
- 이유: WebView가 독립적으로 세션을 갱신하면 네이티브와 토큰이 어긋남. 한쪽이 갱신한 refresh token을 다른 쪽이 모르면 401 루프 발생.
- 트레이드오프: WebView의 `autoRefreshToken: false`로 자체 갱신 비활성화 필수. 401 발생 시 네이티브에 갱신 요청하는 인터셉터 필요.

### ADR-042: Anonymous Sign-In으로 비회원 우선 UX

- 결정: 앱 첫 실행 시 Supabase `signInAnonymously()`로 즉시 익명 세션 생성. 온보딩·데이터 저장이 계정 생성 없이 가능.
- 이유: 회원가입 강제 시 이탈률 높음. 비회원으로 먼저 가치를 체험한 뒤 소셜 로그인으로 승격하는 패턴이 리텐션에 유리.
- 트레이드오프: 익명 사용자 데이터 소유권 관리 복잡도 증가. 디바이스 분실 시 데이터 복구 불가 (소셜 링킹 전까지).

### ADR-043: linkIdentity 우선, signInWithIdToken 폴백

- 결정: 익명→소셜 승격 시 `linkIdentity({ provider, token })` 우선 시도. 실패 시 `signInWithIdToken`으로 새 계정 생성 후 conflict 처리.
- spike 결과 (2026-05-20): ✅ 통과. 익명 user.id 유지 + is_anonymous false 전환 + Google identity 추가 확인.
- `as any` 캐스트 유지: SDK 타입 정의에 `token` 파라미터가 아직 없어 컴파일러가 인식 못 함(런타임 정상). 검증된 예외 — `tryLinkIdentity`에 사유 주석 필수. SDK 타입이 `token`을 명시하는 버전이 나오면 제거.
- 트레이드오프: linkIdentity는 Manual Linking beta 의존 (ADR-050). 폴백 경로는 user.id가 바뀌어 데이터 이전 RPC가 필요.

### ADR-044: Kakao는 Edge Function + magic link 경유

- 결정: Kakao는 OIDC 미지원이라 `signInWithIdToken` 직접 호출 불가. Edge Function에서 Kakao access_token → user info 조회 → `generateLink` + `verifyOtp`로 Supabase 세션 발급.
- 이유: Kakao OAuth는 id_token을 반환하지 않아 Supabase의 OIDC 검증 경로를 탈 수 없음.
- 트레이드오프: Edge Function 추가 홉, 응답 시간 증가 (~500ms). JWT secret이 Edge Function에만 존재해 클라이언트 노출 없음.

### ADR-045: Provider 추상화 (AuthProvider 인터페이스)

- 결정: Apple/Google/Kakao 각 로그인을 `AuthProvider` 인터페이스로 추상화. `authenticate()` → `AuthProviderResult` 반환.
- 이유: 로그인 화면(auth.tsx)이 provider 구현 세부사항을 모르게 함. provider 추가 시 인터페이스 구현체만 추가.
- 트레이드오프: 추상화 레이어 하나 추가. 현재 3개 provider로 충분히 정당화됨.

### ADR-046: 환경 분리 — 10-1은 dev 전용

- 결정: 10-1 단계 전체를 dev Supabase 환경에서만 개발·테스트. prod는 10-2에서 마이그레이션 완성 후 일괄 생성·적용.
- 이유: 마이그레이션이 00012까지만 적용된 prod를 10-2까지 방치하면 부분 적용 상태가 됨. dev에서 모든 마이그레이션을 검증한 뒤 prod에 일괄 적용이 깔끔.
- 트레이드오프: prod 환경 검증이 10-2로 밀림.
- ⚠️ **ADR-075로 대체 (10-3): prod Supabase 별도 미생성, 기존 dev 프로젝트를 prod로 통합 사용.**

### ADR-047: BridgeMessage wrapper 필수

- 결정: 네이티브↔웹 브릿지 메시지는 반드시 `{ type, payload }` wrapper 형식. raw 문자열 전송 금지.
- 이유: 메시지 타입 식별, 페이로드 구조화, TypeScript 타입 안전성. 타입별 핸들러 분기 명확.
- 트레이드오프: 없음. 구조화 비용 무시할 수준.

### ADR-048: Kakao custom mapping (auth_provider_links)

- 결정: Kakao identity는 Supabase `auth.identities`에 직접 등록되지 않으므로, `public.auth_provider_links` 테이블로 별도 매핑 관리.
- 이유: Edge Function의 `generateLink` + `verifyOtp` 흐름은 magiclink provider로 등록됨. Kakao 계정 식별자(kakao_id)와 Supabase user.id의 매핑을 앱 레벨에서 관리해야 중복 계정 방지 가능.
- 트레이드오프: 별도 테이블 관리 비용. RLS 활성화 필수 (service_role만 접근 — ADR 보안 감사에서 확인).

### ADR-049: WEB_READY 시 currentSession 즉시 주입

- 결정: WebView가 `WEB_READY` 메시지를 보내면 네이티브가 즉시 `AUTH_SESSION` 메시지로 현재 세션(access_token + refresh_token)을 주입.
- 이유: WebView의 `supabase.auth.setSession()`이 세션을 설정해야 API 호출 가능. 탭 전환 시 WebView가 재마운트될 수 있어 매번 주입 필요.
- 트레이드오프: 탭 전환마다 세션 주입 오버헤드. 토큰 크기 ~2KB로 무시할 수준.

### ADR-050: Manual Linking beta 기능 사용 + 모니터링 정책

- 결정: Supabase Manual Identity Linking은 현재 (2026.05) beta 단계. 그럼에도 익명→소셜 승격에 필수적이라 사용.
- 대안: (A) 사용 안 함 → 익명 user는 영구 회원 전환 불가 (이메일/비번 외). (B) 사용 (채택) — beta 리스크 감수.
- 모니터링 정책: supabase-js 버전 올릴 때마다 spike 재실행 / Supabase changelog 모니터링 / linkIdentity 실패율 Edge Function 로깅으로 추적 (10-2 추가).
- 트레이드오프: beta 변경 가능성 vs 익명 우선 UX 가치. 후자가 충분히 큼.

### ADR-051: Production Vercel을 10-1 동안 dev Supabase에 연결

- 결정: 10-1 작업 중 prod Supabase 외부 노출 위험 차단을 위해 production Vercel 환경변수에 dev Supabase URL/anon key를 임시 연결. 10-2 RLS 활성화 완료 시점에 prod로 스위치.
- 대안: (A) Vercel Deployment Protection (Pro $20/월). (B) production deployment 미생성. (C) dev 연결 (채택).
- 근거: 비용 0원, 환경 분리 인프라는 미리 구축, 실제 데이터 분리만 10-2 완료 시점에 활성화.
- 트레이드오프: production URL이 dev 데이터를 보여줌. 외부 비공개 정책으로 관리.
- ⚠️ **ADR-075로 대체 (10-3): dev/prod 통합으로 "임시 연결"이 영구가 됨. internal Vercel 배포도 같은 Supabase 사용.**

### ADR-052: Google Skip nonce checks ON

- 결정: Supabase Google provider의 "Skip nonce checks"를 ON으로 둔다.
- 배경: `@react-native-google-signin`은 코드 흐름상 nonce를 발급/전달하지 않음. Supabase가 id_token nonce를 검증하면 검증 대상이 없어 로그인 실패.
- 대안: (A) Skip ON (채택) — 즉시 동작, replay 방어 약화. (B) 라이브러리에 nonce 옵션 전달 + Skip OFF — 추가 작업 필요.
- 근거: id_token이 HTTPS 전송 + 짧은 만료시간이라 실질 replay 위험 낮음. Apple은 expo-apple-authentication이 nonce를 지원해 Skip 불필요.
- 개선 항목 (후속): Google에도 nonce 명시 전달해 Skip OFF 전환. 보안 강화 단계에서 검토.

### ADR-053: Apple/Google provider는 네이티브 Client IDs 검증 방식

- 결정: Supabase Apple/Google provider에 Client IDs(audience)만 등록, Apple Secret Key(.p8)는 미입력.
- 배경: 네이티브 SDK로 id_token을 받아 `signInWithIdToken`/`linkIdentity`로 검증하는 흐름은 id_token 서명 + audience 검증만 필요. Client Secret은 웹 OAuth redirect 흐름(authorization code → token 교환)에서만 사용.
- 근거: 네이티브 전용 단계에서 불필요한 시크릿 관리 제거. Apple Team ID/Key ID/.p8는 보관해 향후 웹 Apple 로그인 추가 시 사용.
- 트레이드오프: 웹 OAuth 확장 시 추가 설정 필요.

### ADR-054: linkIdentity 후 provider 갱신은 트리거가 주 경로

- 결정: `linkIdentity` 성공 시 `auth.users.raw_app_meta_data.provider`가 자동 갱신됨 (spike 실측). `on_auth_user_updated` 트리거가 `public.users.provider`를 갱신.
- `ensureUsersProviderUpdated`는 트리거 누락 시 fallback으로만 유지. 주 경로 아님.
- 배경: GPT v2 리뷰 #11이 "linkIdentity 후 provider 안 바뀔 수 있다"고 우려했으나, spike에서 자동 갱신 확인.

### ADR-055: 모바일 공개 키를 eas.json이 아닌 EAS Secrets + app.config.ts로 관리

- 결정: Supabase anon key, Kakao native app key, Google Client IDs 등 공개 키를 `eas.json` env 블록에 하드코딩하지 않고, `app.config.ts`에서 `process.env`로 참조. 로컬 개발은 `.env` (gitignored), EAS 빌드는 EAS Secrets에서 주입.
- 대안: (A) `eas.json`에 직접 기입 → gitleaks가 JWT 패턴(anon key)과 API key 패턴(Kakao)을 감지해 CI 실패. allowlist/baseline으로 억제 시도했으나 action v2 호환 문제 + baseline 파일 자체가 감지되는 이슈 발생. (B) `app.config.ts` + EAS Secrets (채택) → 키가 git 히스토리에 남지 않음.
- `app.json` → `app.config.ts` 전환: 카카오 `kakaoAppKey`, `CFBundleURLSchemes`, Google `iosUrlScheme`이 빌드 타임 값이라 동적 config 필수.
- 히스토리 정리: 과거 커밋에 키가 남아있어 `git rebase -i`로 fix 커밋을 원래 커밋에 fixup. feature branch이므로 rewrite 안전.
- 트레이드오프: EAS 빌드 전 `eas secret:create`로 키 등록 필요. 로컬 `.env` 파일 관리 필요.
- 참고 (디버깅용): `linkIdentity` 응답의 `user.identities`는 빈 배열로 오지만, 직후 `getUser()` 조회 시 정상 표시됨. 응답 즉시 identity 개수를 신뢰하지 말 것.

### ADR-056: RLS는 신규 마이그레이션(00016)에서 활성화, 00003 수정 안 함

- 결정: 적용된 00003 파일을 수정하지 않고, 00016에서 충돌 정책을 DROP 후 작업별 분리 재CREATE. `deleted_at` 필터는 RLS에서 제거하고 service query가 담당.
- 이유: 00003의 `FOR ALL ... AND deleted_at IS NULL`이 soft delete 복구/영구삭제를 깨뜨림(휴지통 기능). RLS는 소유권(`auth.uid()`)만 강제하고, active/deleted 구분은 service layer 책임.
- 트레이드오프: 00003과 00016을 함께 봐야 최종 정책을 파악. 00003에 "00016에서 교체됨" 주석으로 보완.

### ADR-057: Storage 경로를 `{userId}/{moveId}/{room}_{ts}` 표준화

- 결정: 6단계의 `{moveId}/{photoType}/{room}_{ts}` → `{userId}/{moveId}/{room}_{ts}`. photoType 세그먼트 제거(DB `photo_type` 컬럼이 담당).
- 이유: 인증 도입(10-2)이 6단계 단서 조건. 표준 Storage 정책(`foldername[1] = auth.uid()`)에 맞추려면 첫 세그먼트가 userId여야 함.
- 마이그레이션 비용 0: 기존 사진은 전부 테스트 데이터로 wipe 선행.

### ADR-058: rate limit을 DB 테이블 + 원자적 increment RPC로 구현

- 결정: Redis 대신 DB(`rate_limit_log` + `increment_rate_limit` RPC). `ON CONFLICT DO UPDATE RETURNING`으로 원자적 증가.
- 이유: 현재 트래픽 규모에서 폭주 차단 목적이지 정밀 통제가 아님. Redis는 외부 의존성·운영 복잡도 과다.
- IP는 `sha256(ip + RATE_LIMIT_SALT)` 저장(평문 금지). 보존 2일.
- 인터페이스 분리로 향후 Redis 전환 가능.

### ADR-059: ai_guide_cache는 service_role only 비공개

- 결정: 클라이언트 SELECT 정책 제거. RLS ENABLE + 정책 0개 = service_role만 접근.
- 이유: 클라이언트는 `user_checklist_items.custom_guide`만 읽으면 됨. 캐시는 Edge Function 내부 디테일(관심사 분리 + 구조 노출 방지). cacheKey 재료는 소유권 검증된 move row에서 서버가 직접 조회(cache poisoning 방지).

### ADR-060: 충돌 처리는 폴백 전용 안전망, RPC/contract/테스트만 10-2

- 결정: `migrate_anonymous_to_user` RPC 정의 + `keep_target` no-op만 허용. 미구현 전략은 RAISE EXCEPTION. 실제 호출·선택 UI는 10-3.
- 이유: linkIdentity가 메인 경로(user.id 유지 → 마이그레이션 불필요). 폴백 발동률을 모른 채 선택 UI를 만드는 건 과잉. conflict=true에서 조용한 병합/삭제/덮어쓰기 금지(데이터 손실 0).

### ADR-061: 외부 공개를 RLS 완료 조건에서 분리 (release-gate)

- 결정: prod 외부 공개(URL 공유, 환경변수 스위치)는 별도 release-gate로 분리. 10-2 완료 조건은 "RLS 켠 상태에서 내부 smoke test 통과"까지.
- 이유: 코드 완료와 운영 검증(디바이스 격리, 실기기, 토큰 만료 등)은 리스크 성격이 다름.

### ADR-062: public.users는 SELECT only (클라이언트 UPDATE/INSERT/DELETE 불허)

- 결정: users 테이블은 SELECT 정책만 생성. INSERT는 트리거(00013), provider 갱신도 트리거(ADR-054).
- 이유: `provider`는 migrate RPC의 anonymous 판정에 쓰이는 보안성 컬럼. RLS는 컬럼을 못 막으므로 UPDATE 자체를 닫아 provider 위조 차단. users UPDATE가 열리면 클라이언트가 provider를 'anonymous'로 위조해 검증 우회 가능.
- Follow-up: display_name 등 유저 편집 컬럼이 생기면 컬럼 화이트리스트 RPC로.

### ADR-063: moves는 클라이언트 DELETE 정책 미생성 (soft delete만)

- 결정: moves DELETE 정책 없음. soft delete는 UPDATE(`deleted_at` 세팅)로 처리. hard delete는 10-3 계정삭제에서 service_role.
- 이유: 쓰지 않는 권한을 닫아 공격면 축소. 클라이언트 hard delete 기능이 없음.

### ADR-064: 인증 엔드포인트 rate limit은 fail-closed

- 결정: rate limit 저장소(DB) 장애 시 503으로 차단(열어두지 않음). CORS는 `Vary: Origin` + 미허용 origin 403.
- 이유: 인증 엔드포인트의 rate limit이 조용히 무력화되면 비용 폭주 방어가 풀림. 장애 시 열어두는 것(fail-open)보다 닫는 것(fail-closed)이 안전.

### ADR-065: RPC 소유권 보강 — 옛 overload DROP 필수

- 결정: `update_move_with_reschedule` 9인자 버전 도입 시 옛 8인자 overload를 반드시 `DROP FUNCTION IF EXISTS`로 제거. 별도 마이그레이션(00020)으로 분리.
- 이유: PostgreSQL은 파라미터 수가 다르면 별개 함수로 취급(overloading). `CREATE OR REPLACE`는 같은 시그니처만 대체하므로, 옛 8인자 SECURITY DEFINER(소유권 검증 없음)가 잔존하면 RLS를 우회할 수 있음.

### ADR-066: 계정 삭제 = 즉시 hard delete + 회원 전용

- 결정: 유예기간 없는 즉시 hard delete. UI 2단계 확인으로 실수 방어. 로그인 회원만 노출(익명 직접 삭제 경로 미추가).
- 구현 (`supabase/functions/delete-account`):
  - service_role admin client. CORS → JWT 검증 → `is_anonymous` 403 가드 → rate limit(분당 3회, P1) → **재귀 Storage `list()`**(public Storage API, `storage.objects` 비의존) → chunk(100) `remove()` + 1~3회 retry → **삭제 후 prefix 재조회 잔여 0건 검증** → `auth_provider_links` 명시 삭제 → `auth.admin.deleteUser` → public.\* CASCADE.
  - 서버 idempotency는 유효 JWT 한정. 클라가 401/네트워크오류 시 세션 정리 + `signInAnonymously()`로 복구.
- 트리거 우회 검증: Apple 실측에서 `protect_delete` 트리거가 Storage API `remove()`를 막지 않음 확인 (스펙 §2-2 #3 대응책 불필요).
- 연계: ADR-074 (사진 저장 회원 전용 — 익명 직접 삭제 경로 불필요 정합).

### ADR-067: Provider 연결 해제 — best-effort + timeout

- 결정: Kakao `unlink()` + Google `revokeAccess()` best-effort 호출. **5s timeout** 각각, 실패/타임아웃은 warn 로그(provider 이름 + 짧은 errorCode만, **토큰/이메일/PII 로그 금지**). signOut · session.clear · 익명 재가입은 revoke 실패와 무관하게 항상 진행.
- Apple revoke는 10-4 (token revoke endpoint 도입 시).
- 실패 시 상태: Supabase user·앱 데이터는 삭제 / provider 측 앱 연결은 남을 수 있음(같은 provider 재로그인 시 새 익명 user에 다시 연결). UI 안내: "앱 데이터는 삭제됐습니다. 소셜 연결 해제는 계정 제공자 설정에서 직접 하실 수 있습니다."
- 검증: Kakao `unlink()` + Google `revokeAccess()` 실측에서 warn 로그 없음 (성공).

### ADR-068: prod Supabase 리전 Seoul

- 결정: 새 prod 프로젝트 만들 경우 Northeast Asia (Seoul, ap-northeast-2). 국내 사용자 latency + 데이터 위치 국내(개인정보 처리방침 §5 부합).
- ⚠️ **ADR-075로 대체** (10-3): prod 신규 미생성, 기존 dev(Seoul)를 prod로 통합 사용 — Seoul 리전 결정은 자동 충족.

### ADR-069: AI 캐시 dev→prod 복사 (P1)

- 결정: `ai_guide_cache`만 복사 허용(공용 캐시). users/auth.users/moves/user_checklist_items/property_photos/auth_provider_links/rate_limit_log/storage.objects 복사 금지.
- ⚠️ **ADR-075로 대체** (10-3): dev=prod라 복사 작업 자체가 의미 X. 기존 ai_guide_cache 그대로 활용.

### ADR-070: 내부 테스트 = production EAS 빌드 프로파일

- 결정: Google Play 내부 테스트에 development/preview가 아닌 **production 빌드 프로파일**의 AAB 사용. 실 사용자 빌드와 동일 환경에서 검증해야 의미 있음.
- `eas.json` production: `extends: 'base'` + `android.buildType: 'app-bundle'` + `autoIncrement: true` + `cli.appVersionSource: 'remote'`. EAS 서버가 versionCode 자동 관리.
- env는 EAS Secrets production scope (ADR-055와 일치).

### ADR-071: Play Console — 타깃 18+ + 전체이용가 + Restrict Minor Access off

- 결정: Play Console App content에서 타깃 연령 18세 이상 명시 + 콘텐츠 등급은 전체이용가(제재 사유 없음). Restrict Minor Access는 off(타깃이 성인이지만 콘텐츠는 모든 연령에 안전).
- 근거: 만 14세 미만 아동의 개인정보 수집 금지(약관 §9). 18+ 타깃은 약관 동의·계약·이사 의사결정 등 성인 행위 위주.
- Data Safety 폼은 내부 트랙 면제(10-3 완료 조건 제외). 폐쇄/공개/프로덕션은 10-4.

### ADR-072: 약관 하이브리드 (PIPC 구조)

- 결정: 개인정보처리방침은 PIPC(개인정보보호위원회) "개인정보처리방침 만들기" 도구의 구조 + §3-1 인벤토리 내용. 이용약관은 11개 조항(목적/정의/효력·변경/회원가입/서비스 제공/회원 의무/탈퇴·자격상실/면책/책임 제한/준거법/문의).
- 면책 핵심: "정보 제공 목적·법률 자문 아님" 명시 — 체크리스트·맞춤 가이드의 책임 한계 명확화.
- 만 14세 미만 아동 가입 제한 명시. 보호책임자: usnimoes@gmail.com.
- 공개 라우트: `/privacy`, `/terms` — 세션 게이트 바깥, Play Console·App Store 심사관 직접 접근 가능.

### ADR-073: 10-3 = 내부 테스트 트랙 + 공개 production 도메인 미스위치

- 결정: 10-3 범위는 내부 테스트 트랙(최대 100명) + 내부 배포만 prod 연결. 공개 production 도메인은 미스위치. 폐쇄 테스트(N명/14일)→프로덕션 접근 / iOS TestFlight / 대중 공개 = 10-4.
- internal 웹 배포의 `VITE_SUPABASE_URL`/`ANON_KEY` 도 prod로 빌드 (혼합 금지) + 고정 alias(ephemeral Preview URL 금지).
- ⚠️ **ADR-075로 부분 대체** (10-3): dev=prod 결정으로 "internal 웹 = prod Supabase로 빌드"는 자동 충족(같은 환경). "공개 production 도메인 미스위치" 정신은 유지 — internal alias `isakok.vercel.app`는 테스터에게만 공유.

### ADR-074: 사진 저장 = 로그인 회원 전용 (하드 게이트)

- 결정: 비회원(익명)은 앱 전체(온보딩·체크리스트·타임라인·대시보드·AI 가이드)를 자유롭게 쓰되, **사진 "저장(서버 업로드)"은 소셜 로그인 회원만**. 게이트는 "사진 기능 노출/보기"가 아니라 **"저장" 행위 시점**에 건다(가치 노출 후 로그인 시트). 비회원용 IndexedDB 로컬 저장은 제공하지 않는다.
- 배경: ADR-042(Anonymous Sign-In)로 익명도 서버에 데이터를 갖는다. DECISIONS §3-2의 "소프트 넛지 + IndexedDB" 모델은 (a) 로컬 경로가 실제 구현된 적 없고(placeholder), (b) 익명 사진이 그냥 서버로 올라가는 상태라 반쯤 무효화돼 있었다. 본 ADR이 이를 하드 게이트로 대체.
- 근거:
  - 전환: 사진 촬영 = 의도 최고점(증거 보호 동기) → 게이트가 이 순간 가입을 강하게 끈다. 비회원은 이미 체크리스트(1차 가치)를 받은 뒤 도달.
  - 가치 일관성: 사진의 핵심은 증거력(서버 타임스탬프·해시·리포트). 로컬 사진은 2등급. 게이트면 "모든 사진 = 진짜 증거".
  - 구현 단순화: IndexedDB 저장·오프라인 동기화 큐·로컬→서버 마이그레이션·경고 배너 일괄 제거.
  - 프라이버시: 익명 서버 사진 0 → 계정 삭제 회원 전용과 정합(스펙 결정 #3 종결).
- 정책 (Apple 5.1.1(v) / Google Play): 5.1.1(v)는 *비계정 기능*에 로그인 강제 금지하나, "나중에 참조하려 저장(saving for future reference)" 같은 **계정 종속 기능**엔 가입 요구 허용. 서버 사진 보관이 이에 해당해 적합. ① 나머지 기능은 로그인 없이 사용 가능, ② 게이트는 저장 시점(브라우즈 차단 금지), ③ Apple 로그인 제공(4.8, 10-1 충족), ④ 계정 삭제 제공(10-3) 만족해야 함.
- 트레이드오프: 비회원 이탈 가능성 — 높은 의도 + 1차 가치 선경험 + 저장 시점 게이트로 상쇄.
- 구현: 10-5+ "가입 유도 CTA"가 소프트→하드로 단순화 (IndexedDB·동기화 큐 삭제). **공개 출시(10-4/10-5) 전 반드시 켜져 있어야** 과도기 익명 사진 공백 안 생긴다.
- 연계: DECISIONS §3-2 가입 유도 모델 대체 / 스펙 결정 #3(익명 계정 삭제) = 회원 전용 확정 / 개인정보처리방침 인벤토리에서 익명 서버 사진 제거(장기).

### ADR-075: dev=prod 단일 프로젝트 (Free 제약 + 분리 트리거)

- 결정: 10-3 단계에서 prod Supabase를 별도 생성하지 않고 기존 dev 프로젝트(ybcqinanfcarhqkclvue, Seoul)를 그대로 prod로 사용. 사용자 성장 또는 위험 임계 도달 시 분리.
- 배경:
  - Supabase Free tier 정책: 계정(seomsoo)이 owner/admin인 모든 org를 합쳐 활성 free 프로젝트 2개 한도. 새 free org 만들어도 같은 카운트에 잡힘.
  - 현재 활성: isakok(dev) + 다른 1개. 새 prod를 별도로 만들려면 Pro($25/mo) 또는 dev pause(7일 자동 삭제 위험) 필요.
  - 10-3 internal 테스트는 ~12명, 1인 인디 첫 출시 단계라 dev/prod 분리의 폭발 반경 작음.
- 대안:
  - (A) dev=prod 단일 프로젝트 **(채택)** — 비용 0, 마이그레이션·OAuth·시드 재실행 불필요, AI 캐시 자동 활용
  - (B) Pro upgrade $25/mo — 분리 깔끔하지만 수익화 불확실한 출시 전 비용 부담
  - (C) dev 일시 pause + 새 free prod — 7일 자동 삭제 위험, 작업 중 dev 불가
- 분리 트리거 (다음 중 하나 도달 시 Pro upgrade + dev/prod 분리 검토):
  1. **10-4 폐쇄 테스트 시작 직전** (N명/14일 + production approval) — 실 외부 사용자 영역
  2. **DB 사용량 free 한도 50% 도달** (500 MB 중 250 MB)
  3. **MAU 1000+** — 사용자 영향 폭발 반경 본격 커짐
  4. **데이터 손상 가능성 있는 변경**(스키마 큰 변경, RLS 정책 수정 등)을 dev에서 미리 시도 못 해서 답답해질 때
- 안전 게이트 (이 ADR 채택과 함께 즉시 수행 — "단순 잔재 정리가 아니라 dev→prod 하드닝"):
  1. **scripts/dev-wipe.sql 삭제** — project-ref 가드가 이제 prod를 가리킴 (장전된 총)
  2. **자동 백업** GitHub Actions + pg_dump — Free tier 자동 백업 없음, 테스터 데이터 전 켜둠
  3. **service_role 키 rotation** + 영향 시 anon 키도 갱신 (web `VITE_SUPABASE_ANON_KEY` + native `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
  4. **kakao-token-exchange 에러 응답 트리밍** — code/status가 HTTP body로 새지 않게, server log만 상세
  5. **gitleaks 히스토리 전수 스캔** — 공개 레포라 anon/DB password/Anthropic 누출 검증
  6. **OAuth provider 콘솔에 internal URL + Play App Signing SHA-1** 일괄 등록
  7. **RLS smoke 재검증**
- 트레이드오프:
  - 비용 0원 vs 격리된 dev 환경 부재 — local Docker `supabase start`로 일부 보완 가능
  - 출시 후 분리 시점 마이그레이션 비용 (사용자 데이터 dump/restore, DNS 변경) — 트리거 임박 시 미리 진행
- 전제 변경:
  - ADR-046 (10-1은 dev 전용 / prod 10-2 일괄 생성) → 본 ADR로 대체
  - ADR-051 (prod Vercel을 10-1 동안 dev에 임시 연결) → 본 ADR로 영구화 (internal Vercel 배포도 같은 Supabase)
