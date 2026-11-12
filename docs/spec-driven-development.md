# Spec-Driven Development

English | [中文](spec-driven-development.zh.md)

This reference defines how AnotherHarness changes are specified, approved, implemented, and verified. Every non-trivial change starts from a written spec; code implements the spec and tests prove it. Trivial changes, such as typo fixes, dependency bumps, and one-line fixes with an obvious regression test, skip the spec but still carry a test.

## Workflow

1. **Specify.** Copy [`specs/_template.md`](../specs/_template.md) to `specs/<area>/<NNNN>-<slug>.md`, where `<area>` is the owning package group and `<NNNN>` is the next free number in that area. Fill in the problem, goals, non-goals, user-visible behavior, acceptance criteria, contracts, risks, and rollout. Set the status to `draft`.
2. **Review.** The user approves the spec before implementation starts and the status becomes `approved`. An open question blocks approval; the author asks it instead of guessing an answer.
3. **Plan.** Add the implementation plan to the spec: affected packages, new or changed [capability seams](capability-seams.md), migration steps, and the test list mapped to each acceptance criterion.
4. **Implement.** Work in small, reviewable steps. Each acceptance criterion gets at least one automated test whose name contains the criterion ID (`AC-1`, `AC-2`, …). A deviation from the spec updates the spec first.
5. **Verify.** Run the focused checks from [development.md](development.md), then record in the spec's verification table the test that proves each criterion. Set the status to `implemented`.
6. **Document.** Update the owning documentation tier per [docs/AGENTS.md](AGENTS.md) and, for an externally perceptible breaking change, the upgrade guide.

## Spec rules

- A spec describes behavior and contracts, not implementation detail that the code already states.
- One spec covers one user-visible capability; split a spec that needs more than about 300 lines.
- Acceptance criteria use the form "Given context, when action, then observable result" and are independently testable.
- The contracts section names every service definition, event, configuration field, and Session log change. A model-visible input requires a Session event, per the [architecture](architecture.md#session-log).
- The pull request description links its spec.
- A spec stays in the repository after implementation as the record of why the behavior exists; a later spec that replaces it sets the old status to `superseded` and links the successor.

## Relationship to Agent Notes

A spec owns the requirement and its acceptance criteria. An [Agent Note](../.agents/notes/README.md) owns a design decision and its rationale. A spec links the notes it depends on, and a note links the spec that motivated it.
