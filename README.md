> **Browser extension pilot (0.5):** [Chrome/Edge installation and usage](extension/README.md). Includes editable CSV proposals and session recovery. Shared-engine live tests passed; installed Chrome/Edge acceptance remains outstanding. The PowerShell CLI below remains available.

# Azure Pricing Calculator CSV Bridge — PowerShell 0.4

Build one estimate on [Microsoft's Azure Pricing Calculator webpage](https://azure.microsoft.com/en-us/pricing/calculator/) from a CSV, several CSVs, or a folder of CSVs. Items load in configurable chunks into that same estimate, with bounded retries, backoff and resume checkpoints. Export one original Microsoft Excel workbook for the combined estimate.

The local tool is now PowerShell based. **Python is not required.** It uses built-in PowerShell/.NET features and a bundled local parsing helper; no Azure modules, Excel installation, Node, browser drivers or downloaded PowerShell modules are needed. The in-page importer remains JavaScript because it runs inside your existing Edge/Chrome browser.

Written for **Windows PowerShell 5.1** and **PowerShell 7**. Actual execution here was PowerShell 7.6.8 on Linux: all 38 standalone checks passed with Python and Node unavailable on `PATH`. Windows PowerShell 5.1 syntax/.NET compatibility was reviewed, but **execution on a real Windows 5.1 workstation remains unverified**. The included test script lets your Windows team validate that environment before rollout. See [port verification](docs/revision-v0.4-results.md).

## First run on Windows

Extract the ZIP, open PowerShell and change into the extracted folder. Run the mixed example:

```powershell
.\CalcBridge.ps1 Build -InputDirectory .\examples\mixed-service-proposal `
  -LinuxType ubuntu -WindowsLicense included -DiskRedundancy lrs `
  -Currency GBP -PricingContext public -OutputDirectory .\runs\first
```

This validates 15 items from 13 CSV files and writes a local run folder. Nothing is sent to Microsoft during a build. Read `runs\first\operator-summary.txt`; each build requires a new output directory to protect earlier work.

1. Open the official calculator in your existing Edge/Chrome browser and wait for it to load.
2. Open `runs\first\import.js` in a text editor, review it and copy the entire script into that calculator tab's **DevTools → Console**.
3. Confirm once to create the destination estimate. All selected rows are checked before the first resource is added; the panel then shows loading/pricing progress. Every file and source group goes into that same estimate.
4. Review settings, currency and totals. Select **Export Excel in the CSV Import panel** to request one combined workbook from Microsoft. This uses the verified compact request; the ordinary page Export control sends a larger request that can fail for large estimates.
5. Keep the original download untouched in your run folder. Select **Download import report** for source-row checks, attempt counts, estimate/module IDs and the returned workbook hash.
6. Reconcile the workbook against the job:

```powershell
.\CalcBridge.ps1 InspectExport -File .\runs\first\ACTUAL-DOWNLOADED-NAME.xlsx `
  -RunDirectory .\runs\first
```

The inspector checks XLSX structure, estimate name and every source-line name, records SHA-256 and updates the run manifest. It never changes the workbook. Add `-ConfirmReviewed` only after personally checking Microsoft origin, configuration, pricing context, currency and totals. File structure and hashes alone cannot establish origin or accurate prices; without this explicit review the manifest stays `not-tested` even when line coverage matches.

Your organization's script policy and DevTools policy apply. This release does not change execution policy. The bundled .NET helper is compiled locally using built-in `Add-Type`, so PowerShell must permit that operation; managed workstations may require IT approval/signing. The scripts are supplied as source and are not Authenticode signed.

## Your own CSV folder

Generate templates for the services you need, edit their settings, then build:

```powershell
.\CalcBridge.ps1 Samples -Service @('storage', 'app-service', 'azure-sql-database') `
  -OutputDirectory .\proposal-csvs

.\CalcBridge.ps1 Validate -InputDirectory .\proposal-csvs

.\CalcBridge.ps1 Build -InputDirectory .\proposal-csvs `
  -Currency GBP -PricingContext public -OutputDirectory .\runs\proposal
```

Only top-level `.csv` files are included by default, case-insensitively. Add `-Recurse` to include subfolders. Files are sorted by relative filename, preserving row order within each file. All selected files are validated before a run is written. Symbolic links/junctions, ambiguous names and selecting the same file twice are rejected.

Alternatively, supply an array of files in your intended order **from a PowerShell prompt**:

```powershell
.\CalcBridge.ps1 Build -InputPath @('.\storage.csv', '.\app-service.csv', '.\sql.csv') `
  -Currency GBP -PricingContext public -OutputDirectory .\runs\selected-files
```

Use the array parameter instead of repeating `-InputPath`. Add the explicit licensing/redundancy options from the first example if you include friendly VM/disk rows. `-BatchId @('wave-a', 'wave-b')` selects source groups across files; they still share one estimate and workbook. The entire input is validated and hashed before selection.

Per-file SHA-256, relative names and physical CSV row positions remain in the job, manifest and report. Multi-file calculator names include the filename, group and line ID, so different files can reuse line IDs. Changing a source file changes the job identity: resume the original unchanged job after interruptions, and build a new run for changed inputs.

## Catalog and CSV formats

The pinned catalog contains **152 service types with one sample CSV per type**, under [samples/all-services](samples/all-services). **149 default native samples passed live import/pricing and one combined official Excel export** in version 0.3. MariaDB, Healthcare agent service and Azure SQL Edge returned no usable native price and remain explicitly blocked. The PowerShell port preserves that coverage; it does not expand the tested configuration variants. See [catalog evidence](docs/revision-v0.3-results.md).

```powershell
.\CalcBridge.ps1 Catalog
.\CalcBridge.ps1 Catalog -AsJson
.\CalcBridge.ps1 Samples -ExportVerifiedOnly -OutputDirectory .\tested-service-csvs
```

Omit both `-Service` and `-ExportVerifiedOnly` to generate all 152 templates. Copy just the services you need into your proposal folder. Importing the complete library creates a catalog demonstration, not a realistic customer proposal.

Native-field CSVs contain `batch_id,line_id,service,label,notes` plus every `config.<native-field>` column for that service. Retain all configuration columns. Use exact native regions, SKUs and option values; missing fields and wrong types fail locally. Strings are literal, numbers are finite and nonnegative, booleans are `true`/`false`, and arrays/objects use JSON inside quoted CSV cells. Notes remain local. Templates include observed default regions, units/factors, zero usage and disabled options: review every field, including consumption, licensing and storage. Editable columns exclude computed prices, totals and identifiers. Microsoft performs the pricing.

The existing friendly VM/disk format in [fixtures/example-input.csv](fixtures/example-input.csv) remains supported. Retain its 13 core headers:

| Columns | Meaning |
| --- | --- |
| `batch_id`, `line_id`, `label` | Source group, row identity, human-readable name |
| `service`, `region`, `sku`, `os` | Supported service, exact region/SKU and VM OS; disk OS is blank |
| `quantity` | Positive whole number of identical resources |
| `hours_per_month` | Hours for each VM, 0–744; blank for monthly disks |
| `pricing_option`, `term` | `payg`, empty term |
| `storage_size_gib` | Each disk's exact live-tier capacity; blank for VMs |
| `notes` | Local job notes, not a calculator field |

Optional `linux_type`, `license` and `redundancy` columns override the corresponding command options per row. Supported values are `ubuntu`, `included` and `lrs`. Generic Linux, Windows and disks require explicit choices; `Ubuntu` in `os` already specifies the supported distribution.

Save CSVs as **UTF-8 with commas**; Excel's “CSV UTF-8 (Comma delimited)” format is suitable. UTF-8 BOM, quoted cells and CRLF are accepted. Use a decimal point (`730.5`), regardless of workstation locale. Commas or newlines inside a cell require normal CSV quoting. Single-file labels become `[batch_id/line_id] label`; multi-file labels become `[filename:batch_id/line_id] label`. Keep source filenames suitable for the estimate's audience.

## Loading, backoff and resume

- `-ChunkSize 50` sets rows per loading step, from 1–100. **There is no 100-item total cap:** larger inputs phase into the same estimate. A 250-item VM/disk estimate and a separate 149-service estimate have genuine combined-export proofs. Final capacity still depends on browser memory and Microsoft's pricing/export behavior.
- `-MaxAttempts 3` bounds attempts, from 1–5. Transient catalog/pricing/export failures use exponential backoff, jitter and `Retry-After`. A server-requested wait over a minute stops with a resume time instead of retrying early.
- Invalid input, schema drift, authentication failures and HTTP 400/401/403/404/413 stop. Account Save/Share writes are never automatically retried.
- Checkpoints preserve the tool-created estimate ID and planned module IDs. Before retrying a load, the importer reconciles already committed items to avoid duplicates. Unexpected items, changed IDs, manual edits or another active estimate stop automatic changes.
- **Pause after this step** finishes the current chunk. **Resume** continues the same estimate with the original job. After reload, paste `web/import-snippet.js`, switch to the imported estimate, choose the original `import-job.json` and confirm Resume. Re-running the original generated script also resumes.
- Exhausted retries leave the partial estimate available for inspection. Existing unrelated estimates are retained.

`-RunId` sets a reproducible job identifier; the default is a UTC timestamp. `-EstimateName 'Migration proposal'` names the one destination; the default is `CSV-<run-id>`. Do not change the job identity to recover an interrupted run.

## Pricing scope and browser persistence

Current evidence uses **public PAYG prices, Basic support and no markup**. Windows is now the target workstation platform for CSP/MSP operators; **negotiated CSP/EA/MCA account pricing remains untested**. No sign-in is automated. Calculator output is an estimate, not a binding quotation or a deployment-capacity guarantee.

The friendly mapping supports compute-only Standard-tier Ubuntu VMs, Windows OS-only VMs with licence included, and fixed Premium SSD P-tier LRS monthly disks. Attached disks, snapshots and outbound transfer are zero on VM rows; add supported disk rows separately. Reservations, savings plans, Spot, Hybrid Benefit, SQL and other disk/distribution paths are not mapped by that friendly format. Native rows preserve their explicit service settings and remain subject to live checks and per-service coverage.

The browser adapter uses observed private frontend actions and is pinned to the tested deployment/schema signatures. Site changes require revalidation; do not remove its checks to force an import. Native pricing GETs have a concurrency limit of two and spaced starts. The compact exporter removes only an experimentally verified unused cache for compute-only VMs, preserving resources, configuration and actual prices. It receives Microsoft's workbook unchanged; no local spreadsheet is generated or rewritten.

For an account copy, sign in normally and use Microsoft's **Save** yourself. Account Save/reopen remains untested. Local persistence depends on the browser profile, Microsoft consent/settings and retained browser storage. Checkpoints do not back up the native estimate. Without matching native state and the tool's checkpoint, automatic resume stops. After reopening a fully loaded estimate, use **Check reopened estimate** with the original job to recheck fields and enable compact export.

## Files and validation

`CalcBridge.ps1` is the entry point; `powershell/CalcBridge.psm1` implements the commands. `powershell/Formats.cs` is a local C# 5/.NET-compatible CSV/JSON helper compiled by PowerShell. This avoids older PowerShell JSON converters changing empty arrays, booleans, case-sensitive native keys or number handling. It makes no network calls. Workbook inspection uses built-in .NET ZIP/XML readers and needs no Excel or ImportExcel module.

Run the standalone checks on your Windows workstation:

```powershell
.\CalcBridge.ps1 Version
.\tests\Test-CalcBridge.ps1 -ReportPath .\powershell-test-results.json
```

No Pester installation is needed. Tests use temporary local folders and included public evidence, never the live browser or customer estimates. Tests cover 152 samples, 149-item job equivalence, both CSV formats, file provenance, strict types, locale independence, untouched workbook inspection and failures. The Windows ZIP excludes the legacy Python implementation. The development source retains it for reference; earlier release ZIPs are unchanged.

New builds remain `calcbridge-job/v3`; the unchanged browser accepts v2 jobs/checkpoints and the PowerShell inspector supports historical v1/v2 runs. Equivalent unchanged v3 jobs retain their browser configuration identity across the port. Use the original job for resume; job-file byte hashes in new run manifests are specific to each build.

Keep customer CSVs, generated scripts, reports and original downloads under ignored `runs/`. Checkpoints in the tool's own `calcbridge:v2:` namespace contain hashes, estimate/module IDs and progress, not credentials or full configurations. No cookies, tokens or raw HAR files are collected. Public Microsoft workbooks under `evidence/` are historical proof, preserved byte for byte. See [schema mapping](docs/schema-mapping.md), [data handling](docs/threat-and-privacy.md) and [PowerShell verification](docs/revision-v0.4-results.md).
