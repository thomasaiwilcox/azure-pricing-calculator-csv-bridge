> Historical research brief. The current PowerShell 0.4 scope in `AGENTS.md`, `README.md` and `docs/revision-v0.4-results.md` supersedes its original language/platform preference, separate-estimate grouping and early coverage limits. Original research requirements remain as context.

# Azure Pricing Calculator CSV Bridge
## Codex research and incremental implementation pack

**Prepared:** 21 October 2026  
**Status:** Research-backed implementation instructions; no live authenticated integration has yet been proven.  
**Target:** macOS and Linux. Python 3.11+ standard library, plus JavaScript executed in an existing browser only if needed.  
**Hard constraint:** Do not install or depend on Playwright, Selenium, Puppeteer, browser-driver packages, a separate browser, Docker, or a desktop UI automation framework. Do not introduce any dependency without demonstrating that the standard library/browser cannot reasonably do the job and obtaining approval.

---

## 0. Mandatory objective and definition of done

Create a practical, repeatable way to turn a large structured CSV of proposed Azure resources into estimates **inside Microsoft's official Azure Pricing Calculator** (`https://azure.microsoft.com/en-us/pricing/calculator/`) and obtain **Microsoft's own native Excel export** as evidence for consulting proposals and project work.

This is **not** a request to write an independent Azure cost calculator, reconstruct Microsoft's Excel template, or pass off a third-party-generated spreadsheet as official evidence. A Retail Prices API calculation may be a useful independent cross-check but cannot replace the native calculator or native export.

Aim for the smallest credible integration that works safely. The desired end state, if the site permits it, is:

`input.csv -> validated canonical rows -> Microsoft-compatible saved-estimate payload -> authenticated website/API save/load -> official calculator recalculation and verification -> official Excel export -> audit manifest`.

Initially, it is acceptable for the operator to sign in through an ordinary browser and click **Export** manually. Progressing from manual Export to a one-click in-page snippet or a documented download endpoint is a **stretch goal**, not a reason to install Playwright. Do not claim the workflow is fully automated until it demonstrably is.

**Absolute acceptance gate:** the output Excel file must actually be downloaded/generated through the official calculator's Export functionality (or an independently verified exact endpoint powering that control), be left unmodified, and correspond to a correctly loaded and freshly validated official calculator estimate. A generated payload, stored total, shared link, or lookalike workbook alone is not a success.

## 1. Grounded baseline and research confidence

### 1.1 Microsoft-confirmed capabilities

Microsoft's Cost Management documentation explicitly describes:
- Adding configurable services, quantity and consumption inputs to an estimate.
- **Export** of the current estimate as an Excel file.
- **Save**, **Save as**, **Share** and clone operations; sign-in may be required for Save and Share.
- Different region, operating system, licensing, currency, savings/RI, and agreement price configurations.
- Per-unit data originating from Azure Retail Prices API, with the calculator applying configuration, consumption and price-plan logic.
- EA, MCA, and CSP-specific pricing contexts when authenticated and appropriately authorised. In particular, CSP's New Commerce route may be presented through the MCA experience; Partner Earned Credit is not modelled by the calculator.

**Official documentation:**  
https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/pricing-calculator  
https://azure.microsoft.com/en-us/pricing/calculator/  
https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices

Microsoft does **not** document a general-purpose CSV/JSON bulk-import API for the pricing calculator in those sources. The Retail Prices API is a pricing-data API, **not** a calculator-estimate authoring or Excel-export API.

### 1.2 Third-party research leads: *unconfirmed* live compatibility

An independent, MIT-licensed TypeScript repository with last observed code push in November 2025 reverse-engineers calculator-shaped state and references the following paths on `https://azure.microsoft.com`:

```text
POST /api/v2/calculator/estimates/save/
GET  /api/v2/calculator/estimates/{estimateId}/
GET  /api/v2/calculator/estimates/
POST /api/v2/calculator/shared-estimates/save/
POST /api/v2/pricing/converter/calculator/
GET  /api/v2/pricing/getLatestSchema/{serviceSlug}/
GET  /api/v2/calculator/config/
GET  /api/v2/pricing/calculator/regions/
GET  /api/v2/pricing/{serviceSlug}/calculator/
```

