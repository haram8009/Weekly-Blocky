# MVP 데이터모델

## 1. 문서 목적

이 문서는 MVP에서 사용할 데이터 구조, 저장 규칙, 동기화 규칙, 사진 매칭 규칙을 정의한다.

## 2. 데이터 저장 원칙

- 모바일 앱은 오프라인 사용을 위해 로컬 캐시를 가진다.
- 서버는 모바일 앱과 데스크톱 웹이 같은 데이터를 보기 위한 원본 저장소 역할을 한다.
- 데스크톱 웹은 서버에 동기화된 데이터를 열람한다.
- 기본 카테고리와 기본 설정은 인증된 사용자 기준 서버 데이터로 생성하고, 모바일 로컬 DB는 생성된 데이터를 캐시한다.
- 사진 원본은 자동 업로드하지 않는다.
- 데스크톱 웹 표시가 필요한 경우 작은 썸네일만 사용자의 설정에 따라 동기화한다.

## 3. 공통 규칙

### ID

- 모든 엔티티는 고유한 `id`를 가진다.
- ID는 클라이언트에서 생성할 수 있어야 한다.
- 오프라인 생성 후 서버 동기화가 가능해야 한다.

### 사용자 소유권

서버에 저장되는 개인 데이터는 `userId`를 가진다.

```text
userId: string
```

### 날짜

- 날짜는 `YYYY-MM-DD` 형식 문자열로 저장한다.
- 시간대는 사용자의 로컬 시간대를 기준으로 한다.
- MVP에서는 여러 시간대 이동에 대한 별도 보정은 하지 않는다.

### 시간

- 시간은 `HH:mm` 형식 문자열로 저장한다.
- 저장 가능한 분 값은 `00`, `10`, `20`, `30`, `40`, `50`이다.
- 종료 시간은 시작 시간보다 커야 한다.
- `24:00`은 하루의 종료 시각으로만 허용한다.

### 동기화 공통 필드

동기화되는 엔티티는 다음 필드를 가진다.

```text
createdAt: string
updatedAt: string
deletedAt: string | null
```

- `deletedAt`이 있으면 소프트 삭제 상태다.
- MVP 충돌 해결은 `updatedAt`이 최신인 변경을 우선한다.

## 4. 엔티티 목록

| 엔티티 | 설명 | 동기화 |
|---|---|---|
| UserProfile | 사용자 기본 정보 | 서버 |
| Category | 시간 기록 분류 | 서버/로컬 |
| TimeEntry | 실제 시간 사용 기록 | 서버/로컬 |
| Template | 반복 루틴 묶음 | 서버/로컬 |
| TemplateEntry | 템플릿 안의 시간 블록 | 서버/로컬 |
| WeekReview | 주간 회고 | 서버/로컬 |
| PhotoReference | 모바일 사진첩 사진 참조 | 로컬 중심, 일부 서버 |
| AppSettings | 사용자 설정 | 서버/로컬 |
| SyncState | 모바일 동기화 상태 | 로컬 |

## 5. UserProfile

### 설명

계정별 사용자 정보다.

### 필드

```text
UserProfile
- id: string
- email: string
- displayName: string | null
- createdAt: string
- updatedAt: string
```

## 6. Category

### 설명

시간 기록에 적용되는 카테고리다.

### 필드

```text
Category
- id: string
- userId: string
- name: string
- color: string
- emoji: string
- weeklyGoalMinutes: number | null
- sortOrder: number
- isArchived: boolean
- createdAt: string
- updatedAt: string
- deletedAt: string | null
```

### 규칙

- `name`은 필수다.
- `color`는 필수다.
- `emoji`는 필수다.
- `weeklyGoalMinutes`가 없으면 목표 없음으로 취급한다.
- 사용 중인 카테고리를 삭제하면 실제 삭제 대신 `isArchived = true`로 처리한다.
- 보관 처리된 카테고리는 기존 기록에서는 보이지만 새 기록 팔레트에서는 기본적으로 숨긴다.
- 카테고리 그룹화를 위한 별도 속성은 두지 않는다.
- 같은 `color`를 사용하는 카테고리는 통계에서 같은 색상 그룹으로 묶인다.
- 통계는 카테고리 `color`, `name`, `emoji` 기준 집계를 지원한다.
- `color`, `name`, `emoji`가 변경되면 기존 기록의 통계 그룹도 현재 카테고리 설정 기준으로 다시 계산된다.
- 후속 색상/이모지 추천 기능은 `name`을 기반으로 `color`, `emoji` 기본값을 제안한다.
- 추천 기능을 추가해도 저장 모델은 변경하지 않는다.

## 7. TimeEntry

### 설명

사용자가 실제로 수행한 활동 기록이다.

### 필드

