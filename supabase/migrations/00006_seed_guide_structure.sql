-- 46개 마스터 항목의 guide_steps / guide_items / guide_note 채우기
-- guide_content를 분해: 행동 지시 → steps, 준비물 → items, 배경/주의/설명 → note

-- #01 이사 방식 결정하기
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '짐 양 파악 (원룸/투룸+, 가전가구 유무)',
    '이사 방식 선택 (용달/반포장/포장/자가용)',
    '예산 범위와 일정 맞춰보기'
  ],
  guide_items = NULL,
  guide_note = '원룸 짐 적으면 용달 5~15만, 가전가구 있으면 반포장 20~35만, 모두 맡기려면 포장이사 35~70만 (2026 시세). 자가용은 몇 박스 수준일 때만.'
WHERE sort_order = 1;

-- #02 이사업체 견적 비교
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '짐싸/짐카/이사모아 등 비교 플랫폼에서 견적 요청',
    '최소 3곳 이상 비교',
    '계약서에 파손 시 보상 조건 명시'
  ],
  guide_items = NULL,
  guide_note = '손 없는 날/주말은 비용 20~30% 높음. 계약 전 파손 보상 조건을 반드시 서면으로 확인.'
WHERE sort_order = 2;

-- #03 인터넷 이전/해지 신청
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '현 통신사에 이전 또는 해지 문의',
    '이전이면 새 집 개통일 예약, 해지면 신규 가입 별도 검토',
    '이사 당일 사용 가능하도록 최소 2주 전 신청'
  ],
  guide_items = ARRAY['통신사 고객센터 번호 (KT 100, LGU+ 1644-7070, SKT 1600-2000)'],
  guide_note = '이사 후 요청하면 1~2주 대기 발생. 약정 남았으면 이전, 만료됐으면 해지 후 신규가입이 더 저렴할 수 있음.'
WHERE sort_order = 3;

-- #04 가구 배치 계획
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '새 집 도면에 가구 위치 구상',
    '콘센트 위치 고려해서 배치',
    '가구 사이즈가 문/복도를 통과하는지 확인'
  ],
  guide_items = NULL,
  guide_note = '미리 계획을 이사업체에 전달하면 당일 작업이 빨라짐.'
WHERE sort_order = 4;

-- #05 안 쓰는 물건 정리
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '옷/물건 중 안 쓰는 것 분류',
    '당근마켓/번개장터에서 중고거래',
    '헌옷은 굿윌스토어/아름다운가게 기부'
  ],
  guide_items = NULL,
  guide_note = '짐 양이 이사비용을 크게 좌우함. 차량 크기 1단계만 올라도 20만원 추가. 기부는 영수증 발급 가능.'
WHERE sort_order = 5;

-- #06 구독 서비스 주소변경
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '정기구독 목록 확인 (마켓컬리, 쿠팡 정기배송, 생수 등)',
    '각 서비스 앱에서 주소 변경 또는 일시정지'
  ],
  guide_items = NULL,
  guide_note = '빠뜨리면 이전 주소로 배달되니 이사 2~3주 전에 미리 정리.'
WHERE sort_order = 6;

-- #07 렌탈 제품 이전 신청
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '렌탈 업체 고객센터에 이전 신청',
    '이사 당일에 맞춰 기사 방문 예약'
  ],
  guide_items = NULL,
  guide_note = '일정이 안 맞으면 1~2주 기다려야 할 수 있어 최대한 일찍 예약.'
WHERE sort_order = 7;

-- #08 에어컨 이전 예약
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '개인 소유 에어컨이 있는지 확인 (옵션 에어컨은 제외)',
    '이전 설치 업체 예약'
  ],
  guide_items = NULL,
  guide_note = '이삿짐센터에서 같이 해주기도 하지만 별도 전문 업체가 더 안전. 여름철 예약 밀리니 일찍 잡기.'
WHERE sort_order = 8;

-- #09 대형폐기물 배출 신청
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '동주민센터 방문 또는 구청 홈페이지 온라인 신청',
    '품목별 대형폐기물 스티커 구매',
    '배출일 지정 후 해당 날짜에 배출'
  ],
  guide_items = NULL,
  guide_note = '스티커 가격은 품목별 상이 (소파 5,000~15,000원). 배출일 지정이 필요하니 미리 신청.'
WHERE sort_order = 9;

-- #10 폐가전 무상수거 신청
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '한국전자제품자원순환공제조합 1599-0903 또는 홈페이지 신청',
    '수거 희망일 예약'
  ],
  guide_items = NULL,
  guide_note = 'TV/냉장고/세탁기/에어컨 등 무료 방문 수거. 1~2주 전 예약 필요.'
