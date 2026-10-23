# Live acceptance results — 22 October 2026

**Historical version 0.1 results.** The separate-estimate recommendation and 100-row tool ceiling below are superseded by [version 0.2 results](revision-v0.2-results.md): 250 items now pass in one estimate and one official workbook. The original failed export and earlier evidence are retained for provenance.

**PARTIAL GO for the delivered browser-assisted workflow.** The real calculator loaded generated modules, fetched fresh native prices, preserved an estimate across a reload and generated its own Excel downloads. Account Save/API authentication and negotiated prices remain untested. A single 250-row native export failed, so the released tool caps a batch at 100 rows and recommends 50.

## Functional proof

The initial scratch estimate was created with the site's own product picker action. A real calculator-created VM state was captured, transformed into a Linux D4s v5 in UK South, and opened as a new estimate through the site's native frontend action.

| Check | Observed result |
| --- | --- |
| Ubuntu D4s v5, UK South, 1 × 730 hours | Native monthly base total USD 162.06 |
| Controlled quantity change, 1 → 2 | Native total repriced to USD 324.12 |
| Full calculator navigation/reload | SKU, OS, region, quantity 2, hours and USD 324.12 survived; native pricing requests were observed |
| Mixed source CSV | 3 independent modules: Ubuntu D4s v5 × 1; Windows D8s v5 × 2 with licence included; Premium SSD P30 LRS × 2, 1024 GiB each |
| Mixed monthly base total | USD 1674.676 internally; displayed/exported formatting rounds to cents |
| Original USD export | Three exact `[line_id] label` records, correct native descriptions, native total and blank billing-account context |
| Original GBP export | Three exact records; native converted total GBP 1263.9541114759045 before display rounding |

Native exports were observed as POSTs to `/pricing/calculator/exportestimate/`, status 200, `application/octet-stream`, with `ExportedEstimate.xlsx` attachments and completed Chromium downloads. Original files were copied byte-for-byte into `evidence/`; no workbook was edited, re-saved or generated locally. `evidence/index.json` records their hashes and line coverage.

The generated Python job and in-page adapter were tested together against the live site. Every supported configuration field and row count was checked after loading. The packaged final acceptance uses the same generated `import.js` that an operator runs: all three mixed CSV rows passed in GBP, the native workbook downloaded and matched all source lines, and a full reload followed by `verifyCurrent` passed with all three configurations and the pricing context intact.

## Size and rendering observations

Each successful row was a separate Ubuntu D4s v5, 730-hour, UK South module with a distinct source line ID. Every corresponding native workbook was inspected for exact line coverage. The figures below are **one observed run per configuration**, measured from preflight through native pricing/field verification; they exclude the subsequent download wait. They are not median/p95 estimates and do not establish a service-level guarantee.

| Rows | Module forms | Import/validation time | Native Excel result |
| ---: | --- | ---: | --- |
| 1 | Expanded research baseline | 3.94 s | 1/1 source lines matched |
| 10 | Expanded research baseline | 6.74 s | 10/10 matched |
| 50 | Expanded research baseline | 32.96 s | 50/50 matched |
| 100 | Expanded research baseline | 80.69 s | 100/100 matched |
| 100 | Collapsed, delivered behavior | 25.34 s | 100/100 matched |
| 250 | Collapsed | No reliable final timing recorded | **FAIL:** native Export navigated to an HTTP 413 response: “The page was not displayed because the request entity is too large.” No 250-row workbook is claimed. |

The frontend renders expanded configuration forms expensively. Starting modules collapsed reduced the measured 100-row time substantially; expanding a module remains available for review. The 250-row failure was a native export **request-size** rejection, not proof of a universal 250-item Azure limit. Per-module state size and service mix can change the boundary. No retries or endpoint bypasses were attempted.

**Operating recommendation:** explicit groups of up to 50 rows, with one untouched workbook per group. The delivered 100-row ceiling is a conservative utility rule based on the successful tests and failed larger request. Use repeated `build --batch <existing-id>` selections for a CSV containing many groups. A separate observed limit of ten open estimate tabs is checked before creating batches; this is unrelated to resource count.

## Offline validation

Python standard-library tests cover CSV parsing/BOM, explicit licensing, invalid numbers, duplicates, unsupported services/plans, formula-like labels, source identity, deterministic jobs, batch-size safeguards, explicit batch selection, original workbook bytes and line coverage. Node's built-in tests cover region/SKU mapping, schema drift, meter availability, capacity and hand-edited job rejection. No external test packages are required.

No `manual-export-verified` or `automated-export-verified` status is inferred merely from a file hash. Browser reports use `website-validated` after field checks and `requested-not-download-verified` after an export click. Operator manifests require explicit review confirmation to record manual verification.
