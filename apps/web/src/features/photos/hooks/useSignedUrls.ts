import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getSignedUrls } from '@/services/photos'
import { photoKeys } from './queryKeys'

/**
 * 사진 목록의 signed URL 일괄 조회
 *
 * 왜 배치인가: 사진 20장에 단일 createSignedUrl을 20번 호출하면 느림.
 * Supabase JS v2의 createSignedUrls(복수형) 1번으로 처리.
 *
 * 캐시 키: 경로를 정렬해 동일 세트는 캐시 히트.
 * staleTime 30분: signed URL 유효(1시간)의 절반.
 * placeholderData: 사진 추가 시 키가 바뀌어도 이전 URL Map을 유지하여 기존 사진 스피너 방지.
 */
export function useSignedUrls(storagePaths: string[]) {
  const sorted = [...storagePaths].sort()
  return useQuery({
    queryKey: photoKeys.signedUrls(sorted),
    queryFn: () => getSignedUrls(sorted),
    enabled: sorted.length > 0,
    staleTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
