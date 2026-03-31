# 마스터 체크리스트 데이터 (45개 항목)

> 조건 태그 범례
>
> - housing_types: 원룸, 오피스텔, 빌라, 투룸+
> - contract_types: 월세, 전세
> - move_types: 용달, 반포장, 포장, 자가용
> - category: 업체/이사방법, 정리/폐기, 행정/서류, 공과금/정산, 통신/구독, 짐싸기/포장, 집상태기록, 이사당일, 입주후

---

## D-30 ~ D-21 (이사 한 달 전)

### #01 이사 방식 결정하기

- d_day_offset: -30
- category: 업체/이사방법
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 짐 양에 따라 용달/반포장/포장이사 중 선택
- guide_content: 원룸 짐 적으면 용달(15~30만), 가전가구 있으면 반포장(30~60만), 모든 짐 포장 맡기려면 포장이사(60만~). 자가용은 정말 짐이 몇 박스일 때만.
- guide_url: null

### #02 이사업체 견적 비교 (최소 3곳)

- d_day_offset: -28
- category: 업체/이사방법
- housing_types: [전체]
- contract_types: [전체]
- move_types: [용달, 반포장, 포장]
- description: 이사업체 3곳 이상 견적 받아 비교
- guide_content: 짐싸, 짐카, 이사모아 등 비교 플랫폼 활용. 계약서에 파손 시 보상 조건 반드시 명시. 손 없는 날/주말은 비용 20~30% 높음.
- guide_url: null

### #03 인터넷 이전 또는 해지 신청

- d_day_offset: -25
- category: 통신/구독
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 통신사에 인터넷 이전 또는 신규 가입 신청
- guide_content: 이사 후 요청하면 1~2주 대기. 미리 신청해야 이사 당일 바로 사용 가능. KT 100번, LGU+ 1644-7070, SKT 1600-2000. 약정 남았으면 이전, 만료됐으면 해지 후 신규가입이 더 저렴할 수 있음.
- guide_url: null

### #04 새 집 가구 배치 계획 세우기

- d_day_offset: -25
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 새 집 도면에 가구 배치 구상
- guide_content: 콘센트 위치 고려해서 배치 계획. 이사업체에 전달하면 당일 작업이 빨라짐. 가구 사이즈가 문/복도 통과하는지 확인.
- guide_url: null

### #05 불필요한 물건 정리 시작

- d_day_offset: -25
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 안 쓰는 옷, 물건 중고거래/기부/폐기 시작
- guide_content: 짐 양에 따라 이사비용이 크게 차이남. 인건비/차량 크기 1단계만 올라도 20만원 추가. 당근마켓, 번개장터 활용. 헌옷은 굿윌스토어/아름다운가게 기부하면 기부금 영수증 발급.
- guide_url: null

### #06 정기구독 서비스 주소변경/해지

- d_day_offset: -21
- category: 통신/구독
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 정기배송, 구독 서비스 주소 변경 또는 일시정지
- guide_content: 마켓컬리, 쿠팡 정기배송, 생수 배달 등. 빠뜨리면 이전 주소로 배달됨.
- guide_url: null

### #07 렌탈 제품 이전 신청

- d_day_offset: -21
- category: 통신/구독
- housing_types: [오피스텔, 빌라, 투룸+]
- contract_types: [전체]
- move_types: [전체]
- description: 정수기, 공기청정기 등 렌탈 제품 이전 예약
- guide_content: 렌탈 업체에 이전 신청. 이사 당일에 맞춰 기사 방문 예약. 일정 안 맞으면 1~2주 기다려야 할 수 있음.
- guide_url: null

### #08 에어컨 이전 설치 예약

- d_day_offset: -21
- category: 업체/이사방법
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 개인 에어컨이 있으면 이전 설치 업체 예약
- guide_content: 이삿짐센터에서 같이 해주기도 하지만 별도 전문 업체가 더 안전. 여름철엔 예약이 밀리니 빨리 잡기. 옵션 에어컨(집주인 것)은 해당 없음.
- guide_url: null

---

## D-20 ~ D-14 (이사 2~3주 전)

### #09 대형폐기물 배출 신청