Its `SavedEstimate` type includes `id`, `name`, `estimateTimestamp`, `instances`, `priceLevelId`, `currency`, `total`, `upfrontTotal`, `support`, and additional fields. Each `instances[]` element is a service-specific state object with `serviceSlug`, `version`, and `region` plus nested configuration. It serialises modules as `instances: estimate.modules.map(m => m.currentModuleState)`.

Repository: https://github.com/shrirajh/azure-pricing-calculator  
Relevant files:  
https://github.com/shrirajh/azure-pricing-calculator/blob/main/src/api-client.ts  
https://github.com/shrirajh/azure-pricing-calculator/blob/main/src/types.ts  
https://github.com/shrirajh/azure-pricing-calculator/blob/main/src/estimate-store.ts

**CRITICAL:** This repository is *not* Microsoft's implementation. Its paths, fields, values, HTTP verbs, authentication assumptions and schema converter may be outdated, illustrative or broken. Do not assume they work. In particular, do not use its *own* localStorage/IndexedDB implementation as evidence of keys or stores belonging to Microsoft's production page. Do not assume README claims imply a tested native Microsoft export. Treat everything as hypotheses until tested against the live website.

### 1.3 Prior investigation limitations

A live authenticated save/reload/export was **not** executed during the initial research. No current full network request/response trace or verified production export endpoint has been obtained. The first engineering milestone is therefore a short **evidence-backed feasibility spike**, not a large implementation.

## 2. Non-negotiable engineering constraints

1. **Zero Playwright/Selenium/Puppeteer**; no browser binary/driver installs. Use the operator's existing browser, built-in DevTools, native `fetch`, and Python standard library. If needed later, a minimal, reviewed browser snippet or extension is allowed; neither should require local framework installation.
2. Do not invent Microsoft API contracts, rate calculations, configurations or persisted totals. Discover them empirically, record samples, and gate unsupported combinations.
3. Never access other users' estimates, guess identifiers, elevate privileges, bypass authentication, defeat rate limits or replay hidden secrets. Only operate on estimates the operator has permission to manage, with their explicitly authenticated browser session.
4. **Never copy cookies, tokens, session headers, or signed-in raw HAR files into the repo, logs, model prompts or saved fixtures.** A sanitized, schema-preserving HAR/JSON example is sufficient. Treat negotiated price, customer IDs and estimate labels as potentially confidential.
5. No writes to existing estimates by default. Each write test creates a clearly named new, disposable **scratch** estimate only after an explicit operator-initiated action; do not perform destructive delete operations.
6. User must be able to audit exact requested resources and see **failures**. Fail closed rather than substituting an approximate SKU, different meter, default licence, different offer or fabricated total.
7. Prefer stable data/HTTP integration to brittle DOM traversal. If a documented or validated native export route does not exist, let the operator use the Export button; this still fulfils the core evidence objective.
8. Do not add databases, infrastructure, multi-tenant SaaS, cloud hosting, authentication automation, generic pricing engines, or speculative architecture. This is a focused local utility.
9. Save/share links may reveal confidential estimates to link holders. Make **Share opt-in**; ordinary Save and Excel evidence take precedence.
10. Microsoft calculator output is an estimate, not a binding customer quotation; document this limitation honestly.

## 3. Research sequence: first prove the integration

### Phase R0 — Environment and source reconnaissance (read-only)

- Check available Python and browsers without installing anything.
- Review the sources in Section 1, inspecting `api-client.ts`, `types.ts`, and `estimate-store.ts` rather than blindly copying their code.
- Locate present-day Microsoft frontend scripts and relevant API request names if possible using normal read-only requests and existing browser's DevTools Sources/Network. Note locale, deployment/version, origin, and signed-in vs signed-out behaviour.
- Determine if Export appears client-side (e.g. Blob/download created entirely in JS) or server-side (an observed request returning XLSX/CSV). **Do not invent an export URL.**
- Produce `docs/feasibility.md`: observed facts, tested URLs/methods/status codes, authentication requirements, export mechanism, hypotheses and explicit unknowns.

### Phase R1 — Manual baseline, no automation dependencies

