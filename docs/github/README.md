# GitHub 병렬 Agent 운영

이 문서는 사용자가 GitHub 자동화, 병렬 sub-agent 작업, PR 생성, 자동 merge를 명시적으로 요청한 경우에만 적용한다. 일반 작업에서는 `AGENTS.md`의 기본 Git 규칙을 우선한다.

## 기본 원칙

- supervisor는 로컬 `main` 작업트리에서 통합 merge나 검증을 하지 않는다. 로컬 `main`은 사용자 작업이나 원격 변경과 diverge될 수 있다.
- 모든 worker는 `origin/main`에서 분기한 전용 worktree와 branch에서만 작업한다.
- worker 수는 기본 2-3개로 제한한다. 더 많이 띄우면 supervisor 리뷰와 `PLAN.md` 충돌 관리가 병목이 된다.
- `PLAN.md`의 앞쪽 미완료 항목을 우선하되, 후속 범위와 수동 QA 항목은 실제 요청이나 검증 전에는 선택하지 않는다.
- 병렬화는 파일 소유 범위가 분리되는 작업에만 적용한다.

## 역할

### Supervisor

- `PLAN.md` 기준으로 병렬화할 작업을 고른다.
- 각 worker의 branch, worktree, 소유 파일 범위, 제외 범위, 검증 명령을 정한다.
- worker 결과를 diff 기준으로 리뷰한다.
- 통합 worktree에서 전체 merge와 검증을 수행한다.
- PR을 생성하고 supervisor review 코멘트를 남긴다.
- 자동 merge 가능 여부를 판단하고, 조건을 만족하면 squash merge한다.

### Worker

- 지정된 worktree와 branch 안에서만 작업한다.
- 배정받은 파일 범위 밖 변경을 만들지 않는다.
- 구현, focused test, 관련 typecheck/test, `PLAN.md` 체크 갱신을 한 번에 끝낸다.
- 커밋 메시지는 `type: 내용` 형식의 한국어로 작성한다.
- push, PR 생성, merge는 supervisor 지시 없이는 하지 않는다.

## 작업 흐름

1. 원격과 기준 브랜치를 확인한다.

```bash
git remote -v
git fetch origin main
git status -sb
```

2. `PLAN.md`에서 병렬화 후보를 고른다.

- 먼저 나온 미완료 구현 섹션을 우선한다.
- 한 worker가 3-6개 체크박스 안에서 끝낼 수 있는 크기로 자른다.
- 같은 파일을 여러 worker가 수정하지 않도록 소유 범위를 나눈다.
- `PLAN.md`만 공통 수정 파일로 허용하고, supervisor가 최종 의미 충돌을 확인한다.

3. worker별 worktree와 branch를 만든다.

```bash
git worktree add -b feat/<short-name> .worktrees/<short-name> origin/main
```

브랜치 이름은 다음 형식을 쓴다.

- `feat/<short-name>`
- `fix/<short-name>`
- `docs/<short-name>`

4. worker에게 작업을 배정한다.

```text
너는 Weekly repo의 병렬 worker입니다.
반드시 /Users/haram/dev/weekly/.worktrees/<short-name> 에서만 작업하세요.
현재 branch는 <branch-name> 입니다.
다른 worker도 동시에 작업 중이므로 다른 worktree/branch의 변경을 되돌리거나 건드리지 마세요.

목표:
- PLAN.md 위치:
- 구현 범위:
- 제외 범위:

작업 방식:
1. git status --short 확인
2. PLAN.md와 필요한 문서만 좁게 읽기
3. 구현과 focused test 추가
4. 관련 검증 실행
5. 구현/검증된 PLAN.md 체크박스만 갱신
6. 변경 파일만 stage해서 한국어 커밋 작성
7. 최종 보고에 변경 파일, 검증, PLAN.md 체크, commit hash 포함

소유 범위:
- 수정 가능:
- 수정 금지:
```

5. worker가 끝나면 supervisor가 diff를 리뷰한다.

```bash
git diff --stat origin/main..<branch-name>
git diff --name-only origin/main..<branch-name>
git show --stat --oneline --decorate <branch-name>
```

리뷰 기준은 다음과 같다.

