# Version 0.4 — PowerShell port

The local CLI is rewritten in PowerShell for Windows CSP/MSP workstations without Python. **GO for the tested PowerShell 7 port; Windows PowerShell 5.1 rollout verification remains outstanding.** The browser adapter and pinned calculator fixtures are byte-for-byte unchanged from version 0.3. This revision verifies the local port against that earlier live proof; it does not claim a fresh live browser run or authenticated CSP pricing validation.

## Implemented commands

| Command | PowerShell behavior |
| --- | --- |
| `Validate` | Friendly/native CSVs; one file, arrays of files or folder; optional recursive discovery |
| `Build` | One v3 estimate job, generated browser script, operator summary and SHA-256 manifest |
| `Catalog` | Text or `-AsJson` service/coverage listing |
| `Samples` | All 152 native templates, selected `-Service` arrays or 149 with `-ExportVerifiedOnly` |
| `InspectExport` / `Inspect-Export` | Read-only original XLSX reconciliation, SHA-256, manifest and explicit manual-review flag |
| `Help`, `Version` | Built-in usage and release version |

The local implementation uses built-in PowerShell/.NET. A bundled C# 5 parsing helper is compiled by `Add-Type`, preserving strict UTF-8, quoted multiline CSV, empty/single arrays, case-distinct JSON keys, booleans and invariant numbers. There are no Python, Azure/Excel modules, Pester, NuGet or external runtime calls. An installed Excel application is unnecessary for inspection.

The browser step remains JavaScript in the operator's existing calculator tab. Folder inputs, source groups, chunks larger than 100 total items, retry/backoff, safe commit reconciliation and resume retain the existing behavior. The PowerShell build writes the same v3 job values; it does not author separate calculators per batch. Original workbooks are read, never created or edited locally.

## Actual verification

- **38/38 standalone PowerShell tests passed** on PowerShell **7.6.8**, Linux. The whole suite ran with `PATH` restricted to the temporary PowerShell runtime directory, where Python and Node were unavailable. The runtime was downloaded only for development, verified against Microsoft's published SHA-256, and is not shipped in the Windows ZIP.
- All **152 service CSVs** validate and regenerate. Every regenerated configuration matches its pinned native template, including value types.
- The PowerShell **15-item / 13-file mixed job** and **149-item / 149-file catalog job** match their proven Python-generated v3 jobs for every JSON value: source hashes, configurations, provenance, estimate identity, names, loading settings and templates.
- The unchanged browser adapter accepts both PowerShell jobs. Its sorted configuration hashes match the proven jobs, preserving resume identity for equivalent unchanged configurations. Both generated scripts parse and embed their exact jobs.
- **17/17 existing browser adapter tests passed** using Node as a development-only check. Node is not shipped or required by operators.
- PowerShell reconciles **149/149** and **15/15** names in the original official Excel workbooks and supports the historical v1 workbook. All earlier version 0.3 evidence hashes remain unchanged. Inspection explicitly does not establish Microsoft origin or pricing accuracy by itself.
- Error cases cover missing licensing/redundancy, formula-like labels, duplicate identities, ambiguous/repeated files, invalid UTF-8, malformed quotes, native type/column errors, nonfinite/fractional/out-of-range values, changed job bytes, wrong estimate, missing/duplicate workbook lines, invalid XLSX, output overwrite and invalid chunk/retry limits. Additional checks cover Unicode paths/quoted labels, physical multiline row positions, UTF-8 BOM, source-group selection and decimal parsing under `de-DE`.

Evidence: [PowerShell test report](../evidence/revision-v0.4/powershell-tests-linux.json), [browser/job parity](../evidence/revision-v0.4/browser-job-parity.json), [evidence index](../evidence/revision-v0.4/index.json). The PowerShell-generated jobs and workbook inspection reports are in the same folder. They reference earlier genuine Microsoft exports; they are not new export-origin evidence.

| Original Microsoft workbook | PowerShell matched lines | SHA-256 |
| --- | --- | --- |
| `revision-v0.3/Catalog-149-services-GBP.xlsx` | 149 | `9ff58af7907b46f2766cf13e96ccac490909923c97d387de48a15f254cba1ae5` |
| `revision-v0.3/Mixed-services-native-base-15-GBP.xlsx` | 15 | `a63c1a9c4ff66dd58793cb075ec45fa169e7462567da7362bc072c23ae0c2bfb` |

## Windows PowerShell 5.1 compatibility and remaining limits

Sources require version 5.1, use ASCII script source and explicit UTF-8 file I/O, and avoid PowerShell 7-only operators, JSON-converter behavior, process launching, module dependencies and modern-only .NET APIs. The parsing helper also compiles with the compiler explicitly restricted to **C# 5**. That compilation ran under PowerShell 7/.NET on Linux; it is not execution against Windows .NET Framework. The helper's collection, encoding and parsing APIs and the module's compression/XML APIs were reviewed for .NET Framework 4.5+ compatibility.

**No Windows runtime was available.** Do not call this Windows 5.1 runtime-tested or validated across enterprise policy configurations. On the intended workstation, run:

```powershell
.\CalcBridge.ps1 Version
.\tests\Test-CalcBridge.ps1 -ReportPath .\powershell-test-results.json
```

The report records OS, PowerShell version and whether Windows PowerShell 5.1 actually ran. Then perform a small scratch import/export using the first-run instructions before customer rollout. Existing organization script/DevTools policies apply; local `Add-Type` must be permitted. No execution-policy changes are made, and supplied source scripts are unsigned.

The observed catalog still has three explicitly blocked services: MariaDB, Healthcare agent service and Azure SQL Edge. The 149 proofs cover particular sample configurations, not arbitrary variants. The adapter remains pinned to deployment `20261019-0214-20261019-2100-186570892`; Microsoft frontend changes stop the import until revalidation. Account Save/reopen and negotiated CSP/EA/MCA pricing remain untested. A PowerShell workstation port does not establish those capabilities.

## Packaging

`Azure_Calculator_CSV_Bridge_PowerShell_v0.4.zip` contains the PowerShell CLI/helper, unchanged browser script, catalog fixtures, 152 CSV samples, mixed example, standalone PowerShell tests, docs and original public evidence. It excludes the legacy Python CLI/tests, Node developer tests, generated/customer `runs/`, caches, credentials, private browser profiles and the portable development runtime. Earlier release ZIPs remain unchanged. The extracted package is checked independently with the standalone tests and CLI before delivery.
