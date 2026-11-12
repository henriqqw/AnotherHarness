# Engineering principles

English | [中文](engineering-principles.zh.md)

This reference states the design principles every AnotherHarness change follows. The [architecture](architecture.md) defines the structure these principles protect, and [defensive-patterns.md](defensive-patterns.md) covers failure handling. When existing code violates a principle, improve it inside a [spec](spec-driven-development.md) that covers that area; unrelated work does not carry drive-by refactors.

## SOLID in a plugin architecture

- **Single responsibility.** One package owns one capability, and one module owns one reason to change. Split a module that mixes policy with mechanism, I/O with pure logic, or two concerns that change independently.
- **Open/closed.** Extend behavior through documented extension points: Cordis services, typed events, waterfalls, and registries. Do not edit the agent loop or branch on caller identity to add behavior.
- **Liskov substitution.** Every provider of a [capability seam](capability-seams.md) honors the complete service contract, including failure semantics and cancellation. Contract tests run against each provider.
- **Interface segregation.** A service definition exposes the smallest surface its consumers need. Prefer several focused services over one broad service.
- **Dependency inversion.** Consumers depend on service definitions, never on concrete providers such as `*-local`, `*-ssh`, or `*-sandbox` packages. Profiles and bundles choose providers.

## Layering

Dependencies point inward: applications depend on bundles, bundles on providers, providers on service definitions, definitions on core packages, and everything may depend on `util`. A lower layer never imports a higher layer, and `util` packages stay free of workspace dependencies. The [module graph](module-graph.md) shows the current edges.

## Clean code

- Names reveal intent; a reader understands a function from its name and signature.
- A function does one thing at one level of abstraction.
- No dead code, commented-out code, or speculative options.
- Boundaries carry explicit types; opaque identifiers are branded.
- Failures are typed values with actionable messages, per [defensive-patterns.md](defensive-patterns.md).
- Deployment-varying values are validated configuration fields; protocol constants are named.

## Tests as specification

Tests describe observable behavior, not implementation steps. Prefer focused unit tests plus one contract test per seam. Do not mock the code under test. Each spec acceptance criterion maps to at least one named test.

## Scalability

New capabilities arrive as new packages behind a seam, so they can be added, replaced, or removed without editing unrelated packages. Startup cost and per-turn work stay proportional to the plugins a profile loads.