```text
TimeEntry
- id: string
- userId: string
- date: string
- startTime: string
- endTime: string
- categoryId: string
- note: string
- source: TimeEntrySource
- createdAt: string
- updatedAt: string
- deletedAt: string | null
```

### TimeEntrySource

```text
manual
template
import
```

### 규칙

- `date`, `startTime`, `endTime`, `categoryId`는 필수다.
- `note`는 빈 문자열일 수 있다.
- 같은 날짜의 실제 기록은 서로 겹치지 않는다.
- 새 기록이 기존 기록과 겹치면 새 기록을 우선하고 기존 기록을 자르거나 삭제한다.
- 카테고리가 보관 처리되어도 기존 `categoryId`는 유지한다.

## 8. Template

### 설명

반복되는 하루 루틴을 묶어 저장하는 데이터다.

### 필드

```text
Template
- id: string
- userId: string
- name: string
- description: string
- entries: TemplateEntry[]
- createdAt: string
- updatedAt: string
- deletedAt: string | null
```

### 규칙

- `name`은 필수다.
- 템플릿 엔트리끼리는 같은 템플릿 안에서 겹치지 않는 것을 기본으로 한다.
- 템플릿을 날짜에 적용하면 `TimeEntry`로 복사된다.
- 복사된 기록의 `source`는 `template`이다.

## 9. TemplateEntry

### 설명

템플릿 안에 들어가는 개별 시간 블록이다.

### 필드

```text
TemplateEntry
- id: string
- startTime: string
- endTime: string
- categoryId: string
- note: string
```

### 규칙

- 날짜는 저장하지 않는다.
- 특정 날짜에 적용할 때 날짜가 부여된다.

## 10. WeekReview

### 설명

한 주에 대한 사용자의 회고 메모다.

### 필드

```text
WeekReview
- id: string
- userId: string
- weekStartDate: string
- summary: string
- wins: string
- problems: string
- nextWeekFocus: string
- createdAt: string
- updatedAt: string
- deletedAt: string | null
```

### 규칙

- `weekStartDate`는 월요일 날짜다.
- 한 사용자에게 한 주당 하나의 `WeekReview`만 존재한다.
- 모든 텍스트 필드는 빈 문자열일 수 있다.

## 11. PhotoReference

### 설명

모바일 사진첩에서 읽은 사진을 기록 시간대와 연결하기 위한 참조 데이터다. 원본 사진을 서버에 자동 업로드하지 않는다.

### 필드

```text
PhotoReference
- id: string
- userId: string
- entryId: string | null
- date: string
- capturedAt: string
- localAssetId: string
- localUri: string | null
- thumbnailLocalUri: string | null
- thumbnailRemoteUrl: string | null
- width: number | null
- height: number | null
- mediaType: "photo" | "video"
- matchType: "auto" | "manual"
- isHidden: boolean
- permissionScope: "all" | "limited"
- createdAt: string
- updatedAt: string
- deletedAt: string | null
```

### 저장 범위

| 필드 | 모바일 로컬 | 서버 |
|---|---|---|
| localAssetId | 저장 | 저장 가능 |
| localUri | 저장 | 저장하지 않음 |
| thumbnailLocalUri | 저장 | 저장하지 않음 |
| thumbnailRemoteUrl | 저장 | 저장 |
| capturedAt | 저장 | 저장 |
| entryId | 저장 | 저장 |
| isHidden | 저장 | 저장 |

### 규칙

- `localUri`는 기기 내부 경로이므로 서버에 저장하지 않는다.
- `thumbnailRemoteUrl`은 사용자가 썸네일 동기화를 허용한 경우에만 존재한다.
- 원본 사진은 자동 업로드하지 않는다.
- 사진 권한이 제한 상태면 허용된 사진만 `PhotoReference` 대상이 된다.
- 사용자가 숨긴 사진은 그리드와 회고 화면에서 표시하지 않는다.

## 12. AppSettings

### 설명

사용자별 설정이다.

### 필드

```text
AppSettings
- id: string
- userId: string
- weekStartsOn: Weekday
- visibleStartTime: string
- visibleEndTime: string
- useFullDayView: boolean
- photoMatchingEnabled: boolean
- thumbnailSyncEnabled: boolean
- lastOpenedWeekStartDate: string | null
- createdAt: string
- updatedAt: string
```

### Weekday

```text
monday
sunday
```

### 기본값

```json
{
  "weekStartsOn": "monday",
  "visibleStartTime": "05:00",
  "visibleEndTime": "24:00",
  "useFullDayView": false,
  "photoMatchingEnabled": false,
  "thumbnailSyncEnabled": false,
  "lastOpenedWeekStartDate": null
}
```

## 13. SyncState

### 설명

모바일 앱의 로컬 변경 사항과 서버 동기화 상태를 관리한다.

### 필드

```text
SyncState
- entityType: string
- entityId: string
- operation: "create" | "update" | "delete"
- status: "pending" | "synced" | "failed"
- retryCount: number
- lastError: string | null
- updatedAt: string
```

