# Browser extension pilot — 0.5

This pilot provides a Chrome/Edge side panel for importing CSV proposals into one official Azure calculator estimate. It includes file/folder selection, editable resource settings, row validation, service samples, session drafts, recovery jobs and optional compact export.

**Acceptance status:** shared-engine live import and original Microsoft export passed for 15 mixed items and 250 items on 26 October 2026. The panel DOM was exercised in Chromium with mocked extension APIs. Installed-extension testing is outstanding: this environment's administrator policy prevents unpacked extension loading; Edge is unavailable. This ZIP is for pilot validation, not a certified production rollout.

## Install the pilot

1. Extract `Azure_CSV_Bridge_Extension_v0.5.zip` to a permanent folder. The extracted folder contains `manifest.json` at its root.
2. Open `chrome://extensions` or `edge://extensions`, enable Developer mode where your organization permits it, and select **Load unpacked**. Select that extracted folder.
3. Open https://azure.microsoft.com/en-us/pricing/calculator/, wait for it to load, and click the extension toolbar icon. Select **Connect this tab** in the side panel.
4. Select CSV files or a folder. Enable **Include subfolders** before selecting a folder when needed. Selections append to the proposal; duplicate filenames are rejected. Use **Clear proposal data** to replace a selection.
5. Review rows and edit settings. Errors identify their source file and row. Licensing choices must be explicit. Sample settings are Microsoft's observed defaults, not workload recommendations.
6. Set the name and currency, validate, then choose **Review and import**. Confirm the resource count and public-price context. Items load into one new estimate, including proposals over 100 items.
7. Review settings and totals on the website and use its Export button. **Export large estimate** is an optional compact request that still returns Microsoft's original workbook.

A new tab or reload requires reconnecting via the extension icon. Operations remain bound to the original tab/document; they never follow a newly active tab. The page runs imports, so closing the panel does not stop a running operation. Navigation interrupts the page operation; reconnect and resume with the exact job and matching calculator state.

## Editing, privacy and recovery

Select a resource to edit its fields. Service and source identifiers are read-only; change CSVs externally to add/remove resources. Nested structures use JSON. **Revert** restores individual original values. **Download this CSV** saves the effective content. The audit records original row references and field changes; job hashes describe the effective CSVs.

After import starts, the draft is locked. **Copy to new draft** creates a new run identity for changes. A recovery JSON is immutable in the panel; load the source CSVs to edit it.

Download the recovery job before closing your browser. Proposal data lives in extension session storage, not synchronized or persistent extension storage. Restarting the browser requires reselecting the saved recovery job. Minimal existing calculator checkpoints persist separately; they are not a backup of the native estimate. Resume requires both matching native state and checkpoint ownership.

**Clear proposal data** clears the extension draft and disconnects monitoring; it does not delete Microsoft estimates or the page's existing runtime/checkpoints. Reports may contain resource labels/configuration and edit history. No telemetry, external backend, remote executable code, cookie access or sign-in automation is used. Only public pricing is verified; negotiated CSP/EA/MCA pricing remains untested.

The session storage budget is checked before saving. Oversized proposals produce an explicit error instead of using persistent storage. There is no unlimited-scale guarantee.

## Developer build and checks

From the repository root:

```sh
python3 scripts/package-extension.py
node --test tests/test_browser.cjs tests/test_extension.mjs tests/test_extension_worker.mjs
```

Packaging uses Python's standard library as a developer tool; operators require only the browser. It copies the shared importer, pinned fixtures and samples into `dist/extension` and creates a deterministic ZIP plus SHA-256. Do not load the source `extension` folder directly: the packaged folder includes its required assets.

Run `./tests/Test-CalcBridge.ps1` in PowerShell for CLI regressions. No changes to the v3 job contract or existing PowerShell inputs are required.

## Windows pilot acceptance checklist

On both installed Chrome and Edge, validate the mixed example and a >100-item proposal. Confirm one estimate and exact source fields, edit/revert/download CSV round trips, original Microsoft Excel output, pause/resume without duplicates, panel closure/reopening, worker suspension, page reload, tab switching, cross-tab isolation, browser restart with recovery JSON, clear-data behavior and storage-capacity errors. Test recovery after interrupted loading and verify bounded retries on transient failures. Record browser versions and observed results.

The adapter stops if Microsoft's pinned deployment or schemas change. Revalidate before changing pins; do not disable the checks. Three services remain explicitly blocked: MariaDB, Healthcare agent service and Azure SQL Edge. The remaining catalog proofs cover particular samples, not every service configuration.