- d_day_offset: -18
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 버릴 가구/가전의 대형폐기물 스티커 구매 및 배출 신청
- guide_content: 동주민센터 방문 또는 구청 홈페이지에서 온라인 신청. 스티커 가격은 품목별 다름 (소파 5,000~15,000원). 배출일 지정 필요하니 미리 신청.
- guide_url: null

### #10 폐가전 무상수거 신청

- d_day_offset: -18
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 버릴 가전제품 무상수거 서비스 예약
- guide_content: 한국전자제품자원순환공제조합 1599-0903. TV, 냉장고, 세탁기, 에어컨 등 무료 방문 수거. 1~2주 전 예약 필요.
- guide_url: https://www.15990903.or.kr

### #11 원상복구 범위 집주인과 확인

- d_day_offset: -16
- category: 행정/서류
- housing_types: [원룸, 오피스텔, 빌라]
- contract_types: [월세]
- description: 퇴실 시 원상복구 범위를 집주인/부동산과 서면 확인
- guide_content: 벽에 못 자국, 벽지 오염, 장판 손상 등 어디까지 세입자 책임인지 미리 확인. 카톡이나 문자로 기록 남기기. 입주 때 찍어둔 사진이 있으면 비교 가능.
- guide_url: null

### #12 전세보증보험 해지/이전 확인

- d_day_offset: -16
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전세]
- move_types: [전체]
- description: 전세보증보험 가입 상태 확인 및 해지/이전 준비
- guide_content: HUG(주택도시보증공사) 또는 SGI서울보증 전세보증보험 확인. 전세금 돌려받은 후 해지 가능. 새 집에서 다시 가입 필요.
- guide_url: null

### #13 전입신고/확정일자용 서류 미리 준비

- d_day_offset: -14
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 이사 당일 바로 전입신고 할 수 있도록 서류 준비
- guide_content: 필요서류: 신분증, 임대차계약서 원본. 정부24에서 온라인 신청도 가능. 이사 당일에 해야 대항력 확보 — 하루라도 미루면 법적 보호 공백 발생.
- guide_url: https://www.gov.kr

### #14 주소변경 필요 목록 정리

- d_day_offset: -14
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 주소 변경해야 할 서비스 목록을 미리 정리
- guide_content: 은행, 카드사, 보험사, 통신사, 국민연금, 건강보험. 정부24 전입신고 시 일부 자동 변경. 나머지는 각 기관 앱/홈페이지에서 수동 변경 필요.
- guide_url: null

### #15 냉장고 식재료 소진 시작

- d_day_offset: -14
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 냉장고 식재료 소진, 새로 장보지 않기
- guide_content: 이사 3일 전에는 냉장고가 거의 비어있어야 함. 냉동식품부터 먼저 소진. 조미료류는 밀봉해서 이삿짐에 포함.
- guide_url: null

---

## D-13 ~ D-7 (이사 1~2주 전)

### #16 관리사무소/집주인에 이사 일정 통보

- d_day_offset: -10
- category: 행정/서류
- housing_types: [오피스텔, 빌라, 투룸+]
- contract_types: [전체]
- move_types: [전체]
- description: 관리사무소에 이사 날짜, 시간 알리기
- guide_content: 엘리베이터 사용 예약, 주차 공간 확보 필요. 일부 건물은 이사 시간이 제한됨 (예: 평일 오전만 가능).
- guide_url: null

### #17 입주청소 예약

- d_day_offset: -10
- category: 업체/이사방법
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 새 집 입주청소 업체 예약 (선택사항)
- guide_content: 입주 전날 또는 당일 오전에 청소 완료되도록 예약. 원룸 기준 8~15만원. 숨고, 미소 등에서 비교 가능. 직접 할 거면 청소도구 미리 준비.
- guide_url: null

### #18 이사박스/포장자재 준비

- d_day_offset: -10
- category: 짐싸기/포장
- housing_types: [전체]
- contract_types: [전체]
- move_types: [용달, 자가용]
- description: 이사 박스, 테이프, 뽁뽁이 등 포장자재 구매
- guide_content: 다이소나 온라인에서 구매. 원룸 기준 박스 10~15개 정도. 중고 박스 무료 나눔도 활용. 반포장/포장이사는 업체가 제공.
- guide_url: null

