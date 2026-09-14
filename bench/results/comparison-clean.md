## trunk @ 18adac4 · fixture 126e6405aec0 · claude 2.1.263 (Claude Code) · 14 runs

| task | lane | n | pass@1 | pass^k | route agree | lane ok | cost $ | cost CV | wall p50 s | wall p90 s | TTFR p50 s | stops | prompts | turns | tools | re-reads | cache | tok/line |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fast-01-pagination | fast | 1 | 100% | 100% | 100% | 100% | 2.15 | 0.00 | 251 | 251 | 49 | 0.0 | 4.0 | 34 | 33 | 0.0 | 94% | 63656 |
| fast-02-config-guard | fast | 1 | 100% | 100% | 100% | 100% | 1.65 | 0.00 | 98 | 98 | 50 | 0.0 | 2.0 | 23 | 22 | 0.0 | 90% | 15120 |
| fast-03-rename | fast | 1 | 100% | 100% | 100% | 100% | 1.34 | 0.00 | 59 | 59 | 32 | 0.0 | 0.0 | 17 | 16 | 0.0 | 86% | 59072 |
| fast-04-listen-error-log | fast | 1 | 100% | 100% | 100% | 100% | 1.36 | 0.00 | 88 | 88 | 37 | 0.0 | 0.0 | 14 | 13 | 0.0 | 91% | 95888 |
| fast-05-page-size-default | fast | 1 | 100% | 100% | 100% | 100% | 1.55 | 0.00 | 82 | 82 | 36 | 0.0 | 2.0 | 18 | 17 | 0.0 | 90% | 303565 |
| fast-06-tax-rounding | fast | 1 | 100% | 100% | 100% | 100% | 1.50 | 0.00 | 87 | 87 | 46 | 0.0 | 1.0 | 19 | 18 | 0.0 | 86% | 53022 |
| gate-13-api-key-auth | design | 1 | 100% | 100% | 100% | 0% | 6.85 | 0.00 | 985 | 985 | 397 | 1.0 | 1.0 | 19 | 108 | 17.0 | 92% | 4340 |
| gate-14-status-migration | design | 1 | 100% | 100% | 100% | 0% | 11.76 | 0.00 | 1611 | 1611 | 389 | 3.0 | 12.0 | 29 | 211 | 33.0 | 96% | 5161 |
| order-07-summary-endpoint | order | 1 | 100% | 100% | 100% | 0% | 1.83 | 0.00 | 165 | 165 | 59 | 1.0 | 5.0 | 26 | 24 | 0.0 | 94% | 28515 |
| order-08-validation | order | 1 | 100% | 100% | 100% | 0% | 2.16 | 0.00 | 197 | 197 | 61 | 0.0 | 4.0 | 28 | 27 | 0.0 | 94% | 6278 |
| order-09-csv-export | order | 1 | 100% | 100% | 100% | 0% | 2.71 | 0.00 | 216 | 216 | 133 | 0.0 | 4.0 | 48 | 47 | 0.0 | 90% | 8100 |
| order-10-idempotency | order | 1 | 100% | 100% | 100% | 0% | 8.33 | 0.00 | 1014 | 1014 | 311 | 2.0 | 7.0 | 26 | 125 | 14.0 | 95% | 13423 |
| research-11-pricing | research | 1 | 0% | 0% | 100% | 100% | 1.30 | 0.00 | 71 | 71 | 71 | 0.0 | 0.0 | 17 | 16 | 0.0 | 82% | - |
| research-12-lifecycle | research | 1 | 100% | 100% | 100% | 100% | 2.75 | 0.00 | 312 | 312 | 153 | 0.0 | 2.0 | 31 | 30 | 0.0 | 92% | - |

## rework @ a380774 · fixture 126e6405aec0 · claude 2.1.268 (Claude Code) · 26 runs