### 규칙

- 모바일 앱에서 오프라인 변경이 생기면 `pending` 상태로 저장한다.
- 동기화 성공 시 `synced`로 변경한다.
- 실패 시 `failed` 또는 재시도 대기 상태로 둔다.

## 14. 사진 매칭 규칙

### 기본 매칭

```text
사진 촬영 시각 >= TimeEntry 시작 시각
사진 촬영 시각 < TimeEntry 종료 시각
```

### 조회 단위

- 모바일 앱은 기록이 있는 날짜의 사진만 우선 조회한다.
- 주간 화면 진입 시 전체 주의 사진을 한 번에 무겁게 읽지 않는다.
- 오늘 상세 또는 기록 상세 진입 시 해당 날짜 사진을 조회한다.

### 표시 규칙

- 한 기록에 여러 사진이 있으면 최대 3개의 썸네일을 먼저 표시한다.
- 더 많은 사진은 기록 상세에서 확인한다.
- 사용자가 숨긴 사진은 표시하지 않는다.
- 동기화된 썸네일이 없는 사진은 데스크톱 웹에서 표시하지 않는다.

## 15. 파생 데이터

파생 데이터는 저장하지 않고 계산한다.

### 기록 시간

```text
recordedMinutes = sum(TimeEntry.durationMinutes)
```

### 미기록 시간

```text
visibleMinutes = visibleEndTime - visibleStartTime
unrecordedMinutes = visibleMinutes - recordedMinutesInsideVisibleRange
```

### 기록 완성률

```text
completionRate = recordedMinutesInsideVisibleRange / visibleMinutes
```

### 카테고리 ID별 합계

```text
categoryTotalMinutes = sum(TimeEntry.durationMinutes where categoryId matches)
```

### 카테고리 이름별 합계

```text
categoryNameTotalMinutes = sum(TimeEntry.durationMinutes grouped by Category.name)
```

### 카테고리 색상별 합계

```text
categoryColorTotalMinutes = sum(TimeEntry.durationMinutes grouped by Category.color)
```

### 카테고리 이모지별 합계

```text
categoryEmojiTotalMinutes = sum(TimeEntry.durationMinutes grouped by Category.emoji)
```

### 사진 개수

```text
photoCount = count(PhotoReference where entryId matches and isHidden is false)
```

## 16. 저장소 구조

### 모바일 로컬

모바일 앱은 로컬 캐시를 가진다.

```text
categories
timeEntries
templates
weekReviews
photoReferences
settings
syncState
```

권장 구현은 Expo SQLite 또는 동등한 모바일 로컬 DB다. 제품 기본 데이터의 생성 주체는 로컬 개발 DB가 아니라 인증된 사용자 초기화 흐름이다.

### 서버

서버는 계정 기반 동기화와 데스크톱 웹 열람을 위해 사용한다.

```text
userProfiles
categories
timeEntries
templates
weekReviews
photoReferences
settings
thumbnailStorage
```

### 데스크톱 웹

데스크톱 웹은 서버 데이터를 조회한다. MVP에서 오프라인 웹 지원은 필수 범위가 아니다.

## 17. CSV 내보내기 모델

### TimeEntry CSV

```text
date,startTime,endTime,durationMinutes,categoryName,categoryColor,categoryEmoji,note,source,photoCount,createdAt,updatedAt
```

### 규칙

- CSV는 UTF-8 BOM을 포함해 한글 깨짐을 줄인다.
- 줄바꿈이 포함된 메모는 CSV 표준에 맞게 따옴표로 감싼다.
- 사진 원본 경로, 로컬 URI, 썸네일 URL은 CSV에 포함하지 않는다.

## 18. 데이터 무결성 규칙

- 서버 데이터는 사용자별로 격리되어야 한다.
- `TimeEntry`는 존재하는 `Category`를 참조해야 한다.
- 카테고리 삭제는 기본적으로 보관 처리다.
- 날짜별 실제 기록은 겹치지 않아야 한다.
- 모든 기록은 10분 단위 시간에 맞아야 한다.
- 신규 사용자의 회원가입 또는 최초 로그인 후 기본 카테고리와 기본 설정을 사용자 소유 서버 데이터로 생성한다.
- 모바일 앱은 서버에서 생성된 기본 카테고리와 기본 설정을 로컬 DB에 캐시한다.
- 기본 데이터 초기화는 여러 번 실행되어도 사용자별 중복 데이터가 생기지 않아야 한다.

## 19. 마이그레이션 원칙

데이터 구조 변경을 고려해 버전 필드를 둔다.

```text
schemaVersion: number
```

초기 버전은 `1`로 시작한다. 이후 구조 변경 시 마이그레이션 함수를 통해 기존 데이터를 보존한다.