The operator creates a small throwaway estimate **in Microsoft's browser UI**, preferably:

- one Linux VM, non-default region, explicitly selected size, 730 h/month, quantity 1;
- a second VM with a different SKU, OS or pricing option;
- one managed disk, if the service supports the target configuration;
- a named estimate such as `CALC-BRIDGE-POC-YYYYMMDD`;
- a deliberate currency and licensing-program selection, recorded accurately.

Record displayed monthly and upfront total and export its official XLSX. If Save requires sign-in, use normal interactive sign-in; do not automate authentication.

To inspect browser traffic **without installing anything**:

1. Open built-in DevTools > Network; enable Preserve log; select Fetch/XHR (also inspect Document/Other/All for downloads).
2. Perform Save, reload/open Saved estimates, Share **only if safe/needed**, and Export one operation at a time.
3. Record the HTTP method, URL path, status, content type, response shape and relevant *non-secret* request-body schema for each action. Distinguish UI-owned local state, server-persisted estimate, and transient pricing requests.
4. Compare the payload for a one-field change (e.g. VM quantity 1 -> 2) and a different VM size, as well as cloning a module. This is far more valuable than copying one arbitrary JSON blob.
5. Never persist unredacted HAR. When sanitizing, remove Cookie, Authorization, Set-Cookie, CSRF/session IDs, customer identifiers, billing-account identifiers, tenant IDs, email, query secrets and negotiated prices. Preserve JSON **structure and field names**, replacing sensitive scalar values with `REDACTED`.
6. Record the service slug/schema version from the **live** payload; do not assume examples from 2025 still fit.

**Operator handoff if Codex cannot inspect the browser:** Ask once for: (a) two sanitized save-payload examples differing in exactly one setting, (b) sanitized saved-estimate response schema, (c) Export behaviour as network request or client-generated download, and (d) official sample XLSX. Do **not** ask for raw HAR or credentials. Complete offline work while this is pending.

### Phase R2 — One-estimate round-trip: GO/NO-GO

Prove **all** of the following on a scratch estimate:

1. Save a small estimate using the exact request/response structure observed from the browser, preferably by native `fetch` executed inside the authenticated `azure.microsoft.com` page. Capture any CSRF requirement from the legitimate page; use the site's normal security protections, not bypasses.
2. Read/reopen the saved estimate on the real calculator using the mechanism the site itself uses.
3. Verify every field (not just total) survives reload, including region, SKU, OS, quantity, hours, discounts, currency and agreement where applicable.
4. Export from Microsoft's site and confirm it matches what is visibly loaded in the calculator.
5. Repeat using one *new* module created from a captured valid sample, with one deliberately changed **documented-by-observation** field; verify the site recalculates. Stored `total`/`upfrontTotal` fields do **not** prove that recalculation occurred.

Record `docs/roundtrip-results.md` with screenshots or sanitized notes, expected/observed values, exported workbook name/hash, and verdict.

**GO:** Native or same-origin save/load with a generated payload works reliably AND official website correctly prices it AND exports it.  
**PARTIAL GO:** State can be imported by an in-page snippet or existing-session mechanism, not a directly callable CLI. Accept a browser-assisted workflow without driver installs.  
**NO GO:** Only arbitrary saved JSON or forged totals can be produced; the site cannot load/reprice it, or required access is absent. Stop native-import development and report the blocker. Do not fake success by creating an imitation Excel file.

## 4. Recommended architecture (only after passing R2)

Implement **Python 3.11+ standard library** for the local CLI (`csv`, `json`, `argparse`, `pathlib`, `hashlib`, `uuid`, `datetime`, `unittest`, `zipfile`, `xml.etree.ElementTree`). Use plain browser JavaScript in `web/import-snippet.js` if authenticated save/load must run in browser origin.

```text
azure-calculator-csv-bridge/
  README.md
  AGENTS.md
  docs/
    feasibility.md
    roundtrip-results.md
    schema-mapping.md
    threat-and-privacy.md
  calcbridge/
    __init__.py
    __main__.py
    csv_input.py
    normalization.py
    golden_templates.py
    estimate_builder.py
    validation.py
    manifest.py
    xlsx_inspection.py        # only if feasible using stdlib
  web/
    import-snippet.js         # no userscript manager required
  fixtures/
    example-input.csv
    templates/                # sanitized, verified golden samples
  tests/
    test_input.py
    test_builder.py
    test_schema.py
    test_manifest.py
  .gitignore                  # protects private data and run artifacts
```

