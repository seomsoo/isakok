import { useEffect, useRef, useState } from 'react'

/**
 * 체크 상태가 false→true로 바뀌는 순간에만 scale pop(.animate-check)을 트리거한다 (DESIGN.md §8).
 * 이미 완료된 항목의 초기 렌더나 체크 해제 시에는 발동하지 않아, 목록 진입 시 모든 체크가
 * 한꺼번에 튀는 것을 막는다.
 * @param isCompleted - 현재 완료 상태
 * @returns animate-check 클래스 적용 여부
 */
export function useCheckPop(isCompleted: boolean): boolean {
  const [popping, setPopping] = useState(false)
  const prevRef = useRef(isCompleted)

  useEffect(() => {
    if (!prevRef.current && isCompleted) {
      setPopping(true)
      const timer = window.setTimeout(() => setPopping(false), 200)
      prevRef.current = isCompleted
      return () => clearTimeout(timer)
    }
    prevRef.current = isCompleted
  }, [isCompleted])

  return popping
}
