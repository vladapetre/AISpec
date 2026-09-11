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

## rework @ 7858c18 · fixture 126e6405aec0 · claude 2.1.263 (Claude Code) · 26 runs

| task | lane | n | pass@1 | pass^k | route agree | lane ok | cost $ | cost CV | wall p50 s | wall p90 s | TTFR p50 s | stops | prompts | turns | tools | re-reads | cache | tok/line |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fast-01-pagination | fast | 3 | 100% | 100% | 100% | 100% | 1.17 | 0.05 | 101 | 116 | 63 | 0.0 | 2.7 | 19 | 17 | 0.0 | 93% | 35048 |
| fast-02-config-guard | fast | 3 | 100% | 100% | 100% | 100% | 1.40 | 0.07 | 160 | 172 | 72 | 0.0 | 2.3 | 25 | 23 | 0.3 | 95% | 22387 |
| fast-03-rename | fast | 3 | 100% | 100% | 100% | 100% | 1.18 | 0.17 | 90 | 143 | 49 | 0.0 | 2.3 | 23 | 21 | 0.0 | 94% | 94409 |
| fast-04-listen-error-log | fast | 3 | 100% | 100% | 100% | 100% | 1.39 | 0.20 | 103 | 104 | 38 | 0.0 | 1.0 | 24 | 22 | 0.3 | 95% | 32831 |
| fast-05-page-size-default | fast | 3 | 100% | 100% | 100% | 100% | 1.11 | 0.10 | 81 | 103 | 36 | 0.0 | 1.3 | 24 | 22 | 0.0 | 96% | 75012 |
| fast-06-tax-rounding | fast | 3 | 100% | 100% | 100% | 100% | 1.16 | 0.09 | 126 | 129 | 58 | 0.0 | 1.3 | 27 | 25 | 0.0 | 96% | 100687 |
| gate-13-api-key-auth | design | 1 | 100% | 100% | 100% | 100% | 7.35 | 0.00 | 936 | 936 | 227 | 2.0 | 0.0 | 8 | 133 | 8.0 | 99% | 2592 |
| gate-14-status-migration | design | 1 | 100% | 100% | 100% | 100% | 11.56 | 0.00 | 1803 | 1803 | 191 | 4.0 | 12.0 | 56 | 218 | 17.0 | 98% | 9715 |
| order-07-summary-endpoint | order | 1 | 100% | 100% | 100% | 100% | 2.97 | 0.00 | 303 | 303 | 105 | 1.0 | 3.0 | 25 | 69 | 9.0 | 97% | 32222 |
| order-08-validation | order | 1 | 100% | 100% | 100% | 100% | 3.95 | 0.00 | 446 | 446 | 166 | 1.0 | 1.0 | 40 | 90 | 10.0 | 98% | 11102 |
| order-09-csv-export | order | 1 | 100% | 100% | 100% | 100% | 3.55 | 0.00 | 370 | 370 | 143 | 1.0 | 0.0 | 25 | 84 | 6.0 | 97% | 9192 |
| order-10-idempotency | order | 1 | 100% | 100% | 100% | 100% | 4.69 | 0.00 | 642 | 642 | 193 | 2.0 | 7.0 | 30 | 108 | 6.0 | 98% | 12853 |
| research-11-pricing | research | 1 | 100% | 100% | 100% | 100% | 2.38 | 0.00 | 404 | 404 | 76 | 2.0 | 0.0 | 14 | 54 | 6.0 | 98% | - |
| research-12-lifecycle | research | 1 | 100% | 100% | 100% | 100% | 3.07 | 0.00 | 446 | 446 | 70 | 1.0 | 0.0 | 4 | 51 | 9.0 | 99% | - |