Separate three representations:

**A. Canonical input:** explicit intended product, resource identity, region, SKU/tier, quantity, usage, OS/licensing, pricing option and any product-specific fields. Errors stay visible and mapped to their original CSV row number.

**B. Verified Microsoft configuration:** service-specific versioned `instances[]`/modules generated by cloning a tested golden instance and changing *only* empirically mapped fields. Store per-service `mapping` code and tests. Treat nested fields as opaque until observed. A default service module copied unchanged must not silently represent a differently requested SKU.

**C. Official evidence:** loaded estimate URL/id, visible settings and totals, Microsoft-generated original XLSX, SHA256 hashes, local audit manifest. B does not become evidence without C.

No abstract plugin framework. Implement one vertical slice at a time.

### 4.1 Suggested stable initial CSV

Use the attached `fixtures/example-input.csv` as the draft. Required core fields:

```csv
batch_id,line_id,service,label,region,sku,os,quantity,hours_per_month,pricing_option,term,storage_size_gib,notes
migration-wave-a,vm-001,virtual-machines,web-01,uksouth,Standard_D4s_v5,Linux,1,730,payg,,,
migration-wave-a,vm-002,virtual-machines,app-01,uksouth,Standard_D8s_v5,Windows,2,730,payg,,,
migration-wave-a,disk-001,managed-disks,app-data-disk,uksouth,P30,,2,,payg,,1024,
```

**This is a human-friendly *input contract*, not proof of Microsoft's service slugs, region IDs, supported SKU inventory or actual nested module format.** Codex must map, validate and reject unsupported combinations using observed site data. In particular, do not assume `uksouth` maps to Microsoft's module `region` value without verifying it. For disks, the P30 example is **illustrative**: verify the correct storage product, tier, capacity and billing meter inside the calculator before treating it as supported. Do not conflate data disks, OS disks, snapshots, transactions or redundancy.

Rules:
- Exactly one explicit `line_id` per source row; preserve original row and line ID to final evidence traceability.
- `batch_id` identifies intentionally separate estimate groups; **do not split a line into multiple estimates silently**.
- `service` whitelist begins with VMs, then managed disks after tests pass; other services are unknown/unsupported by default.
- Strict input checks: duplicate line IDs within a batch, nonpositive/fractional quantities where not supported, missing SKUs, empty region, impossible hour values, invalid `pricing_option`, ambiguous OS or license, non-UTF-8 content, and dangerous Excel formula-like labels must error with row diagnostics.
- Treat usage, RI terms, Windows licensing/Azure Hybrid Benefit, SQL licensing, capacity, zone and agreement as distinct dimensions; never fill economically important unknowns with assumed defaults.
- When a SKU is unavailable in the chosen region, **fail**, do not silently switch SKU/region or price model.
- Separate compute cost from managed-disk, networking, backup and support lines to prevent omissions or double-counting.

### 4.2 Goldens and change mapping

For each supported service/pricing combination, capture a **real** calculator-created golden module; include sanitized sample and a known-good official workbook. Derive a mapping such as:

```text
requested column -> exact observed state JSON path -> converter/normalizer if needed
 -> validation rule -> before/after fixture demonstrating UI effect
```

The initial production builder must **not** perform broad recursive text replacement, mutate unknown fields or hard-code a universally valid service state. Track schema fingerprint/observed site build and reject unknown schema changes. Generate unique per-instance identifiers only where evidence shows they're expected; preserve references/order and invariants. Do not rely on stale stored price totals: force/verify genuine calculator re-pricing.

### 4.3 Authenticated transport: simplest safe default

**Prefer same-origin browser-assisted import over exporting login material.** A local CLI writes a JSON payload. A short snippet executed from DevTools **on the official calculator origin**:

