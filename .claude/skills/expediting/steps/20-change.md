# Expediting, step 2: make the change

Edit only the touch set. Read a file before you edit it; the read-before-edit hook blocks the alternative.

The craft bar, in full: names carry meaning; functions are small and do one thing; flow is obvious (early returns over nesting, pure transforms over mutation); idiomatic to the stack; comments explain why and are rare; no commented-out code, no "just in case" parameters, no one-caller abstractions. A plan is not involved here, so every reading of the request is yours: when two readings touch different code, that was the step-1 question; when they touch the same code, pick the one the existing tests imply and say so in the output's Decisions line.

Add or adjust unit tests for the behaviour you changed. The fixture's own test file for the module is the first place to look; a new test file is fine when none exists.

Touch set grew past three files, or the change needs a new dependency, a second module, a contract change, a migration or a security path: stop editing and follow the Escalation section of `SKILL.md`. Keep the diff; the next lane starts from it.

Continue to `steps/30-check.md`.