WHERE sort_order = 10;

-- #11 원상복구 범위 확인
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '집주인/부동산에 원상복구 범위 문의',
    '카톡/문자로 기록 남기기',
    '입주 때 찍어둔 사진이 있으면 비교 준비'
  ],
  guide_items = NULL,
  guide_note = '벽 못 자국, 벽지 오염, 장판 손상 등 어디까지 세입자 책임인지 미리 확인해야 보증금 분쟁을 막을 수 있음.'
WHERE sort_order = 11;

-- #12 전세보증보험 해지/이전 확인
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '가입 보험사 확인 (HUG 또는 SGI서울보증)',
    '전세금 반환 후 해지 신청',
    '새 집에서 재가입 여부 검토'
  ],
  guide_items = NULL,
  guide_note = '전세금 돌려받은 후에만 해지 가능. 새 집에서 다시 가입해야 보증금 보호가 유지됨.'
WHERE sort_order = 12;

-- #13 전입신고 서류 준비
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '신분증 확인',
    '임대차계약서 원본 준비',
    '정부24에서 온라인 절차 미리 확인'
  ],
  guide_items = ARRAY['본인 신분증', '임대차계약서 원본'],
  guide_note = '정부24에서 전입신고와 확정일자 동시 처리 가능. 이사 당일에 해야 대항력 확보 — 하루라도 미루면 법적 보호 공백 발생.'
WHERE sort_order = 13;

-- #14 주소변경 목록 정리
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '주소 변경이 필요한 서비스 목록 작성',
    '은행/카드/보험/통신/국민연금/건강보험 등 분류'
  ],
  guide_items = NULL,
  guide_note = '정부24 전입신고 시 일부 기관은 자동 변경. 나머지는 각 기관 앱/홈페이지에서 수동 변경 필요.'
WHERE sort_order = 14;

-- #15 냉장고 식재료 소진
UPDATE public.master_checklist_items SET
  guide_steps = NULL,
  guide_items = NULL,
  guide_note = '이사 3일 전에는 냉장고가 거의 비어 있어야 함. 냉동식품부터 먼저 소진, 조미료류는 밀봉해서 이삿짐에 포함.'
WHERE sort_order = 15;

-- #46 사전 실측 (sort_order 16)
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '새 집 방문',
    '현관문/방문 폭, 복도 폭, 엘리베이터 크기 측정',
    '큰 가구(냉장고/소파/침대) 반입 가능 여부 확인'
  ],
  guide_items = ARRAY['줄자 또는 AR 측정 앱'],
  guide_note = '사전에 확인하지 않으면 이사 당일 가구 반입 불가 사태가 발생할 수 있음.'
WHERE sort_order = 16;

-- #16 관리사무소 이사 통보
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '관리사무소에 이사 날짜/시간 통보',
    '엘리베이터 사용 예약',
    '주차 공간 확보 요청'
  ],
  guide_items = NULL,
  guide_note = '일부 건물은 이사 시간 제한 (예: 평일 오전만 가능)이 있으니 먼저 확인.'
WHERE sort_order = 17;

-- #17 입주청소 예약
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '입주청소 여부 결정',
    '숨고/미소 등에서 업체 비교',
    '입주 전날 또는 당일 오전으로 예약'
  ],
  guide_items = NULL,
  guide_note = '원룸 기준 8~15만원. 직접 할 경우 청소도구 미리 준비.'
WHERE sort_order = 18;

-- #18 포장자재 준비
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '필요한 박스 수량 산정 (원룸 10~15개)',
    '다이소/온라인에서 구매 또는 중고 박스 나눔 활용'
  ],
  guide_items = ARRAY['이사 박스', '포장용 테이프', '뽁뽁이', '매직'],
  guide_note = '반포장/포장이사는 업체가 자재를 제공하므로 생략 가능.'
WHERE sort_order = 19;

-- #19 짐 분류하기
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '방별/용도별로 짐 분류',
    '박스에 내용물 메모 (매직으로 크게)',
    '깨지기 쉬운 박스는 별도 표시'
  ],
  guide_items = NULL,
  guide_note = '예: "주방-식기", "방-옷". 분류해두면 이사 후 정리 속도가 크게 빨라짐.'
WHERE sort_order = 20;

-- #20 당일 필요물품 챙기기
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '"당일 가방" 별도 준비',
    '즉시 필요한 물품을 따로 분리 포장'
  ],
  guide_items = ARRAY[
    '세면도구',
    '수건',
    '충전기',
    '이불 1세트',
    '간식/물',
    '쓰레기봉투',
    '청소도구',
    '중요서류'
  ],
  guide_note = NULL