- prompts the operator to choose the JSON file via a normal `<input type="file">`/FileReader;
- validates top-level keys, estimated name and counts; presents a dry-run summary and asks for confirmation;
- invokes *only the exact captured and tested save request* using native `fetch` with `credentials: 'same-origin'`/`'include'` as appropriate;
- honours observed CSRF tokens/headers provided by the site as part of normal operation, without extracting credentials;
- creates a **new scratch/new estimate**, reports result and provides a legitimate saved-estimate navigation path;
- never logs raw headers or secrets, and does not rewrite other saved estimates.

If the actual export is a verified callable endpoint, a later iteration may download it through the same-origin page context. If it's a client-side Excel generator, let the user click the site's actual **Export** button or trigger that button with a tiny in-page action after validating its correct enabled state. Do not create an XLSX locally and call it official.

Alternative, only if justified by live tests: a local CLI HTTP client could call the estimate API directly with operator-approved auth handling, but no persistent session token storage; **do not scrape passwords, copy browser cookie databases, or weaken browser security to make this work**. Browser-side snippet is strongly preferred for signed-in actions.

If save endpoint is blocked but site supports a verified importable client-side state format, an in-page adapter that invokes a real supported/observed frontend state transition is a second option; proof must include real reload and export, and it must be flagged as more fragile. Do not assume the third-party library's `azure_calculator_v3_estimates` localStorage key is a Microsoft website key.

### 4.4 Native Excel evidence and reconciliation

- Preserve the exact downloaded workbook bytes; **never modify, re-save or regenerate** the official evidence file.
- Detect file magic/ZIP structure (`xl/workbook.xml`, worksheets) and compute SHA256.
- Record the official estimate's name/id, account pricing context (non-sensitive label), region, currency, support/RI settings, count of supported items, visible monthly/upfront totals, export timestamp, CSV hash, generated JSON hash, XLSX hash, result and validation evidence.
- Reconcile representative output lines **back to original source lines** (or to explicitly aggregated groups). Identify if the workbook presents subtotals, discounts and totals differently; do not presume simple summation of rows matches UI.
- Automatic XLSX inspection via stdlib ZIP/XML is optional. If not robust, require a manual validation checklist and mark it `manual-verified`, never `automated-verified`.
- Save/share link is supporting evidence; sharing must be explicitly requested because recipients may access the estimate.
- Pricing may refresh when reopening an old estimate; record UTC export time and calculator context rather than claiming estimates are immutable price quotes.

## 5. Incremental milestones and acceptance tests

### Milestone M0: Research report and reproducible baseline
**Output:** `docs/feasibility.md`, scratch-estimate procedure, native XLSX baseline.  
**Pass:** clear observed Save/Load/Export mechanisms or a precise blocker; no guessed paths treated as confirmed.

### M1: Single-item programmatic round-trip
**Output:** minimal payload transformed from one verified golden instance; import snippet or justified direct API call; one exported workbook.  
**Pass:** Microsoft website reopens it, presents the intended VM size/region/quantity/pricing, computes the cost, and produces its own XLSX. A successful HTTP 200 alone fails this gate.

### M2: A second SKU and one controlled mutation
**Output:** two VMs (e.g. Linux + Windows) with a deliberate quantity change.  
**Pass:** expected field differences visible and priced; per-row traceability; no default SKU substitutions.

### M3: CSV ingestion and supported module mapping
**Output:** Python CLI `validate` and `build`, thorough offline `unittest` fixtures.  
**Pass:** deterministic (except explicit run IDs/timestamps) output from identical CSV+goldens; hard failure for unsupported combinations, duplicates, invalid units and unknown states; no external Python dependencies.

### M4: Managed disks and mixed configurations
**Output:** one disk pricing path supported from real saved modules; second golden fixture; mixed estimate.  
**Pass:** Microsoft output correctly covers compute and storage as separate billable components, with no double-counting. Delay SQL, Azure Files, bandwidth, reservations or Azure Hybrid Benefit until each receives the same validation.

### M5: Large-estimate performance and grouping
**Output:** timings/memory and price/result comparison for 1, 10, 50, 100 and 250 line inputs **only while site responds normally**.  
**Pass:** document median/p95 observed per relevant step, true UI bottleneck, errors, and a **measured** safe size; recommend grouping by wave/application/customer and use safe batching where needed. **Never invent a Microsoft size limit**.