## Suite (14 task(s) run by both)

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass@1 | 93% ±7% | 100% ±0% | +7% |
| pass^k | 93% ±7% | 100% ±0% | +7% |
| route agreement | 100% ±0% | 100% ±0% | +0% |
| lane as intended | 57% ±14% | 100% ±0% | +43% |
| cost per task $ | 3.37 ±0.86 | 3.35 ±0.79 | -0.02 |
| cost CV | 0.00 ±0.00 | 0.05 ±0.02 | +0.05 |
| wall p50 s | 374 ±127 | 429 ±125 | +55 |
| time to first reviewable p50 s | 130 ±36 | 106 ±17 | -24 |
| stops per task | 0.5 ±0.3 | 1.0 ±0.3 | +0.5 |
| permission prompts per task | 3.1 ±0.9 | 2.4 ±0.9 | -0.7 |
| turns per task | 25 ±2 | 25 ±3 | 0 |
| tool calls per task | 51 ±15 | 67 ±15 | +16 |
| re-reads per task | 4.6 ±2.7 | 5.1 ±1.4 | +0.5 |
| cache hit ratio | 91% ±1% | 97% ±0% | +6% |
| tokens per added line | 54678 ±24183 | 36504 ±9927 | -18174 |

### Lane fast (6 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 100% ±0% | 100% ±0% | +0% |
| cost per task $ | 1.59 ±0.12 | 1.23 ±0.05 | -0.36 |
| wall p50 s | 111 ±28 | 110 ±12 | -1 |
| time to first reviewable p50 s | 42 ±3 | 53 ±6 | +11 |
| stops per task | 0.0 ±0.0 | 0.0 ±0.0 | +0.0 |
| permission prompts per task | 1.5 ±0.6 | 1.8 ±0.3 | +0.3 |
| re-reads per task | 0.0 ±0.0 | 0.1 ±0.1 | +0.1 |
| cache hit ratio | 89% ±1% | 95% ±1% | +6% |

### Lane design (2 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 100% ±0% | 100% ±0% | +0% |
| cost per task $ | 9.30 ±2.46 | 9.45 ±2.10 | +0.15 |
| wall p50 s | 1298 ±313 | 1370 ±434 | +72 |
| time to first reviewable p50 s | 393 ±4 | 209 ±18 | -184 |
| stops per task | 2.0 ±1.0 | 3.0 ±1.0 | +1.0 |
| permission prompts per task | 6.5 ±5.5 | 6.0 ±6.0 | -0.5 |
| re-reads per task | 25.0 ±8.0 | 12.5 ±4.5 | -12.5 |
| cache hit ratio | 94% ±2% | 99% ±0% | +4% |

### Lane order (4 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 100% ±0% | 100% ±0% | +0% |
| cost per task $ | 3.76 ±1.54 | 3.79 ±0.36 | +0.03 |
| wall p50 s | 398 ±206 | 440 ±73 | +42 |
| time to first reviewable p50 s | 141 ±59 | 152 ±19 | +10 |
| stops per task | 0.8 ±0.5 | 1.3 ±0.3 | +0.5 |
| permission prompts per task | 5.0 ±0.7 | 2.8 ±1.5 | -2.2 |
| re-reads per task | 3.5 ±3.5 | 7.8 ±1.0 | +4.3 |
| cache hit ratio | 93% ±1% | 98% ±0% | +4% |

### Lane research (2 task(s))

| metric | baseline (±SE) | candidate (±SE) | delta |
|---|---|---|---|
| pass^k | 50% ±50% | 100% ±0% | +50% |
| cost per task $ | 2.02 ±0.72 | 2.73 ±0.34 | +0.70 |
| wall p50 s | 192 ±121 | 425 ±21 | +233 |
| time to first reviewable p50 s | 112 ±41 | 73 ±3 | -39 |
| stops per task | 0.0 ±0.0 | 1.5 ±0.5 | +1.5 |
| permission prompts per task | 1.0 ±1.0 | 0.0 ±0.0 | -1.0 |
| re-reads per task | 0.0 ±0.0 | 7.5 ±1.5 | +7.5 |
| cache hit ratio | 87% ±5% | 98% ±1% | +11% |

## Failed runs

- trunk research-11-pricing run 1: completed; failed checks: report_exists

no regression beyond two standard errors
