# Supabase 기반

## 프로젝트

- Supabase 프로젝트는 웹 콘솔에서 생성 완료했다.
- 앱에는 Supabase URL과 anon key만 공개 환경 변수로 연결한다.
- service role key는 모바일 앱과 웹 앱 환경 변수에 넣지 않는다.

## 환경 변수

| 앱 | URL | anon key |
|---|---|---|
| 모바일 | `EXPO_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| 웹 | `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

## RLS 적용 대상

MVP P0/P1 서버 저장 대상은 모두 사용자 단위로 격리한다.

| 대상 | 사용자 기준 | 메모 |
|---|---|---|
| `user_profiles` | `id = auth.uid()` | 계정별 프로필 |
| `categories` | `user_id = auth.uid()` | 카테고리 목록 |
| `time_entries` | `user_id = auth.uid()` | 실제 시간 기록 |
| `week_reviews` | `user_id = auth.uid()` | 주간 회고 |
| `photo_references` | `user_id = auth.uid()` | 사진 참조와 썸네일 URL |
| `settings` | `user_id = auth.uid()` | 사용자 설정 |
| `thumbnailStorage` bucket | 경로의 사용자 ID prefix | 사용자가 허용한 작은 썸네일만 저장 |

후속 P2 템플릿 기능을 서버에 올릴 때는 `templates`, `template_entries`에도 같은 사용자 기준 RLS를 적용한다.
