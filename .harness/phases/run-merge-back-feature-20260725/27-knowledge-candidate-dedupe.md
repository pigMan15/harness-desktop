# Knowledge candidate dedupe

## Change

Knowledge Promotion now deduplicates candidates that represent the same run artifact content discovered through different paths, such as project-root phase and worktree phase.

## Rationale

When a run writes `19-knowledge-promotion.md` in the worktree while the project root also has or later receives a matching artifact, `sync_phase_candidates()` could create multiple draft candidates because it only checked `(project_id, run_id, source)`.

## Implementation

- Candidate sync now checks `(project_id, run_id, type, title, summary)` before inserting a draft.
- `list_candidates_with_content()` removes duplicate cards by project/run/status/type/title/summary/content hash.
- `review_candidate()` updates duplicate draft rows for the same project/run/type/title/summary together, so accepting or rejecting one card does not leave an identical draft behind.

## Validation

- `py -3 -m py_compile runtime\src\harness_runtime\knowledge\service.py`
- `py -3 -m pytest runtime\tests\knowledge\test_promotion.py --basetemp test-results\pytest-knowledge-dedupe`

Result: 6 passed.