### M6: Polished evidence workflow
**Output:** operator instructions, zero-browser-install happy path, original XLSX + audit manifest, selective file cleanup, reasonable diagnostics.  
**Pass:** a colleague can reproduce the process following README, with known limitations and clearly marked manual steps.

## 6. Target CLI behaviour

Prefer these simple commands (adapt naming if justified, retain the semantics):

```bash
python3 -m calcbridge validate --input fixtures/example-input.csv
python3 -m calcbridge build --input fixtures/example-input.csv \
  --goldens fixtures/templates --output-dir runs/poc-001
python3 -m calcbridge inspect-export --file runs/poc-001/MicrosoftExport.xlsx \
  --run-dir runs/poc-001
```

`build` should produce a sanitized operator summary and `estimate-payload.json` **only after a golden schema has been verified**, not a fabricated ready-to-use payload. `inspect-export` checks workbook structure/hash and any independently verified reconciliation; it must not mutate the workbook. Keep generated customer data under ignored `runs/` and keep `.gitignore` strict.

Normal run outputs may include:

```text
runs/poc-001/
  input.sha256
  estimate-payload.json
  mapping-report.json
  operator-summary.txt
  manifest.json
  MicrosoftExport.xlsx     # downloaded from the actual website by operator/in-page action
```

Manifest includes an explicit verification status: `not-tested`, `imported`, `website-validated`, `manual-export-verified`, `automated-export-verified`, or `failed`. No status may imply later gates were passed automatically.

## 7. Test matrix (must not overbuild)

Use built-in `unittest` and static/sanitized fixtures for deterministic offline tests, then targeted manual/live integration checks.

| Category | Essential tests |
|---|---|
| CSV validity | empty data, malformed header/quotes, BOM, unknown service, duplicate line IDs, missing SKU/region, invalid numeric fields |
| Semantic mapping | observed region mapping, SKU availability, OS, quantity, hours, purchase option, term, disk meter, licensing |
| State safety | golden remains immutable, changed fields only as intended, unique generated IDs when necessary, unknown schema aborts |
| Save/roundtrip | new scratch estimate only, same-origin authenticated request, duplicate-safe names, read-back and UI reconciliation |
| Price evidence | browser reprice, correct price level/discounts/currency, upfront vs monthly, native original XLSX, manifest hashes |
| Large runs | resource count vs actual modules, expected supported grouping, site slowdown, timeout/retry with safe limits, readable report |
| Privacy | redaction tests for HAR headers, cookies, sensitive IDs, no `runs/`/secrets in Git |

**Don't test fake implementation details.** The first tests should lock down real captured schemas and observable outcomes. Never code to pass mocked tests while the official-site round-trip is unproven.

## 8. Failures, access, and performance

- Distinguish 401/403 authentication/permissions errors, CSRF failures, 404 outdated endpoints, 400 schema rejection, 409 collisions, 429 throttling, 5xx website issues, JSON parsing issues, schema upgrade, price mismatch, and workbook absent/corrupt.
- Do not auto-retry POST writes blindly: the server may have saved an estimate despite a lost response. Idempotency requires a tested mechanism or operator review. Read-only requests may use bounded retries and exponential backoff honoring `Retry-After`.
- Detect HTML login pages returned where JSON was expected; do not attempt authentication bypass.
- Preserve order of user source rows unless intentional aggregation is opted in. Aggregate only if all billable dimensions are identical and the calculator actually supports equivalent quantity semantics.
- For huge inputs, prefer **separate official estimates per wave or service** over loading a single unstable 1,000-item webpage. Measure before deciding. Each batch should have its **own genuine Microsoft XLSX**, with a separate local manifest tying them together (do not merge/alter the official evidence files).
- Respect Microsoft's website usage policies and internal endpoint stability. Read-only research and operator-authorized scratch writes only; moderate request rates. Avoid concurrency against undocumented estimate save APIs until established safe.
- No local logging of private contracts, billing identifiers, or negotiated rates by default. Sanitize snapshots used as fixtures.

## 9. Go/No-Go decision table

