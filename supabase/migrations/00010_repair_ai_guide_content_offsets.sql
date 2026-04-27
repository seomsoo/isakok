-- Repair guide_content rows affected by sort_order offset in 00009.
-- Seed data uses sort_order 41 = 도어락, 42 = 전입신고/확정일자, 43 = 입주 상태 촬영.

-- Remove 확정일자 보강 문구 that was appended to 도어락 by mistake.
UPDATE public.master_checklist_items
SET guide_content = replace(
  guide_content,
  E'\n확정일자 받은 당일 인터넷등기소(www.iros.go.kr)에서 등기부등본 재확인 필수 — 당일 근저당이 새로 설정되면 보증금 순위가 밀릴 수 있음.',
  ''
)
WHERE sort_order = 41
  AND title = '도어락 비밀번호 변경';

-- Remove 입주 사진 보강 문구 that was appended to 전입신고/확정일자 by mistake.
UPDATE public.master_checklist_items
SET guide_content = replace(
  guide_content,
  E'\n도배·장판을 새로 하지 않은 집은 기존 하자를 특히 꼼꼼히 촬영. 퇴실 시 "이거 네가 낸 자국"이라는 뒤집어쓰기를 막는 유일한 증거.',
  ''
)
WHERE sort_order = 42
  AND title = '전입신고/확정일자';

-- Append 확정일자 보강 문구 to the correct 전입신고/확정일자 row.
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n확정일자 받은 당일 인터넷등기소(www.iros.go.kr)에서 등기부등본 재확인 필수 — 당일 근저당이 새로 설정되면 보증금 순위가 밀릴 수 있음.'
WHERE sort_order = 42
  AND title = '전입신고/확정일자'
  AND guide_content NOT LIKE '%인터넷등기소(www.iros.go.kr)%';

-- Append 입주 사진 보강 문구 to the correct 입주 상태 촬영 row.
UPDATE public.master_checklist_items
SET guide_content = guide_content || E'\n도배·장판을 새로 하지 않은 집은 기존 하자를 특히 꼼꼼히 촬영. 퇴실 시 "이거 네가 낸 자국"이라는 뒤집어쓰기를 막는 유일한 증거.'
WHERE sort_order = 43
  AND title = '입주 상태 촬영'
  AND guide_content NOT LIKE '%도배·장판을 새로 하지 않은 집%';

-- Bump master version so AI guide cache is invalidated after repairing master content.
UPDATE public.system_config
SET value = 3
WHERE key = 'master_checklist_version';
