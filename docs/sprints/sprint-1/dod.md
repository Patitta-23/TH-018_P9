# Part E — Product Definition of Done (DoD)

> **Sprint 1** | File: `docs/sprints/sprint-1/dod.md`

---

## Sprint 1 Definition of Done

A Sprint 1 feature is **Done** when **all** of the following conditions are met:

### Code & Behavior
- [ ] All Acceptance Criteria for the feature are implemented and observable
- [ ] No feature is marked Done based on an AI agent's claim — evidence (test output or screenshot) is required

### Tests
- [ ] All planned tests from the STS are written and passing
- [ ] At least one negative/boundary case is covered by an automated test
- [ ] Failed or skipped tests are explicitly disclosed (not silently removed)

### Business Rules
- [ ] All BR linked to the feature are enforced at the **API level** (not just the UI)
- [ ] A hidden frontend control is not considered backend authorization

### Code Review & Integration
- [ ] Code is on a feature branch (not committed directly to `main` or `sprint-1-staging`)
- [ ] A Pull Request to `sprint-1-staging` is opened
- [ ] The teammate has reviewed and approved the PR with a **substantive comment** (not just "LGTM")
- [ ] Authors do not approve their own PRs
- [ ] Integration tests pass on `sprint-1-staging` after merge

### Documentation
- [ ] Engineering contract (feature SDS, AC, STS) is recorded in `docs/sprints/sprint-1/` **before** implementation begins
- [ ] README reflects any new setup steps needed
- [ ] `docs/sprint-1/tests.md` is updated with the test results

### Release
- [ ] `sprint-1-staging` merged to `main` via a reviewed PR
- [ ] Release tag created (e.g., `v1.0.0-sprint1`)
- [ ] No real passwords, tokens, or secrets in PDF or Git

### Disclosure
- [ ] Any incomplete work, failed tests, or deferred AC are explicitly listed in Part F of the PDF

---

## Completion Evidence Required (Part F)

For each Sprint 1 feature, the PDF must include:

1. **Program screenshots** — normal journey, rule rejection, login/logout + forbidden operation
2. **Build/test output** — command used, tested commit, passing/failing/skipped counts
3. **AC-to-test results table** — AC ID → Test ID → test file → result
4. **Two test code excerpts** — one domain rule, one role/ownership restriction
5. **Issue/PR evidence** — 2 completed Issues with their PRs, branch names, review comments
6. **Git history sequence** — contract commit → test commit → implementation commit
7. **Contribution table** — both students' tasks
8. **AI-use declaration** — LLM used, key prompts, reflection

