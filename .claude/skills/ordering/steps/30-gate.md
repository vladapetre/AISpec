# Ordering, step 3: the user gate

`harness next <id>` said `approve_phase` by user, with `phase: n` and `options`. This is the one place the lane stops. Render one packet, send a push notification when the tool exists, and end the turn.

Packet, built from the developer's last block and `harness next`:

```
▶ <id> · phase <n>/<total> done · <the developer's one-sentence line>
Tests: <passed|failed> · Lint: <passed|failed> · Verified: <command → result | no drivable surface>
Files: <path>, <path> (+<k> more)
[a] approve · [r] run through <m> · [x] reject: <why>
```

The `[r]` option appears only when `harness next` listed it. Add one line `Decisions: …` when the developer recorded any. Nothing else: no summary of the plan, no restatement of the contract.

Apply the reply, then continue in the same turn:

| Reply | Command | Then |
|---|---|---|
| `a`, `approved`, `ok`, `yes` | `harness route <id> --verdict approved --agent user --phase <n>` | `harness next`: next phase or review |
| `r <m>`, `approved through <m>`, `run to <m>` | `harness route <id> --verdict approved --agent user --phase <n> --through <m>` | continue the developer with `run through <m>` |
| `x <why>`, `reject: <why>`, anything else with a reason | `harness route <id> --verdict rejected --agent user --phase <n> --reason "<why>"` | `SendMessage` the developer: `work: <id>`, `phase: <n>`, `rejected: <why verbatim>` |
| a question | answer it | re-render the packet |

A reply that is neither an approval, a run grant, a rejection with a reason, nor a question is asked back once: "approve, run through, or reject with a reason?" Silence is not approval.

Never two packets in a row without a reply in between, and never a packet for a phase whose `PHASE DONE` block you have not seen.
