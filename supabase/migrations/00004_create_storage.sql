-- 00004_create_storage.sql
-- Storage 버킷 생성

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', false);
