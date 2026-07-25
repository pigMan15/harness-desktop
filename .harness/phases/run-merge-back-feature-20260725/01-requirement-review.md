# Requirement Review

## Requirements

- Each run may have an isolated Git branch/worktree.
- The desktop app must provide a merge-back action.
- Merge-back must be safe by default:
  - require the target project worktree to be clean;
  - require the run worktree to be clean;
  - use fast-forward merge only;
  - refuse detached target branches;
  - preserve run state with merge metadata.

## Non-goals

- No automatic stash.
- No merge commits.
- No force operations.
- No automatic push.
- No worktree cleanup in this increment.