### #19 짐 분류 시작 (방별/용도별)

- d_day_offset: -9
- category: 짐싸기/포장
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 짐을 방별, 용도별로 분류하기
- guide_content: 박스마다 내용물 메모 필수 (매직으로 크게). "주방-식기", "방-옷" 식으로. 깨지기 쉬운 것은 별도 표시. 이사 후 정리가 훨씬 빨라짐.
- guide_url: null

### #20 당일 필요물품 별도 분류

- d_day_offset: -7
- category: 짐싸기/포장
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 이사 당일 바로 필요한 물건 따로 빼두기
- guide_content: 세면도구, 수건, 충전기, 이불 1세트, 간식, 물, 쓰레기봉투, 청소도구, 중요서류. "당일 가방"으로 따로 챙기기.
- guide_url: null

### #21 귀중품/중요서류 별도 보관

- d_day_offset: -7
- category: 짐싸기/포장
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 귀금속, 현금, 노트북, 서류 등 직접 운반할 물품 분리
- guide_content: 이삿짐에 넣지 말고 본인이 직접 운반. 임대차계약서, 신분증, 도장, 보험증서 등. 고가 전자기기는 미리 사진 찍어두면 분실/파손 시 도움.
- guide_url: null

### #22 1일 이체한도 확인 및 증액

- d_day_offset: -7
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 보증금/잔금 이체를 위해 은행 이체한도 확인
- guide_content: 보증금이 1일 이체한도를 넘으면 이사 당일에 이체 불가. 은행 앱에서 한도 확인하고, 부족하면 은행 방문해서 증액 신청. 최소 3영업일 전 처리.
- guide_url: null

---

## D-6 ~ D-3 (이사 3~6일 전)

### #23 우편물 주소이전 신청

- d_day_offset: -5
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 우체국 주거이전 서비스 신청
- guide_content: 우체국 홈페이지 또는 방문 신청. 신청일로부터 3개월간 이전 주소로 온 우편물을 새 주소로 전달해줌. 무료.
- guide_url: https://www.epost.go.kr

### #24 냉장고 비우기 + 전원 끄기

- d_day_offset: -3
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 냉장고 완전히 비우고 전원 뽑기
- guide_content: 냉동실 성에 녹이는 데 12~24시간 소요. 최소 이사 전날 밤에는 전원 끄기. 물받이 트레이 비우고 문 열어 환기.
- guide_url: null

### #25 세탁기 잔수 제거

- d_day_offset: -3
- category: 정리/폐기
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 세탁기 내부 잔수 빼기
- guide_content: 세탁기 좌측 하단 서비스 커버 열기 → 잔수 제거용 호스로 물 빼기 → 거름망 청소. 잔수 안 빼면 이동 중 물 쏟아짐.
- guide_url: null

### #26 이사업체 최종 일정 확인

- d_day_offset: -3
- category: 업체/이사방법
- housing_types: [전체]
- contract_types: [전체]
- move_types: [용달, 반포장, 포장]
- description: 이사업체에 날짜, 시간, 주소 최종 확인
- guide_content: 도착 시간, 인원, 차량 크기 재확인. 주차 가능 여부, 엘리베이터 사용 여부도 전달. 당일 연락처 확인.
- guide_url: null

### #27 포장 마무리

- d_day_offset: -2
- category: 짐싸기/포장
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 남은 짐 포장 마무리
- guide_content: 당일 필요물품 빼고 모든 짐 포장 완료. 박스 입구 테이프로 단단히 봉인. 깨지기 쉬운 박스에는 "취급주의" 표시.
- guide_url: null

---

## D-1 (이사 전날)

### #28 퇴실 전 구 집 상태 사진 촬영

- d_day_offset: -1
- category: 집상태기록
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 짐 뺀 후 구 집 상태를 사진/영상으로 기록
- guide_content: 현관→방→화장실→주방→베란다 순서로 벽, 바닥, 천장, 설비 촬영. 하자가 있는 곳은 클로즈업. 날짜가 찍히게 설정. 보증금 분쟁 시 핵심 증거.
- guide_url: null

### #29 구 집 가스/전기/수도 계량기 사진

