-- guide_content 보강 3건 + master_version bump

-- #11 원상복구 범위 확인
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n통화는 녹음 시작 안내 후 녹음하고, 집주인 답변은 카톡 스크린샷으로 저장. 나중에 "그런 말 한 적 없다"는 주장을 막을 수 있음.'
WHERE sort_order = 11;

-- #41 전입신고 + 확정일자
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n확정일자 받은 당일 인터넷등기소(www.iros.go.kr)에서 등기부등본 재확인 필수 — 당일 근저당이 새로 설정되면 보증금 순위가 밀릴 수 있음.'
WHERE sort_order = 41;

-- #42 입주 사진
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n도배·장판을 새로 하지 않은 집은 기존 하자를 특히 꼼꼼히 촬영. 퇴실 시 "이거 네가 낸 자국"이라는 뒤집어쓰기를 막는 유일한 증거.'
WHERE sort_order = 42;

-- 마스터 버전 bump
UPDATE public.system_config
SET value = 2
WHERE key = 'master_checklist_version';
