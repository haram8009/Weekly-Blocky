# Storage 설계

## `thumbnailStorage`

- 용도: 사용자가 썸네일 동기화를 켠 경우에만 작은 사진 썸네일을 저장한다.
- 공개 여부: 비공개 bucket.
- 파일 크기 제한: 512 KiB.
- 허용 MIME: `image/jpeg`, `image/png`, `image/webp`.
- 원본 사진: 저장하지 않는다.

## 경로 규칙

```text
{userId}/{photoReferenceId}.{ext}
```

- `userId`는 `auth.uid()`와 같아야 한다.
- Storage RLS는 첫 번째 경로 segment가 현재 사용자 ID인지 검사한다.
- `photo_references.thumbnail_remote_url`에는 이 경로를 기반으로 만든 접근 가능한 URL 또는 path를 저장한다.
