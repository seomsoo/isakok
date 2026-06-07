// 발송 푸시 본문 문구 (12단계 §9, 친근+깔끔 톤). 이모지는 D-day에만 1개.
// 모달/설정 카피는 packages/shared/src/constants/pushCopy.ts에 별도(웹 UI용).

export interface PushContent {
  title: string
  body: string
}

/** 다이제스트: 오늘 챙길 일 N개 (첫 항목 노출). count>=1 가정. */
export function digestContent(firstItem: string, count: number): PushContent {
  if (count <= 1) {
    return { title: '오늘 챙길 일 1개', body: `'${firstItem}' 잊지 마세요` }
  }
  return {
    title: `오늘 챙길 일 ${count}개`,
    body: `'${firstItem}' 외 ${count - 1}건 · 지금 확인하기`,
  }
}

/** D-day 마일스톤 (7/3/1/0). count는 D-3 본문에만 사용(pending 병합). */
export function milestoneContent(day: number, count: number): PushContent {
  switch (day) {
    case 7:
      return { title: '이사까지 일주일 남았어요 🚚', body: '지금부터 하나씩 챙기면 여유로워요' }
    case 3:
      return {
        title: '이사 D-3, 막바지예요',
        body: count > 0 ? `오늘 할 일 ${count}개 확인하기` : '빠진 일 없는지 확인해요',
      }
    case 1:
      return { title: '내일이 이사날이에요', body: '마지막 점검, 빠진 거 없는지 확인해요' }
    case 0:
      return {
        title: '오늘 이사 가는 날! 🎉',
        body: '고생 많으셨어요. 마지막 체크리스트만 확인해요',
      }
    default:
      return { title: '이사 알림', body: '오늘 할 일을 확인해요' } // 도달 불가(가드)
  }
}

/** 병합: 마일스톤 + 다이제스트 동시 신규 → 1건. count>=1 가정. */
export function mergedContent(day: number, firstItem: string, count: number): PushContent {
  const body = count >= 2 ? `'${firstItem}' 외 ${count - 1}건 확인하기` : `'${firstItem}' 확인하기`
  return { title: `이사 D-${day} · 오늘 챙길 일 ${count}개`, body }
}