WHERE sort_order = 21;

-- #21 귀중품 따로 보관
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '직접 운반할 귀중품 분리',
    '고가 전자기기는 사진 촬영'
  ],
  guide_items = ARRAY['귀금속', '현금', '노트북', '임대차계약서', '신분증', '도장', '보험증서'],
  guide_note = '이삿짐에 넣지 말고 본인이 직접 운반. 파손/분실 분쟁 대비해 사진 기록을 남겨 둘 것.'
WHERE sort_order = 22;

-- #22 이체한도 확인
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '은행 앱에서 1일 이체한도 확인',
    '보증금/잔금 대비 부족하면 증액 신청',
    '최소 3영업일 전 처리'
  ],
  guide_items = NULL,
  guide_note = '보증금이 1일 이체한도를 넘으면 이사 당일에 이체 불가. 은행 방문 또는 앱으로 증액 가능.'
WHERE sort_order = 23;

-- #23 우편물 주소이전 신청
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '우체국 홈페이지 또는 방문 신청',
    '이전 주소/새 주소 입력'
  ],
  guide_items = NULL,
  guide_note = '신청일로부터 3개월간 이전 주소로 온 우편물을 새 주소로 전달 (무료).'
WHERE sort_order = 24;

-- #24 냉장고 비우기
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '냉장고 완전히 비우기',
    '최소 이사 전날 밤 전원 뽑기',
    '물받이 트레이 비우고 문 열어 환기'
  ],
  guide_items = NULL,
  guide_note = '냉동실 성에 녹이는 데 12~24시간 소요.'
WHERE sort_order = 25;

-- #25 세탁기 잔수 제거
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '세탁기 좌측 하단 서비스 커버 열기',
    '잔수 제거용 호스로 물 빼기',
    '거름망 청소'
  ],
  guide_items = NULL,
  guide_note = '잔수를 빼지 않으면 이동 중 물이 쏟아져 다른 짐을 적실 수 있음.'
WHERE sort_order = 26;

-- #26 이사업체 최종 확인
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '도착 시간/인원/차량 크기 재확인',
    '주차 가능 여부/엘리베이터 사용 여부 전달',
    '당일 연락처 확인'
  ],
  guide_items = NULL,
  guide_note = NULL
WHERE sort_order = 27;

-- #27 포장 마무리
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '당일 필요물품 외 모든 짐 포장',
    '박스 입구 테이프로 단단히 봉인',
    '깨지기 쉬운 박스에 "취급주의" 표시'
  ],
  guide_items = NULL,
  guide_note = NULL
WHERE sort_order = 28;

-- #28 구 집 상태 촬영
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '현관→방→화장실→주방→베란다 순서로 촬영',
    '벽/바닥/천장/설비 전반 기록',
    '하자 부위는 클로즈업',
    '촬영 날짜가 찍히도록 설정'
  ],
  guide_items = NULL,
  guide_note = '보증금 분쟁 시 핵심 증거가 되는 기록.'
WHERE sort_order = 29;

-- #29 계량기 사진 촬영
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '가스/전기/수도 계량기 숫자가 보이게 촬영'
  ],
  guide_items = NULL,
  guide_note = '정산 기준이 되는 수치. 분쟁 예방용으로 반드시 남겨둘 것.'
WHERE sort_order = 30;

-- #30 관리비 정산
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '관리사무소에 퇴실일 알리기',
    '이사 당월 관리비 일할 정산 요청'
  ],
  guide_items = NULL,
  guide_note = NULL
WHERE sort_order = 31;

-- #31 전기 정산
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '한국전력 123번 전화 또는 한전ON 앱 접속',
    '계량기 수치 기준으로 당일 정산',
    '무통장입금 또는 카드로 결제'
  ],
  guide_items = NULL,
  guide_note = '이사 당일 정산이 원칙.'
WHERE sort_order = 32;

-- #32 가스 정산
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '지역 도시가스 회사 고객센터 전화',
    '사용 중지 신청 + 계량기 수치 기준 정산'
  ],
  guide_items = NULL,
  guide_note = '서울은 서울도시가스 1588-5788. 지역별 도시가스 회사 번호 확인 필요.'
WHERE sort_order = 33;

-- #33 수도 정산
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '관할 상수도사업본부 고객센터 전화',
    '또는 지로용지 가상계좌로 정산'
  ],
  guide_items = NULL,
  guide_note = '계량기 사진을 남겨두면 분쟁 예방에 도움.'
WHERE sort_order = 34;