| task | lane | n | pass@1 | pass^k | route agree | lane ok | cost $ | cost CV | wall p50 s | wall p90 s | TTFR p50 s | stops | prompts | turns | tools | re-reads | cache | tok/line |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fast-01-pagination | fast | 3 | 100% | 100% | 100% | 100% | 1.27 | 0.22 | 80 | 86 | 30 | 0.0 | 0.0 | 21 | 19 | 0.0 | 94% | 72099 |
| fast-02-config-guard | fast | 3 | 100% | 100% | 100% | 100% | 1.39 | 0.17 | 89 | 97 | 29 | 0.0 | 1.3 | 25 | 23 | 0.3 | 95% | 36050 |
| fast-03-rename | fast | 3 | 100% | 100% | 100% | 100% | 0.90 | 0.08 | 65 | 89 | 25 | 0.0 | 0.0 | 23 | 21 | 0.0 | 95% | 123458 |
| fast-04-listen-error-log | fast | 3 | 100% | 100% | 100% | 100% | 1.06 | 0.09 | 87 | 109 | 35 | 0.0 | 0.3 | 19 | 17 | 0.0 | 95% | 24292 |
| fast-05-page-size-default | fast | 3 | 100% | 100% | 100% | 100% | 1.10 | 0.15 | 93 | 149 | 30 | 0.0 | 1.3 | 25 | 23 | 0.0 | 96% | 72859 |
| fast-06-tax-rounding | fast | 3 | 100% | 100% | 100% | 100% | 1.08 | 0.09 | 88 | 94 | 34 | 0.0 | 0.0 | 24 | 22 | 0.0 | 96% | 96873 |
| gate-13-api-key-auth | design | 1 | 100% | 100% | 100% | 100% | 5.98 | 0.00 | 838 | 838 | 171 | 2.0 | 1.0 | 8 | 144 | 10.0 | 99% | 2549 |
| gate-14-status-migration | design | 1 | 100% | 100% | 100% | 100% | 8.51 | 0.00 | 966 | 966 | 189 | 1.0 | 1.0 | 15 | 175 | 22.0 | 95% | 3643 |
| order-07-summary-endpoint | order | 1 | 100% | 100% | 100% | 100% | 2.62 | 0.00 | 280 | 280 | 124 | 1.0 | 0.0 | 24 | 59 | 4.0 | 97% | 42669 |
| order-08-validation | order | 1 | 100% | 100% | 100% | 100% | 3.46 | 0.00 | 486 | 486 | 161 | 1.0 | 0.0 | 24 | 78 | 5.0 | 97% | 9098 |
| order-09-csv-export | order | 1 | 100% | 100% | 100% | 100% | 3.41 | 0.00 | 407 | 407 | 149 | 1.0 | 0.0 | 27 | 78 | 4.0 | 97% | 11065 |
| order-10-idempotency | order | 1 | 100% | 100% | 100% | 100% | 3.89 | 0.00 | 491 | 491 | 157 | 1.0 | 0.0 | 23 | 84 | 5.0 | 97% | 7876 |
| research-11-pricing | research | 1 | 100% | 100% | 100% | 100% | 3.28 | 0.00 | 550 | 550 | 70 | 2.0 | 0.0 | 19 | 65 | 13.0 | 98% | - |
| research-12-lifecycle | research | 1 | 100% | 100% | 100% | 100% | 3.66 | 0.00 | 653 | 653 | 135 | 2.0 | 0.0 | 23 | 71 | 14.0 | 98% | - |