- d_day_offset: -1
- category: 공과금/정산
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 퇴실 시점 계량기 수치 사진으로 기록
- guide_content: 가스, 전기, 수도 계량기 숫자가 보이게 촬영. 정산 시 기준이 됨. 분쟁 예방용.
- guide_url: null

### #30 구 집 관리비 정산

- d_day_offset: -1
- category: 공과금/정산
- housing_types: [오피스텔, 빌라, 투룸+]
- contract_types: [전체]
- move_types: [전체]
- description: 관리사무소에 관리비 최종 정산
- guide_content: 이사 당월 관리비를 일할 계산. 관리사무소에 퇴실일 알리고 정산 요청.
- guide_url: null

---

## D-Day (이사 당일)

### #31 구 집 전기 정산 (한전)

- d_day_offset: 0
- category: 공과금/정산
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 한국전력에 전화해서 전기요금 당일 정산
- guide_content: 한국전력 123번 전화 또는 '스마트 한전' 앱. 이사 당일 정산이 원칙. 무통장입금 또는 카드결제 가능.
- guide_url: null

### #32 구 집 가스 해지/정산

- d_day_offset: 0
- category: 공과금/정산
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 도시가스 사용 중지 신청 및 정산
- guide_content: 지역 도시가스 회사 고객센터 전화. 서울 서울도시가스 1588-5788. 계량기 수치 확인 후 정산.
- guide_url: null

### #33 구 집 수도 정산

- d_day_offset: 0
- category: 공과금/정산
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 수도요금 정산
- guide_content: 관할 상수도사업본부 고객센터 전화 또는 지로용지 가상계좌로 정산. 계량기 사진 있으면 분쟁 예방.
- guide_url: null

### #34 이사업체 도착 확인 + 짐 상차

- d_day_offset: 0
- category: 이사당일
- housing_types: [전체]
- contract_types: [전체]
- move_types: [용달, 반포장, 포장]
- description: 이사업체 도착 시간 확인, 짐 상차 감독
- guide_content: 깨지기 쉬운 짐 따로 안내. 짐 빠진 것 없는지 방별로 확인. 귀중품은 직접 운반.
- guide_url: null

### #35 구 집 열쇠/카드키 반납

- d_day_offset: 0
- category: 이사당일
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 집주인/부동산에 열쇠, 카드키, 리모컨 반납
- guide_content: 열쇠, 출입카드, 리모컨, 우편함 키 등. 반납 시 사진 또는 수령 확인 받기. 분실 시 비용 청구될 수 있음.
- guide_url: null

### #36 보증금 반환 확인

- d_day_offset: 0
- category: 공과금/정산
- housing_types: [전체]
- contract_types: [월세]
- move_types: [전체]
- description: 보증금 반환 일정 및 금액 확인
- guide_content: 이사 당일 또는 합의된 날짜에 입금 확인. 원상복구 비용 공제 시 내역 서면으로 받기. 입금 안 되면 내용증명 발송 고려.
- guide_url: null

### #37 전세금 반환 확인

- d_day_offset: 0
- category: 공과금/정산
- housing_types: [전체]
- contract_types: [전세]
- move_types: [전체]
- description: 전세보증금 반환 확인
- guide_content: 잔금 지급과 동시에 전세금 수령. 계좌이체 기록 반드시 보관. 미반환 시 임차권등기명령 등 법적 절차 가능.
- guide_url: null

### #38 새 집 도착 후 하자 체크

- d_day_offset: 0
- category: 이사당일
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 짐 들이기 전에 새 집 상태 빠르게 확인
- guide_content: 수도/전기/가스 작동 확인, 보일러 온수 확인, 변기 물내림, 창문 잠금, 도어락 작동. 문제 발견 시 바로 집주인에게 연락.
- guide_url: null

### #39 새 집 짐 하차 + 배치 확인

- d_day_offset: 0
- category: 이사당일
- housing_types: [전체]
- contract_types: [전체]
- move_types: [용달, 반포장, 포장]
- description: 짐 하차 감독, 가구 배치, 파손 확인
- guide_content: 미리 계획한 배치대로 안내. 짐 개수 확인. 가전 작동 테스트. 파손 발견 시 현장에서 바로 업체에 알리고 사진 촬영.
- guide_url: null

