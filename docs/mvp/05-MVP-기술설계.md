# MVP 기술설계

## 1. 문서 목적

이 문서는 MVP를 구현하기 위한 기술 선택, 아키텍처, 주요 구현 전략을 정의한다.

## 2. 기술 방향

MVP는 모바일 앱 중심 서비스로 만든다. 데스크톱 웹은 독립 제품이 아니라 모바일에서 기록한 데이터를 넓은 화면에서 보는 companion web이다.

### 최종 선택

```text
Mobile App: React Native + Expo + TypeScript
Desktop Web: React/Next.js + TypeScript
Backend: Supabase
Auth Method: Supabase 이메일/비밀번호 우선
Mobile Local Cache: Expo SQLite
Auth Session: SecureStore
Photo Access: expo-media-library
Thumbnail Processing: expo-image-manipulator
```

MVP 백엔드는 Supabase로 확정한다. 인증은 이메일/비밀번호를 우선 구현하고, 소셜 로그인은 후속 범위로 둔다.

## 3. 왜 React Native + Expo인가

### PWA를 선택하지 않는 이유

- 모바일 사진첩을 날짜/시간 기준으로 자연스럽게 조회하기 어렵다.
- 사용자가 직접 파일을 고르는 흐름에 가까워져 기록 보조 기능으로서의 매끄러움이 떨어진다.
- iOS/Android 권한 모델과 사진 메타데이터 접근을 안정적으로 다루기 어렵다.

### Flutter를 선택하지 않는 이유

- 모바일 UI 구현만 보면 좋은 선택지다.
- 다만 데스크톱 웹 열람, React 기반 관리 화면, TypeScript 도메인 로직 공유까지 고려하면 React Native + Expo가 더 일관적이다.

### Expo를 선택하는 이유

- iOS/Android를 빠르게 동시에 검증할 수 있다.
- 사진첩 접근, 권한 요청, 빌드 배포 도구를 빠르게 붙일 수 있다.
- 웹과 도메인 타입을 TypeScript로 공유하기 쉽다.

## 4. 전체 아키텍처

```text
apps/
  mobile/       React Native + Expo
  web/          Next.js companion web
packages/
  domain/       공통 타입, 시간 계산, 통계, 겹침 처리
  sync/         동기화 유틸리티
  ui/           공유 가능한 최소 UI 토큰
backend/
  supabase/     schema, policies, storage rules
```

### 데이터 흐름

```text
모바일 앱
  -> 로컬 DB 저장
  -> 동기화 큐
  -> Supabase DB
  -> 데스크톱 웹 열람
```

사진 흐름은 별도로 다룬다.

```text
모바일 사진첩
  -> 촬영 시각 조회
  -> TimeEntry와 매칭
  -> 로컬 썸네일 표시
  -> 사용자가 허용한 경우 작은 썸네일만 Storage 동기화
  -> 데스크톱 웹 표시
```

## 5. 핵심 모듈

### WeeklyGrid

역할:

- 7일 x 10분 단위 그리드 렌더링
- 기록 색상 표시
- 모바일 시간 범위 선택 처리
- 사진 썸네일 또는 사진 개수 표시

주의:

- 모바일에서는 주간 전체 그리드를 무리하게 한 화면에 압축하지 않는다.
- 오늘 중심 입력, 가로 스크롤, 일간 상세를 함께 제공한다.
- 데스크톱 웹에서는 넓은 주간 열람을 우선한다.

### EntryEditor

역할:

- 기록 추가
- 기록 수정
- 기록 삭제
- 시간 유효성 검증
- 겹침 처리 안내
- 기록 시간대 사진 표시

### entryOverlap

역할:

- 새 기록과 기존 기록의 겹침 계산
- 기존 기록 자르기
- 기존 기록 분할
- 새 기록 우선 저장

이 로직은 `packages/domain`에 두고 모바일과 웹에서 공유한다.

### PhotoMatcher

역할:

- 사진 권한 상태 확인
- 날짜별 사진 조회
- 사진 촬영 시각과 `TimeEntry` 시간 범위 매칭
- 썸네일 생성
- 숨김 처리와 연결 해제 처리