## Suite (14 task(s) run by both)

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass@1 | 93% ±7% | 100% ±0% | +7% |
| pass^k | 93% ±7% | 100% ±0% | +7% |
| route agreement | 100% ±0% | 100% ±0% | +0% |
| lane as intended | 57% ±14% | 100% ±0% | +43% |
| cost per task $ | 3.37 ±0.86 | 2.97 ±0.58 | -0.40 |
| cost CV | 0.00 ±0.00 | 0.06 ±0.02 | +0.06 |
| wall p50 s | 374 ±127 | 370 ±82 | -4 |
| time to first reviewable p50 s | 130 ±36 | 96 ±17 | -35 |
| stops per task | 0.5 ±0.3 | 0.8 ±0.2 | +0.3 |
| permission prompts per task | 3.1 ±0.9 | 0.4 ±0.1 | -2.8 |
| turns per task | 25 ±2 | 21 ±1 | -3 |
| tool calls per task | 51 ±15 | 63 ±13 | +12 |
| re-reads per task | 4.6 ±2.7 | 5.5 ±1.8 | +1.0 |
| cache hit ratio | 91% ±1% | 97% ±0% | +6% |
| tokens per added line | 54678 ±24183 | 41878 ±11705 | -12801 |

### Lane fast (6 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 100% ±0% | 100% ±0% | +0% |
| cost per task $ | 1.59 ±0.12 | 1.13 ±0.07 | -0.46 |
| wall p50 s | 111 ±28 | 84 ±4 | -27 |
| time to first reviewable p50 s | 42 ±3 | 31 ±1 | -11 |
| stops per task | 0.0 ±0.0 | 0.0 ±0.0 | +0.0 |
| permission prompts per task | 1.5 ±0.6 | 0.5 ±0.3 | -1.0 |
| re-reads per task | 0.0 ±0.0 | 0.1 ±0.1 | +0.1 |
| cache hit ratio | 89% ±1% | 95% ±0% | +6% |

### Lane design (2 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 100% ±0% | 100% ±0% | +0% |
| cost per task $ | 9.30 ±2.46 | 7.25 ±1.26 | -2.06 |
| wall p50 s | 1298 ±313 | 902 ±64 | -396 |
| time to first reviewable p50 s | 393 ±4 | 180 ±9 | -213 |
| stops per task | 2.0 ±1.0 | 1.5 ±0.5 | -0.5 |
| permission prompts per task | 6.5 ±5.5 | 1.0 ±0.0 | -5.5 |
| re-reads per task | 25.0 ±8.0 | 16.0 ±6.0 | -9.0 |
| cache hit ratio | 94% ±2% | 97% ±2% | +3% |

### Lane order (4 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 100% ±0% | 100% ±0% | +0% |
| cost per task $ | 3.76 ±1.54 | 3.34 ±0.26 | -0.41 |
| wall p50 s | 398 ±206 | 416 ±49 | +18 |
| time to first reviewable p50 s | 141 ±59 | 148 ±8 | +7 |
| stops per task | 0.8 ±0.5 | 1.0 ±0.0 | +0.3 |
| permission prompts per task | 5.0 ±0.7 | 0.0 ±0.0 | -5.0 |
| re-reads per task | 3.5 ±3.5 | 4.5 ±0.3 | +1.0 |
| cache hit ratio | 93% ±1% | 97% ±0% | +4% |

### Lane research (2 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 50% ±50% | 100% ±0% | +50% |
| cost per task $ | 2.02 ±0.72 | 3.47 ±0.19 | +1.45 |
| wall p50 s | 192 ±121 | 601 ±52 | +410 |
| time to first reviewable p50 s | 112 ±41 | 102 ±32 | -10 |
| stops per task | 0.0 ±0.0 | 2.0 ±0.0 | +2.0 |
| permission prompts per task | 1.0 ±1.0 | 0.0 ±0.0 | -1.0 |
| re-reads per task | 0.0 ±0.0 | 13.5 ±0.5 | +13.5 |
| cache hit ratio | 87% ±5% | 98% ±0% | +11% |

## Failed runs

- trunk research-11-pricing run 1: completed; failed checks: report_exists

## Paired deltas (candidate minus baseline, per task)

- pass^k: +7% ±7% over 14 task(s); worse on 0
- cost: $-0.40 ±$0.46 over 14 task(s); dearer on 5
- rate-limit events seen: baseline 0, candidate 71 (throttling, not harness latency)

no regression beyond two standard errors of the paired differences
