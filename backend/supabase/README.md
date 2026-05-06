# Supabase 기반

## 프로젝트

- Supabase 프로젝트는 웹 콘솔에서 생성 완료했다.
- 로컬 Supabase CLI 구조는 `backend/supabase`에 둔다.
- 로컬 시작 절차는 `backend/README.md`에 둔다.
- DB 변경은 `backend/supabase/migrations`의 SQL migration으로 관리한다.
- 앱에는 Supabase URL과 publishable key만 공개 환경 변수로 연결한다.
- service role key는 모바일 앱과 웹 앱 환경 변수에 넣지 않는다.

## 환경 변수

| 앱 | URL | publishable key |
|---|---|---|
| 모바일 | `EXPO_PUBLIC_SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| 웹 | `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |

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

## M2 서버 스키마

- `user_profiles`, `categories`, `time_entries`, `week_reviews`, `photo_references`, `settings` 테이블은 `20260507020000_m2_server_schema.sql`에서 생성한다.
- 서버 컬럼은 Supabase/Postgres 관례에 맞춰 `snake_case`를 사용한다.
- `categories`는 사용자가 직접 생성한 데이터만 저장한다. 예시 카테고리는 서버에 자동 삽입하지 않는다.
- `time_entries`는 같은 사용자, 같은 날짜 안에서 삭제되지 않은 기록끼리 시간이 겹치지 않도록 exclusion constraint를 둔다.
- 앱에서 hard delete를 호출하지 않도록 사용자 테이블에는 delete RLS policy를 만들지 않는다. 삭제는 `deleted_at` soft delete로 처리한다.
