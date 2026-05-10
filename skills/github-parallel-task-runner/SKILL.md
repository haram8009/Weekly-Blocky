---
name: github-parallel-task-runner
description: Use in the Weekly repo when the user explicitly asks a supervisor agent to split PLAN.md work across multiple sub-agents, create isolated git worktrees and branches, have workers commit and open PRs, then review and selectively merge those PRs.
---

# GitHub Parallel Task Runner

Use this skill in `/Users/haram/dev/weekly` only when the user explicitly asks for a supervisor-driven, multi-agent GitHub workflow based on `PLAN.md`.

This skill is different from `next-task-runner`: `next-task-runner` selects and executes one small task, while this skill coordinates several worker agents, worktrees, commits, PRs, review, and limited automatic merge.

Default progress updates and final reports are in Korean.

## Preconditions

- Read `PLAN.md` first.
- Check the current state before any branching:
  - `git status --short`
  - `git remote -v`
  - `git worktree list`
- Treat local dirty files as user work. Do not revert them.
- Use `origin/main` as the default base for worker branches, even if local `main` is dirty or diverged.
- Do not run this workflow for normal single-task implementation.
- If the user asks for candidate-only, plan-only, or dry-run mode, do not create worktrees, commits, pushes, PRs, or merges.

## Supervisor Responsibilities

The supervisor owns orchestration and integration:

1. Select 2-3 independent `PLAN.md` tasks that can run in parallel.
2. Assign each worker a unique branch, worktree, task scope, file ownership, excluded scope, and verification command.
3. Spawn worker sub-agents only after the work scopes are non-overlapping enough to run safely.
4. Review each worker's diff against `origin/main`.
5. Create a temporary integration worktree, merge worker branches there, and run integration verification.
6. Push worker branches and open PRs only when the user request includes PR publishing.
7. Add supervisor review comments to each PR.
8. Merge only PRs that satisfy the limited auto-merge policy.

The supervisor must not use local `main` as an integration surface.

## Task Selection

- Scan `PLAN.md` from the top unless the user names a milestone.
- Prefer unfinished numbered implementation sections.
- Skip `산출물`, `검증 기준`, `QA 체크리스트`, release checklist items, and sections marked `후속 범위` while earlier implementation work remains.
- Keep each worker assignment to a coherent slice of about 3-6 checklist items.
- Preserve dependency order. Domain/data work should precede UI work if the UI depends on missing logic.
- Only parallelize tasks with mostly disjoint file ownership.
- Allow `PLAN.md` as a shared update file, but supervisor must review checkbox meaning conflicts before PR creation or merge.

## Branch And Worktree Rules

Use branch names in this style:

- `feat/<short-name>`
- `fix/<short-name>`
- `docs/<short-name>`

Use worktrees under `.worktrees/`:

```bash
git fetch origin main
git worktree add -b feat/<short-name> .worktrees/<short-name> origin/main
```

If `.worktrees/<short-name>` already exists:

- Check `git -C .worktrees/<short-name> status --short`.
- Reuse it only if the branch and state match the intended assignment.
- Otherwise choose a new `<short-name>` with a run id suffix.
- Never delete or reset an existing worktree unless the user explicitly asks.

## Worker Prompt Template

Give each worker a narrow, self-contained assignment:

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

Workers may commit, but must not push, open PRs, or merge unless the supervisor explicitly delegates that step.

## Worker Review

After a worker completes, inspect:

```bash
git diff --stat origin/main..<branch-name>
git diff --name-only origin/main..<branch-name>
git show --stat --oneline --decorate <branch-name>
```

Review criteria:

- Diff stays within assigned ownership.
- `PLAN.md` checkboxes match implemented and verified behavior.
- Manual QA items are not checked without actual manual verification.
- Tests or typechecks ran, or skipped verification has a clear reason.
- No user changes or unrelated work were reverted.
- Commit message uses `type: 내용` in Korean.

If the review fails, send the worker a targeted fix request in the same worktree.

## Integration Verification

Create a temporary integration branch and worktree from `origin/main`:

```bash
git worktree add -b automation/integration/<run-id> .worktrees/integration-<run-id> origin/main
```

Merge reviewed worker branches there:

```bash
git merge --no-edit <branch-a>
git merge --no-edit <branch-b>
git merge --no-edit <branch-c>
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm typecheck
```

If integration fails:

- Code failure: send the responsible worker a focused fix request.
- Missing dependencies: run install and retry.
- Merge conflict: identify overlapping files and either resolve in the integration worktree or ask the relevant worker to rebase/adjust, depending on scope and risk.

Do not merge PRs until integration verification passes or the final report clearly says verification could not be completed.

## PR Creation

Push each reviewed worker branch and open a PR when the user asked for PR publishing:

```bash
git push -u origin <branch-name>
```

Prefer the GitHub app tools for PR creation and comments when available. Use `gh` only as a fallback.

PR title should follow the commit-message style:

```text
feat: 주간 통계 계산 추가
fix: 저장 실패 표시 검증 보강
docs: GitHub 병렬 운영 스킬 추가
```

PR body:

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

Supervisor review comment:

```text
Supervisor review 통과했습니다.
- diff 범위:
- 검증:
- 자동 merge 판단:
- 남은 리스크:
```

## Limited Auto-Merge Policy

The supervisor may automatically squash-merge only low-risk PRs:

- Documentation
- Test-only changes
- Domain or data utility changes with focused tests
- Small save-failure UX or error-message fixes
- Small refactors with clear file ownership

Always stop at PR review and ask for user approval before merging:

- DB migrations
- Auth flow changes
- Deployment or production configuration
- Data deletion, synchronization, or conflict resolution
- RLS policy, Storage policy, or permission changes
- Large UI changes
- Work whose acceptance depends mainly on manual QA

Auto-merge conditions:

- PR is mergeable.
- Supervisor review comment exists.
- Integration worktree verification passed.
- `PLAN.md` updates match implementation and verification.
- The PR is not in the approval-required category above.

Default merge order:

1. Documentation and test reinforcement
2. Domain/data layer
3. App UI and screen wiring
4. Deployment or operational configuration

## Cleanup Policy

After PRs are merged or left for review, report cleanup targets:

- Merged remote branches
- Worker worktrees
- Integration worktree
- Local feature branches

Before removing anything, confirm it is clean:

```bash
git -C .worktrees/<short-name> status --short
```

Do not delete branches or worktrees unless the user asked for cleanup or the workflow explicitly includes cleanup.

## Candidate-Only Output

When the user asks for a plan, candidate list, or dry run, output in Korean:

```text
선택한 병렬 후보:
- Worker 1:
- Worker 2:
- Worker 3:

분리 기준:
- 파일 소유 범위:
- 충돌 가능성:

예상 검증:
- worker별:
- integration:

PR/merge 정책:
- 자동 merge 가능:
- 사용자 승인 필요:
```

Do not mutate files in candidate-only mode.

## Final Report

Use this concise Korean structure:

```text
분배:
- worker별 PLAN.md 위치와 범위

완료:
- worker별 commit/PR

리뷰:
- supervisor가 확인한 diff, 검증, 리스크

머지:
- merge한 PR
- 사용자 승인이 필요한 PR

검증:
- integration worktree 명령과 결과
- 못 한 검증과 이유

정리:
- 남은 worktree/branch
- 다음 추천 작업
```