### #40 새 집 도어락 비밀번호 변경

- d_day_offset: 0
- category: 이사당일
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 디지털 도어락 비밀번호 즉시 변경
- guide_content: 이전 세입자가 알고 있을 수 있음. 입주 당일 바로 변경. 도어락 매뉴얼은 제조사 홈페이지에서 확인 가능.
- guide_url: null

---

## D+1 (이사 다음 날)

### #41 전입신고 + 확정일자 받기

- d_day_offset: 1
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 전입신고 및 확정일자 신청 (가장 중요!)
- guide_content: 정부24 온라인 또는 주민센터 방문. 신분증 + 임대차계약서 원본 필요. 전입신고는 14일 이내 의무지만, 이사 당일~다음날에 해야 대항력 확보. 확정일자는 전세/월세 모두 받아두기 — 보증금 보호의 핵심.
- guide_url: https://www.gov.kr

### #42 새 집 상태 사진 촬영 (입주 기록)

- d_day_offset: 1
- category: 집상태기록
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 새 집 입주 상태를 사진/영상으로 기록
- guide_content: 현관→방→화장실→주방→베란다 순서로 벽, 바닥, 천장, 설비, 기존 하자 모두 촬영. 퇴실할 때 "이건 입주 때부터 있었다"는 증거. 가장 중요한 기록 — 1~2년 뒤 보증금을 지켜줌.
- guide_url: null

### #43 가스 안전점검 신청

- d_day_offset: 1
- category: 입주후
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 새 집 도시가스 개통 및 안전점검
- guide_content: 지역 도시가스 회사에 전화. 가스 사용 전 안전점검 필수 (무료). 점검 없이 가스 사용하면 사고 위험.
- guide_url: null

---

## D+2 ~ D+7 (입주 첫 주)

### #44 주소변경 일괄 처리

- d_day_offset: 3
- category: 행정/서류
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 은행, 카드, 보험, 통신사 등 주소 일괄 변경
- guide_content: 정부24 전입신고 시 일부 자동 변경. 나머지는 수동 — 은행 앱, 카드사 앱, 보험사 고객센터. 택배 주소도 쿠팡/네이버/배민 등에서 변경.
- guide_url: null

### #45 종량제 봉투 교환

- d_day_offset: 3
- category: 입주후
- housing_types: [전체]
- contract_types: [전체]
- move_types: [전체]
- description: 이전 지역 종량제 봉투를 새 지역 봉투로 교환
- guide_content: 동주민센터 방문하면 같은 용량의 새 지역 봉투로 교환 가능. 다른 지역 봉투 사용하면 과태료.
- guide_url: null

---

## 통계

| 카테고리      | 항목 수 |
| ------------- | ------- |
| 업체/이사방법 | 5       |
| 정리/폐기     | 6       |
| 행정/서류     | 7       |
| 공과금/정산   | 6       |
| 통신/구독     | 3       |
| 짐싸기/포장   | 5       |
| 집상태기록    | 2       |
| 이사당일      | 7       |
| 입주후        | 4       |
| **합계**      | **45**  |

| 시기        | 항목 수 |
| ----------- | ------- |
| D-30 ~ D-21 | 8       |
| D-20 ~ D-14 | 7       |
| D-13 ~ D-7  | 7       |
| D-6 ~ D-3   | 5       |
| D-1         | 3       |
| D-Day       | 10      |
| D+1         | 3       |
| D+2 ~ D+7   | 2       |
| **합계**    | **45**  |

## 조건별 필터링 예시

| 조건                     | 전체 해당 항목 수 | 제외 항목 예시                                                          |
| ------------------------ | ----------------- | ----------------------------------------------------------------------- |
| 원룸 + 월세 + 용달       | ~38개             | 렌탈이전(#07), 관리비정산(#30), 전세보증보험(#12), 전세금반환(#37) 제외 |
| 오피스텔 + 전세 + 반포장 | ~40개             | 이사박스준비(#18, 업체 제공), 보증금반환(#36) 제외                      |
| 원룸 + 월세 + 자가용     | ~35개             | 이사업체 관련(#02,#26,#34,#39), 렌탈이전(#07) 등 제외                   |