-- #34 짐 상차 확인
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '이사업체 도착 시간 확인',
    '깨지기 쉬운 짐 따로 안내',
    '방별로 짐 빠진 것 없는지 확인'
  ],
  guide_items = NULL,
  guide_note = '귀중품은 업체에 맡기지 말고 직접 운반.'
WHERE sort_order = 35;

-- #35 열쇠/카드키 반납
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '집주인/부동산에 반납',
    '반납 시 사진 또는 수령 확인 받기'
  ],
  guide_items = ARRAY['열쇠', '출입카드', '리모컨', '우편함 키'],
  guide_note = '분실 시 비용이 청구될 수 있으므로 수령 확인 필수.'
WHERE sort_order = 36;

-- #36 보증금 반환 확인 (월세)
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '약속된 날짜에 입금 확인',
    '원상복구 비용 공제 시 내역을 서면으로 받기'
  ],
  guide_items = NULL,
  guide_note = '입금이 안 되면 내용증명 발송을 고려.'
WHERE sort_order = 37;

-- #37 전세금 반환 확인
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '잔금 지급과 동시에 전세금 수령',
    '계좌이체 기록 보관'
  ],
  guide_items = NULL,
  guide_note = '미반환 시 임차권등기명령 등 법적 절차를 검토해야 함.'
WHERE sort_order = 38;

-- #38 새 집 하자 체크
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '수도/전기/가스 작동 확인',
    '보일러 온수 확인',
    '변기 물내림, 창문 잠금, 도어락 작동 점검',
    '문제 발견 시 집주인에게 바로 연락'
  ],
  guide_items = NULL,
  guide_note = '짐을 들이기 전에 확인해야 책임 소재가 명확.'
WHERE sort_order = 39;

-- #39 짐 하차/배치
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '미리 계획한 배치대로 이사팀에 안내',
    '짐 개수 확인 + 가전 작동 테스트',
    '파손 발견 시 현장에서 바로 사진 + 업체 통지'
  ],
  guide_items = NULL,
  guide_note = NULL
WHERE sort_order = 40;

-- #40 도어락 비밀번호 변경
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '입주 당일 도어락 매뉴얼 확인',
    '비밀번호 즉시 변경'
  ],
  guide_items = NULL,
  guide_note = '이전 세입자가 비밀번호를 알고 있을 수 있으므로 당일 변경이 필수. 매뉴얼은 제조사 홈페이지에서 확인 가능.'
WHERE sort_order = 41;

-- #41 전입신고/확정일자
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '정부24 접속 또는 주민센터 방문',
    '전입신고 + 확정일자 동시 신청',
    '수수료 결제 (정부24 모바일 600원)'
  ],
  guide_items = ARRAY['본인 신분증', '임대차계약서 원본'],
  guide_note = '전입신고는 이사 후 14일 이내 의무. 이사 당일~다음날에 해야 대항력 확보. 확정일자는 전세/월세 모두 받아두기 — 보증금 보호의 핵심.'
WHERE sort_order = 42;

-- #42 입주 상태 촬영
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '현관→방→화장실→주방→베란다 순서로 촬영',
    '벽/바닥/천장/설비 + 기존 하자 모두 기록'
  ],
  guide_items = NULL,
  guide_note = '퇴실 시 "입주 때부터 있었다"는 증거가 되는 가장 중요한 기록 — 1~2년 뒤 보증금을 지켜줌.'
WHERE sort_order = 43;

-- #43 가스 안전점검 신청
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '지역 도시가스 회사에 전화',
    '안전점검 방문 예약 (무료)'
  ],
  guide_items = NULL,
  guide_note = '점검 없이 가스 사용하면 사고 위험. 반드시 점검 후 개통.'
WHERE sort_order = 44;

-- #44 주소변경 일괄 처리
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '자동 변경된 기관과 수동 변경 필요 기관 구분',
    '은행/카드/보험 앱에서 수동 변경',
    '택배 주소(쿠팡/네이버/배민 등)도 변경'
  ],
  guide_items = NULL,
  guide_note = '정부24 전입신고 시 일부 자동 변경. 나머지는 직접 처리해야 누락되지 않음.'
WHERE sort_order = 45;

-- #45 종량제 봉투 교환
UPDATE public.master_checklist_items SET
  guide_steps = ARRAY[
    '남은 이전 지역 종량제 봉투 챙기기',
    '동주민센터 방문해 새 지역 봉투로 교환'
  ],
  guide_items = NULL,
  guide_note = '다른 지역 봉투를 사용하면 과태료가 부과될 수 있음.'
WHERE sort_order = 46;