| Observed reality | What to implement | What not to claim |
|---|---|---|
| Estimate save/load API accepts generated modules and site recalculates | Local CSV builder + browser-native save snippet + official export | Do not call private API 'supported' |
| Saved payload accepted only through actual in-page state mechanism | Build minimal in-page adapter if stable and auditable | Do not pretend simple direct HTTP integration exists |
| Save works, but Excel export has no usable HTTP endpoint | Keep native **Export** button click; automate only CSV -> page | Do not fabricate/export a third-party workbook |
| Authenticated save isn't available, but known share/import routes work | Test on throwaway public-rate estimate; verify reopen and native XLSX | Do not assume negotiated CSP/EA pricing is preserved |
| No reliable programmatic import and no stable state injection | Deliver full research findings and a reduced browser-assisted operator workflow; stop | Do not build expensive speculative application |

## 10. Required documentation and agent operating model

Deliver:
1. `docs/feasibility.md`: current observed browser/version, endpoints, request and response schemas, which paths are still speculative, and proof of Export's real mechanism.
2. `docs/roundtrip-results.md`: reproducible scratch estimate, true pass/fail, Microsoft workbook evidence (or known blocker).
3. `docs/schema-mapping.md`: every supported service's real golden input, field paths, allowed transformations, nested invariants, version fingerprint, and negative cases.
4. Source code only **after** R2 passes. Avoid introducing an app platform or UI.
5. Unit tests with `python3 -m unittest discover -s tests` and a small manual acceptance checklist.
6. README operator guide with explicitly numbered actions, prerequisites, no-install requirements, and limitations.
7. The untouched original Excel download(s), optional saved estimate URL (only if sharing is safe), and hash-based audit manifest.

**Work protocol for Codex:**
- Begin with R0/R1 and identify the smallest specific unknown preventing R2. Work in small reviewable commits/slices.
- Use evidence from the live calculator wherever accessible. Mark third-party-derived details `UNVERIFIED` until proven, including URL paths, request shapes and state fields.
- Ask the operator **only for the minimum safe browser capture necessary** if current environment cannot inspect the authenticated browser. Provide step-by-step DevTools instructions and a redaction checklist; never request cookies or login details.
- Produce a brief hypothesis, experiment, observed evidence and GO/NO-GO judgement at each phase. Do not prematurely implement downstream modules.
- If a test fails, diagnose it; do not patch around it by synthesizing prices or Excel exports.
- Keep the project lean: no unnecessary dependencies, migrations, containers, service abstractions or framework replacement proposals.
- Every feature is complete only when verified against the actual calculator and its official export, not just against your unit tests.

## 11. Explicit first assignment (start here)

> **Task 1: Feasibility spike, no Playwright.** Review Microsoft's calculator and documentation, inspect the independent TS repo as an untrusted research lead, identify whether current Save/Load and Export operations can be captured and reproduced without an automation framework, and generate `docs/feasibility.md`. If the authenticated browser is inaccessible, write a precise safe DevTools capture protocol and build only offline scaffolding until it is provided. Do not yet build a generic CSV-to-Azure pricing engine. The primary pass criterion is a new, scratch VM module saved/reopened and re-priced inside the official Microsoft calculator, followed by that site's native Excel Export. Then implement the smallest next vertical slice, one service at a time, using the go/no-go gates and acceptance tests above.

---

## 12. Reference URLs (verify freshness on use)

- Microsoft Pricing Calculator: https://azure.microsoft.com/en-us/pricing/calculator/
- Official calculator guide: https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/pricing-calculator
- Microsoft Retail Prices API overview: https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices
- Microsoft Cost Management automation overview (different API purpose): https://learn.microsoft.com/en-us/azure/cost-management-billing/automate/automation-overview
- Independent reverse-engineering repository, **not Microsoft code**: https://github.com/shrirajh/azure-pricing-calculator
- Independent API client: https://github.com/shrirajh/azure-pricing-calculator/blob/main/src/api-client.ts
- Independent state types: https://github.com/shrirajh/azure-pricing-calculator/blob/main/src/types.ts
- Independent state store: https://github.com/shrirajh/azure-pricing-calculator/blob/main/src/estimate-store.ts
