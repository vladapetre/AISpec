# Template: General Patterns Checklist

**Always applied** alongside any concern-specific templates, or as the sole template when no concern matches.

These checks target universal correctness and maintainability principles. Skip any check silently if its target construct does not appear in the changed files.

---

## SOLID

| # | Principle | Check | Fail condition | Severity |
|---|-----------|-------|----------------|----------|
| S1 | Single Responsibility | Class or function has a single purpose | A class has more than one public concern (e.g., handles HTTP routing AND business logic AND persistence) without being a deliberate coordinator | Major |
| S2 | Open/Closed | Extend via polymorphism, not modification | A `switch` or `if-else` chain dispatches on a type discriminator where adding a new case requires modifying the chain — AND the project elsewhere uses the polymorphic pattern | Minor |
| S3 | Liskov Substitution | Subtypes honour base-type contracts | A method override throws `NotImplementedException`, `NotSupportedException`, or is left empty when the base defines observable behaviour | Critical |
| S4 | Interface Segregation | Interfaces are role-specific | A concrete class implements an interface but leaves one or more methods unimplemented (stub returning default/null/empty) | Major |
| S5 | Dependency Inversion | Depend on abstractions | High-level code (handler, service, controller) directly instantiates a low-level concrete type (database, file system, network) with `new` instead of injecting an interface | Major |

---

## DRY / duplication

| # | Check | Fail condition | Severity |
|---|-------|----------------|----------|
| Dr1 | Copy-paste duplication | A block of 5 or more lines is duplicated verbatim (or near-verbatim with only variable names changed) in two or more places within the changed files | Major |
| Dr2 | Magic number | A numeric or string literal is used in logic (conditions, calculations, key names) without a named constant — AND the same literal appears more than once, or its meaning is not obvious from context alone | Minor |

---

## Correctness

| # | Check | Fail condition | Severity |
|---|-------|----------------|----------|
| Co1 | Mutating input argument | A function modifies a reference-type argument that the caller passed in — without the parameter being explicitly named or documented as an output/in-out parameter | Critical |
| Co2 | Off-by-one in loops | A loop bound uses `<` vs `<=` or `>` vs `>=` in a way that would skip the last or first element — verifiable by tracing the index against the collection size | Critical |
| Co3 | Incorrect equality | Reference equality (`==` on objects, `ReferenceEquals`, `is` without pattern) used where value equality is intended for types that override `Equals` | Critical |
| Co4 | Mutable shared state | A `static` or module-level variable is written to by instance methods without synchronisation — in a context where concurrent access is possible | Critical |

---

## Security (universal)

| # | Check | Fail condition | Severity |
|---|-------|----------------|----------|
| Se1 | Secret in source | A string literal that looks like a password, token, API key, or connection string is hard-coded in the changed files | Critical |
| Se2 | SQL / command injection | User-supplied input is concatenated into a SQL query string, shell command, or OS path without parameterisation or sanitisation | Critical |
| Se3 | Insecure default | Security-sensitive configuration (CORS wildcard `*`, `allowUnsafeEval`, `disableSSLVerification`, `DEBUG=true`) hard-coded to an insecure value in non-test code | Critical |

---

## Naming and readability

| # | Check | Fail condition | Severity |
|---|-------|----------------|----------|
| Na1 | Misleading name | A function, variable, or type name implies behaviour or semantics that differ from the implementation (e.g., `GetUser` that creates a user, `isValid` that returns a string) | Major |
| Na2 | Unexplained abbreviation | A non-standard abbreviation is used as an identifier without a comment or clear convention established in the codebase | Minor |