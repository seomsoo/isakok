/**
 * Supabase Storage 버킷 이름 — 웹(조회·signed URL)과 네이티브(직접 업로드, ADR-079)가 같은 버킷을 가리켜야 한다.
 * 마이그레이션(supabase/)의 버킷 정의와 일치해야 함.
 */
export const PROPERTY_PHOTOS_BUCKET = 'property-photos'
