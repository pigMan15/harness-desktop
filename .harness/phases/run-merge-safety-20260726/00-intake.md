# INTAKE

- Run ID: `run-merge-safety-20260726`
- Intent: `FEATURE`
- Risk: `MEDIUM`
- User-confirmed objective: improve Run worktree merge-back usability without risking accidental code changes.

## Scope

1. Add a read-only merge preflight before any Git mutation.
2. Replace the single raw error notice with structured, actionable diagnostics.
3. Clearly separate operations the application can perform safely from operations the user must complete with Git.
4. Preserve clean-worktree, revision, branch, and fast-forward safety checks in Runtime.
5. Provide diff/commit/file summaries before the final merge confirmation.

## Safety boundaries

- Never discard, reset, stash, rebase, force-push, or auto-resolve conflicts.
- Never mutate the target repository during preflight.
- Merge-back remains fast-forward-only in this delivery.
- Revalidate the Run revision and repository state at execution time.
- Preserve raw diagnostics for troubleshooting while presenting concise user guidance.

## Non-goals

- Automatic conflict resolution.
- Automatic non-fast-forward merge commits.
- Automatic cleanup or deletion of Run worktrees.
- Remote Git push or release publication.

## Acceptance direction

The Runs module must show whether merge-back is safe, why it is blocked, which files or commits are involved, and what the user should do next. A failed preflight or merge must leave project code unchanged.
