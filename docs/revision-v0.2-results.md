# Version 0.2 acceptance — 22 October 2026

**PARTIAL GO for the browser-assisted workflow: all selected CSV rows load into one live Microsoft calculator estimate, with one combined Microsoft-generated Excel workbook.** Public PAYG VMs and fixed Premium SSD LRS disks passed. Account Save/reopen and negotiated prices remain untested. This supersedes the version 0.1 separate-estimate recommendation and 100-row total ceiling.

## Same-estimate proof

The delivered CLI and browser adapter loaded `fixtures/single-estimate-250.csv`: 250 distinct modules across five source groups, repeated line IDs between groups, Ubuntu and Windows VMs, P30 disks, UK South and East US. Source order was preserved. Five sequential loading steps completed at 50, 100, 150, 200 and 250 modules. All five report the same estimate ID, `b9b88104-f624-4fd6-9ddc-781562461641`.

The native calculator supplied pricing and descriptions; the adapter checked source configurations, public pricing context, currency, module identity and fresh native prices after every step. The official export endpoint returned HTTP 200 and a completed Chromium download. Read-only inspection matched **250/250 source names exactly**, without duplicate or missing records. No workbook was generated, edited or re-saved locally.

| Evidence | Result |
| --- | --- |
| Estimate name / currency | `CSV-single-estimate-250` / GBP |
| Untouched workbook | [Single-estimate-250-GBP.xlsx](../evidence/revision-v0.2/Single-estimate-250-GBP.xlsx) |
| Download size | 59,203 bytes |
| SHA-256 | `bad6e33a59189712526b7ca6cc9f3f776041527665096e6fcc6e451f21bcaf6a` |
| Loading | Five 50-row steps; one attempt each |
| Measured import plus export/download wait | About 106 seconds; one observed run |
| Original native export JSON | 5,682,573 bytes |
| Compact JSON / encoded request | 1,382,283 / 2,067,523 bytes |

The job, browser report and hash index are under [evidence/revision-v0.2](../evidence/revision-v0.2/). A smaller mixed three-row job also passed with one row per step in one estimate.

## Why the larger export works

Version 0.1 could render 250 items but the ordinary Export request failed with HTTP 413. Investigation found that compute-only VM export data includes a large unused Premium SSD v2 price cache. The production exporter removes only `prices.premiumssdV2Offer` when the VM's disks and snapshots are disabled and the verified configuration matches. It retains every instance, configuration field, actual price, description and total.

The panel triggers the native Export control to obtain its current form payload, clones and checks it, then posts the compact body to the exact endpoint powering that control:

```text
POST https://azure.microsoft.com/pricing/calculator/exportestimate/
Content-Type: application/x-www-form-urlencoded
Fields: estimate, currency
```

Microsoft generates the workbook. The response bytes are downloaded unchanged. A genuine small native baseline and compact export have **byte-identical worksheet XML**, including every cell. Removing the entire `prices` object was separately tested and returned HTTP 204 with no file; that approach is rejected and is not implemented. The original in-page prices and state are never compacted or overwritten.

Use **Export Excel in the CSV Import panel** for this path. Microsoft's ordinary Export button continues to send the larger payload. Chunking does not eliminate final browser memory or server request limits; 250 is a verified example, not a promise of unlimited scale. A final HTTP 413 stops without retries or further data removal.

## Retry and recovery proof

Failures below were deliberately injected in an isolated anonymous research browser. They demonstrate recovery behavior; they were not real Microsoft outages. Real native pricing calls and final official exports completed after the injected failures.

| Experiment | Observed result |
| --- | --- |
| Native pricing GET returns 503 with `Retry-After: 1` | Waited at least one second, then recovered |
| Lost acknowledgement after the first native commit | Detected the existing prefix; no repeat append or extra first-step native load |
| Transport failure before the second step commits | Retried the absolute prefix with the exact same module IDs |
| Official export returns injected 503 | Backoff/retry, then real HTTP 200 and original XLSX |
| Pause after the first row | One-row partial estimate retained; premature export rejected |
| Full page navigation/reload, then original job | Resumed rows 2 and 3 in the same estimate; first module ID unchanged; no extra estimate created |
| Public preflight catalog returns 503 after reload | Honored `Retry-After: 1`, then resumed successfully |

The three-row retry run ended with exactly three unique modules. Loading-step attempt counts were 2, 2 and 1. The reload run retained estimate ID `6db509ae-817e-4484-bdb4-fa72a73cdd48` and first module ID `2e521c0c-9841-4195-948c-d70f8a78b7db`; the open-estimate count stayed at seven. Both workbooks matched all three source rows.

The retry-run artifact explicitly records that its public-preflight injection did not trigger; that case was subsequently exercised successfully by the separate reload test. Reports keep these experiments distinct. Offline tests also cover exhausted retry budgets, nonretryable HTTP responses, HTTP-date and long `Retry-After`, checkpoint ownership, schema drift, exact SKU/meter mapping and compact-payload immutability.

## Reproduction and limits

```bash
python3 -m calcbridge build --input fixtures/single-estimate-250.csv \
  --windows-license included --disk-redundancy lrs --currency GBP \
  --pricing-context public --chunk-size 50 --output-dir runs/single250
```

Run the generated `import.js` on the official calculator page, confirm creation once, review the resulting single estimate and export through the CSV Import panel. Keep the original workbook and use `inspect-export` against the run directory. After a reload, select that same imported estimate and re-run the same job to resume; a new run ID creates a different job identity.

Test environment: existing Chromium 154.0.8037.57, Python 3.12.14 and Node 24.19.0 as a research-only DevTools transport. No automation framework, browser driver or new browser was installed. Deployment pinned to `20261019-0214-20261019-2100-186570892`; VM schema `v1.3.1`, disk schema `v1.0.1`. No sign-in, credential capture, account Save/Share/Delete or negotiated pricing was involved.

The adapter uses private frontend actions, so deployment/schema changes require revalidation. It stops rather than substitute products or force stale schemas. Supported scope remains public PAYG Ubuntu/Windows compute-only VMs and fixed Premium SSD P-tier LRS disks; normal account Save is a separate operator action. Pricing outputs remain estimates rather than binding quotes.
