import type { RoomType } from '../types/photo'

/**
 * DB room 컬럼의 CHECK 제약과 1:1 매칭되는 방 메타데이터
 *
 * 순서: 촬영 가이드 권장 순서 (현관→방→화장실→주방→베란다→기타)
 * UI 카드 배치 순서로 사용되지만 강제 아님 (자유형 기록)
 */
export interface RoomMeta {
  type: RoomType
  emoji: string
  label: string
  hint: string // 카드에 표시되는 한 줄 힌트
  tip: string // 방 상세 진입 시 TipCard에 표시되는 촬영 팁
  tipDetail: string // EmptyState에 표시되는 보조 안내
  recommendedCount: number // 권장 촬영 장수 (진행률 n/target 표시용)
  maxCount: number // 무료 기준 하드 제한 (구독 확장은 8단계)
}

export const ROOM_META: RoomMeta[] = [
  {
    type: 'entrance',
    emoji: '🚪',
    label: '현관',
    hint: '도어락, 신발장, 바닥',
    tip: '도어락 작동 상태와 현관문 주변 스크래치를 찍어두세요',
    tipDetail: '현관문, 도어락, 신발장, 바닥 타일 상태를 기록하면 좋아요',
    recommendedCount: 3,
    maxCount: 4,
  },
  {
    type: 'room',
    emoji: '🛏️',
    label: '방',
    hint: '벽, 바닥, 천장, 창문',
    tip: '벽지 손상, 바닥 긁힘, 창문 잠금장치를 확인하며 찍어두세요',
    tipDetail: '벽지 찢어짐, 바닥 긁힘, 천장 얼룩, 창문 상태를 기록하면 좋아요',
    recommendedCount: 4,
    maxCount: 6,
  },
  {
    type: 'bathroom',
    emoji: '🚿',
    label: '화장실',
    hint: '타일, 변기, 세면대, 거울',
    tip: '곰팡이, 타일 깨짐, 배수구 상태를 꼼꼼히 찍어두세요',
    tipDetail: '타일 균열, 곰팡이, 변기·세면대 상태, 환풍기를 기록하면 좋아요',
    recommendedCount: 3,
    maxCount: 4,
  },
  {
    type: 'kitchen',
    emoji: '🍳',
    label: '주방',
    hint: '싱크대, 가스레인지, 환풍기',
    tip: '싱크대 물때, 가스레인지 상태, 수납장 내부를 찍어두세요',
    tipDetail: '싱크대, 가스레인지, 수납장, 타일 벽면 상태를 기록하면 좋아요',
    recommendedCount: 3,
    maxCount: 4,
  },
  {
    type: 'balcony',
    emoji: '🌿',
    label: '베란다',
    hint: '바닥, 배수구, 창틀',
    tip: '바닥 균열, 배수구 막힘, 창틀 곰팡이를 확인하며 찍어두세요',
    tipDetail: '바닥 상태, 배수구, 창틀, 세탁기 연결부를 기록하면 좋아요',
    recommendedCount: 2,
    maxCount: 3,
  },
  {
    type: 'other',
    emoji: '📦',
    label: '기타',
    hint: '복도, 수납, 보일러, 계량기',
    tip: '위 방에 해당하지 않는 곳을 자유롭게 기록하세요',
    tipDetail: '복도, 다용도실, 보일러실, 계량기 등을 기록할 수 있어요',
    recommendedCount: 2,
    maxCount: 3,
  },
]

export function getRoomMeta(type: RoomType): RoomMeta {
  const meta = ROOM_META.find((r) => r.type === type)
  if (!meta) throw new Error(`[getRoomMeta] unknown room type: ${type}`)
  return meta
}

export function isValidRoomType(value: string): value is RoomType {
  return ROOM_META.some((r) => r.type === value)
}
