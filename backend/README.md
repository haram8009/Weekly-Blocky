# Backend

Supabase 기반 백엔드 개발 환경이다. 로컬 개발은 Supabase CLI가 Docker 컨테이너를 직접 관리하는 방식으로 실행한다.


## Prerequisites

- Docker Desktop
- Node.js 20.19.4 이상
- pnpm 10 이상

Docker가 실행 중인지 확인한다.

```bash
docker info
```

## How To Start

저장소 루트에서 실행한다.

```bash
corepack pnpm install
corepack pnpm supabase:start
corepack pnpm supabase:status
```

`status` 출력에서 로컬 API URL, Studio URL, anon key를 확인한다.

일반적인 로컬 기본값은 다음과 같다.

```text
API URL: http://127.0.0.1:54321
Studio URL: http://127.0.0.1:54323
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Environment

앱별 `.env` 파일에 `supabase:status`가 출력한 URL과 anon key를 넣는다.

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key>

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local anon key>
```

iOS/Android 실기기에서 테스트할 때 `127.0.0.1`은 기기 자신을 가리킨다. 실기기에서는 Mac의 LAN IP를 사용한다.

```bash
EXPO_PUBLIC_SUPABASE_URL=http://<Mac-LAN-IP>:54321
```

## Migration

로컬 DB를 migration 기준으로 초기화한다.

```bash
corepack pnpm supabase:db:reset
```

스키마 lint를 실행한다.

```bash
corepack pnpm supabase:db:lint
```

원격 dev 프로젝트에 migration을 반영할 때만 push를 사용한다.

```bash
corepack pnpm supabase:db:push
```

## Stop

```bash
corepack pnpm supabase:stop
```

## Files

- `supabase/config.toml`: 로컬 Supabase 설정
- `supabase/migrations`: DB migration
- `supabase/seed.sql`: 로컬 seed. MVP에서는 제품 예시 카테고리를 seed로 넣지 않는다.
- `supabase/docs/storage.md`: Storage bucket 설계