- 배정 범위 밖 파일을 수정하지 않았는가
- `PLAN.md` 체크가 실제 구현과 검증에 맞는가
- 수동 QA 항목을 자동으로 체크하지 않았는가
- 테스트가 실패하거나 생략된 이유가 없는가
- 사용자 변경을 되돌린 흔적이 없는가

## 통합 검증

supervisor는 매 실행마다 임시 integration worktree를 만든다. `develop`은 기본 integration branch로 쓰지 않는다. `develop`은 staging 배포나 장기 QA 환경이 필요할 때 별도 전략으로 도입한다.

브랜치 이름 형식:

```text
automation/integration/<YYYYMMDD-HHMM>-<topic>
```

예시:

```bash
git worktree add -b automation/integration/20260511-0200-m6-batch .worktrees/integration-20260511-0200-m6-batch origin/main
```

통합 검증 순서:

```bash
git merge --no-edit <branch-a>
git merge --no-edit <branch-b>
git merge --no-edit <branch-c>
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm typecheck
```

검증 실패 시:

- 코드 실패면 해당 worker branch로 되돌려 수정한다.
- `node_modules` 누락이면 `corepack pnpm install --frozen-lockfile` 후 재실행한다.
- merge conflict면 supervisor가 충돌 원인을 보고, 작업 범위가 겹친 worker에게 재작업을 지시한다.

## PR 작성

worker branch를 push한다.

```bash
git push -u origin <branch-name>
```

PR 제목은 커밋 메시지 형식을 따른다.

```text
feat: 주간 통계 계산 추가
fix: 저장 실패 표시 검증 보강
docs: GitHub 병렬 운영 문서 추가
```

PR 본문 템플릿:

```markdown
## 요약
-

## 검증
- `corepack pnpm test`
- `corepack pnpm typecheck`

## PLAN.md
- 체크한 항목:
- 남긴 항목:

## 리스크
- 자동 merge 가능 여부:
- 수동 검증 필요 여부:
```

supervisor review 코멘트 템플릿:

```text
Supervisor review 통과했습니다.
- diff 범위:
- 검증:
- 자동 merge 판단:
- 남은 리스크:
```

## 자동 merge 정책

다음 작업은 조건을 만족하면 supervisor가 자동 squash merge할 수 있다.

- 문서
- domain 유틸
- 테스트 보강
- 작은 저장 실패 UX 또는 오류 메시지 처리
- 파일 범위가 명확한 작은 refactor

다음 작업은 PR 생성과 review까지만 진행하고 사용자 승인을 받은 뒤 merge한다.

- DB migration
- 인증 흐름
- 배포 설정
- 데이터 삭제, 동기화, conflict resolution
- 권한, Storage policy, RLS policy
- 대형 UI 변경
- 수동 QA가 핵심인 작업

자동 squash merge 조건:

- PR이 mergeable 상태다.
- supervisor review 코멘트가 있다.
- integration worktree에서 `corepack pnpm test`가 통과했다.
- integration worktree에서 `corepack pnpm typecheck`가 통과했다.
- `PLAN.md` 체크가 구현/검증과 일치한다.
- 승인 필요 작업 목록에 해당하지 않는다.

merge 순서는 다음을 기본값으로 한다.

1. 문서와 검증 보강
2. domain/data 계층
3. app UI와 화면 연결
4. 배포나 운영 설정

## 정리 정책

merge 완료 후 supervisor는 정리 대상을 보고한다.

- merged remote branch
- worker worktree
- integration worktree
- local feature branch

정리 명령 예시:

```bash
git push origin --delete <branch-name>
git worktree remove .worktrees/<short-name>
git branch -d <branch-name>
git worktree remove .worktrees/integration-<run-id>
git branch -d automation/integration/<run-id>
```

정리 전에는 항상 해당 worktree가 clean인지 확인한다.

```bash
git -C .worktrees/<short-name> status --short
```

## 주의 사항

- 로컬 `main`이 `origin/main`과 ahead/behind 상태여도, 병렬 자동화는 `origin/main` 기준으로 진행한다.
- 사용자가 만든 변경이나 별도 커밋을 rebase, reset, checkout으로 되돌리지 않는다.
- `PLAN.md`는 진행 기록이므로 체크박스 변경은 구현과 검증의 증거가 있을 때만 한다.
- 수동 검증 항목은 실제 기기, 브라우저, Supabase 환경에서 확인한 뒤에만 체크한다.