주의:

- 원본 사진을 자동 업로드하지 않는다.
- 제한된 사진 권한에서는 허용된 사진만 대상으로 한다.
- 주간 전체 사진을 한 번에 무겁게 스캔하지 않는다.

### SyncService

역할:

- 모바일 로컬 변경 큐 관리
- 서버 동기화
- 실패 재시도
- `updatedAt` 기반 단순 충돌 해결

### UserBootstrapService

역할:

- 인증된 사용자 세션 확인
- 신규 사용자 기본 프로필 생성
- 사용자별 기본 카테고리와 기본 설정 생성
- 생성된 기본 데이터를 모바일 로컬 DB에 캐시
- 재로그인, 앱 재시작, 동시 요청에도 중복 생성되지 않도록 보장

주의:

- 제품 기본 데이터는 로컬 개발용 데이터 주입으로 만들지 않는다.
- 로컬 DB 초기화는 스키마와 캐시 준비까지만 담당한다.

## 6. 상태 관리

### 영속 상태

- categories
- timeEntries
- templates
- weekReviews
- photoReferences
- settings
- syncState

### UI 상태

- 현재 보고 있는 주
- 선택된 날짜
- 선택된 시간 범위
- 열린 모달 또는 바텀시트
- 사진 권한 안내 상태
- 임시 폼 입력

### 원칙

- 도메인 계산은 `packages/domain`에서 처리한다.
- 모바일 로컬 DB와 서버 DB 접근은 서비스 계층으로 숨긴다.
- 기본 카테고리와 설정 생성은 인증된 사용자 초기화 서비스에서 처리한다.
- 사진 원본 경로는 서버 동기화 대상에 넣지 않는다.

## 7. 시간 처리 설계

### 내부 표현

시간 계산은 문자열 대신 분 단위 정수로 변환해서 처리한다.

```text
"09:30" -> 570
"24:00" -> 1440
```

저장 시에는 `HH:mm` 문자열을 유지한다.

### 유틸리티 함수

```text
parseTimeToMinutes(time: string): number
formatMinutesToTime(minutes: number): string
isTenMinuteAligned(time: string): boolean
getWeekStartDate(date: string, weekStartsOn: Weekday): string
getDatesOfWeek(weekStartDate: string): string[]
isCapturedWithinEntry(capturedAt: string, entry: TimeEntry): boolean
```

### 검증 규칙

- 분 값은 0 이상 1440 이하
- 시작 분 < 종료 분
- 시작/종료 분은 10으로 나누어 떨어져야 함
- `24:00`은 종료 시간으로만 허용

## 8. 모바일 시간 선택 설계

### 입력 방식

- 터치 드래그
- 블록 탭 후 범위 확장
- 시작/종료 시간 직접 입력

### 선택 데이터

```text
Selection
- date
- startTime
- endTime
```

선택 상태는 저장하지 않는다.

### 구현 고려

- React Native Gesture Handler 사용을 고려한다.
- 스크롤과 드래그가 충돌하지 않도록 선택 모드와 일반 스크롤 모드를 분리한다.
- 모바일 그리드의 터치 영역은 손가락으로 선택 가능한 크기를 유지한다.

## 9. 사진 처리 설계

### 권한

- 사진 기능 사용 전 권한 요청 이유를 설명한다.
- 권한 거부 시 핵심 기록 기능은 계속 동작한다.
- 제한 권한에서는 사용자가 허용한 사진만 조회한다.

### 매칭

```text
photo.capturedAt >= entry.startDateTime
photo.capturedAt < entry.endDateTime
```

### 썸네일

- 모바일에서는 로컬 썸네일을 생성해 표시한다.
- 데스크톱 웹 표시가 필요하면 작은 썸네일만 Storage에 업로드한다.
- 원본 사진은 자동 업로드하지 않는다.
- 썸네일 동기화 기본값은 비활성이다.
- 썸네일 동기화는 사용자 설정으로 켜고 끌 수 있어야 한다.

## 10. 저장소 설계

### 모바일

권장 구현:

```text
Expo SQLite: 기록, 카테고리, 회고, 사진 참조, 동기화 큐
SecureStore: 인증 세션 또는 민감 토큰
FileSystem: 생성된 로컬 썸네일 캐시
```

### 서버

권장 구현:

```text
Supabase Auth: 로그인
Supabase Postgres: 기록, 카테고리, 회고, 사진 참조
Supabase Storage: 동기화된 작은 썸네일
Row Level Security: 사용자별 데이터 격리
```

### 데스크톱 웹

- 서버 데이터를 조회한다.
- MVP에서 웹 오프라인 캐시는 필수 범위가 아니다.
- 웹에서 직접 모바일 사진첩을 읽지 않는다.

## 11. CSV 내보내기

### 범위

- 현재 주
- 전체 기록

### 구현 원칙

- 데이터를 날짜, 시작 시간 순으로 정렬한다.
- UTF-8 BOM을 붙여 한글 깨짐을 줄인다.
- 메모에 쉼표, 따옴표, 줄바꿈이 있으면 CSV 규칙에 맞게 escape한다.
- 사진 원본 경로와 썸네일 URL은 내보내지 않는다.
- 사진 수는 `photoCount`로만 포함한다.

## 12. 보안과 프라이버시

### 필수 원칙

- 사용자 데이터는 계정별로 격리한다.
- 서버 DB에는 RLS를 적용한다.
- 사진 원본은 자동 업로드하지 않는다.
- 로컬 사진 URI는 서버에 저장하지 않는다.
- 썸네일 동기화 여부는 사용자가 제어한다.

### 사용자에게 알려야 할 점

- 시간 기록은 계정 동기화를 위해 서버에 저장된다.
- 사진 원본은 자동 업로드되지 않는다.
- 데스크톱 웹에서 사진을 보려면 작은 썸네일 동기화가 필요하다.
- 사진 권한을 거부해도 기록 기능은 사용할 수 있다.

## 13. 테스트 전략

### 단위 테스트

우선 테스트 대상:

- 시간 문자열과 분 변환
- 10분 단위 검증
- 주 시작일 계산
- 기록 겹침 처리
- 색상별, 카테고리 이름별, 이모지별 합계 계산
- 미기록 시간 계산
- 사진 촬영 시각 매칭
- CSV escape 처리

### 모바일 상호작용 테스트

우선 테스트 흐름:

1. 로그인한다.
2. 신규 사용자 최초 접속 시 기본 카테고리와 기본 설정이 생성된다.
3. 시간을 선택해 기록을 만든다.
4. 기록을 수정한다.
5. 사진 권한을 허용한다.
6. 기록 시간대 사진이 표시된다.
7. 오프라인에서 기록을 수정한다.
8. 온라인 복구 후 동기화된다.

### 웹 테스트

우선 테스트 흐름:

1. 같은 계정으로 로그인한다.
2. 모바일에서 만든 기록을 확인한다.
3. 주간 합계를 확인한다.
4. 회고 메모를 수정한다.
5. CSV를 내보낸다.

## 14. 배포 전략

### 모바일

- Expo development build로 기능을 검증한다.
- 내부 테스트는 EAS Build를 사용한다.
- 앱스토어 배포는 MVP 검증 후 진행한다.

### 웹

- Next.js companion web을 Vercel에 배포한다.
- 모바일 앱과 같은 Supabase 프로젝트를 사용한다.

### 출시 전 확인

- 모바일에서 첫 기록 추가 가능
- 모바일 사진 권한 허용/거부 흐름 정상
- 사진 원본이 자동 업로드되지 않음
- 모바일-웹 동기화 정상
- 데스크톱 웹에서 주간 기록 열람 가능
- CSV 내보내기 정상

## 15. 후속 확장 고려

MVP 이후 확장 가능성을 고려해 다음을 막지 않는 구조로 만든다.

- 푸시 알림
- 타이머 모드
- 캘린더 가져오기
- 카테고리 이름 기반 색상/이모지 추천
- AI 주간 회고
- PWA 보조 제공
- 네이티브 위젯
- 원본 사진 선택 업로드

단, MVP 구현 중에는 후속 확장을 위한 추상화를 과하게 만들지 않는다.
