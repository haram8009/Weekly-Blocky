# Weekly

10분 단위 위클리 타임블로킹 다이어리 앱의 모노레포다. 모바일 앱은 React Native + Expo, 데스크톱 companion web은 Next.js, 백엔드는 Supabase를 기준으로 한다.

## 구조

```text
apps/
  mobile/       React Native + Expo 앱
  web/          Next.js companion web
packages/
  domain/       공통 타입, 시간 계산, 통계, 겹침 처리
  sync/         동기화 유틸리티
  ui/           공유 가능한 최소 UI 토큰
```

## 로컬 준비

필요한 도구:

- Node.js 20.19.4 이상
- pnpm 10 이상

처음 한 번 실행한다.

```bash
corepack enable
corepack pnpm install
```

## 개발 명령

```bash
corepack pnpm lint
corepack pnpm format
corepack pnpm test
corepack pnpm typecheck
```

모바일과 웹 실행 명령은 Expo 앱과 Next.js 앱을 생성하는 다음 마일스톤 단계에서 각 앱 패키지에 추가한다.

모바일 앱은 다음 명령으로 실행한다.

```bash
corepack pnpm --filter @weekly/mobile start
```

웹 앱은 다음 명령으로 실행한다.

```bash
corepack pnpm --filter @weekly/web dev
```

## 환경 변수

루트 예시는 `.env.example`에 둔다. 앱별 공개 환경 변수는 다음 파일을 기준으로 복사해서 사용한다.

- `apps/mobile/.env.example`
- `apps/web/.env.example`

실제 `.env` 파일과 로컬 secret은 커밋하지 않는다.

Supabase 프로젝트 값은 앱별 `.env` 파일에 다음 공개 키로 연결한다.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```
