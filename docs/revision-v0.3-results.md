# Version 0.3 — folder input and catalog coverage

**PARTIAL GO for the complete catalog; GO for the 149 tested native service samples.** Folder/multiple-file ingestion and the general native-field adapter are implemented. All 152 services listed by the observed calculator have an explicit sample CSV. Actual CSV import, native pricing and one combined official Excel export passed for **149 service types from 149 CSVs in the same estimate**. Three listed services produced no usable price through Microsoft's normal product picker and are blocked explicitly.

## Verified outcomes

| Check | Observed result |
| --- | --- |
| Calculator catalog, 22 October 2026 | 152 listed services, all with captured schemas and samples |
| Public schema/pricing datasets | 155 observed dependency endpoints returned HTTP 200 during capture |
| Large folder import | 149 files, 149 distinct service types, one estimate |
| Large import steps | 50 → 100 → 149 items, same ID `7fff79b3-2f74-47c8-b825-96321cbf4407`, one attempt per step |
| Large official Excel export | HTTP 200, completed download, exact 149/149 source names matched |
| Large untouched workbook | [Catalog-149-services-GBP.xlsx](../evidence/revision-v0.3/Catalog-149-services-GBP.xlsx), 68,527 bytes |
| SHA-256 | `9ff58af7907b46f2766cf13e96ccac490909923c97d387de48a15f254cba1ae5` |
| Encoded export request | 1,748,137 bytes |
| Large import plus export wait | About 119 seconds; one observed run |
| Mixed-format import | 13 CSVs, 15 items, 14 service types, one estimate |
| Mixed loading | 5 → 10 → 15 items, same estimate ID throughout |
| Mixed official export | HTTP 200, completed download, exact 15/15 source names matched |

The final mixed example combines native-field API Management, App Service, Azure SQL Database, Backup, Cosmos DB, DNS, Functions, Key Vault, Monitor, Private Link, Service Bus and Storage Accounts. A friendly-format file adds Ubuntu/Windows VMs and a Premium SSD disk. Both CSV contracts therefore feed the same native estimate. Original filenames and row identities appear in its custom names and report.

Final mixed workbook: [Mixed-services-native-base-15-GBP.xlsx](../evidence/revision-v0.3/Mixed-services-native-base-15-GBP.xlsx), 56,123 bytes, SHA-256 `a63c1a9c4ff66dd58793cb075ec45fa169e7462567da7362bc072c23ae0c2bfb`. The tested source folder is [examples/mixed-service-proposal](../examples/mixed-service-proposal). Microsoft generated every successful evidence workbook through its official exporter; none was created, edited or re-saved locally. Earlier research exports are retained separately.

The [250-row VM/disk proof](revision-v0.2-results.md) remains valid for its tested scope. Neither run certifies arbitrary service combinations, workload sizes or every configuration variant.

## Three remaining native gaps

- Azure Database for MariaDB (`mariadb`)
- Healthcare agent service (`healthcare-agent-service`)
- Azure SQL Edge (`azure-sql-edge`)

The normal native product picker created these modules, but they retained only initial zero-price placeholders, with no computed description/layout or service price outputs. `hasPricing: true` and a zero total are not sufficient evidence. The adapter therefore stops before importing these pinned services. Their samples remain available and their catalog status is `native-pricing-unavailable`; `samples --export-verified-only` explicitly selects the 149 verified alternatives. No replacement service or retirement status is inferred, and the importer never silently discards selected rows.

## What changed during verification

An early adapter loaded/priced 144 service types but its combined export returned HTTP 204. Five additional types showed native errors. Investigation against the normal product picker identified common state added by Microsoft's `addBaseSchema` helper beyond each server schema. Incorporating that exact observed base fixed those five cases and the larger official export. The final 149-service CSV import and combined workbook above validate the corrected implementation. Earlier failure reports are retained as research history, not current coverage restrictions.

The common base contains zero placeholders and an initial pricing flag. Fresh-price verification requires derived native outputs and computed totals. DevOps, Virtual Enclaves and free Advisor/Lighthouse have explicit checks for their observed output formats; other services use native price data. This avoids treating an unrendered placeholder as a free resource.

An initial unqueued native-loader experiment generated concurrent request bursts and HTTP 403 responses. The importer stopped on 403 without retry. Subsequent queued imports completed with no retries. Native loading now caps pricing GET concurrency at two and spaces request starts. Preflight reuses the public region list that the page already obtains during normal initialization. No request identifiers are changed to evade access denials.

## Reproduction

To generate the tested catalog subset and combine it into one estimate:

```bash
python3 -m calcbridge samples --export-verified-only --output-dir tested-service-csvs
python3 -m calcbridge build --input-dir tested-service-csvs \
  --currency GBP --pricing-context public --chunk-size 50 --output-dir runs/catalog
```

Run the generated `import.js` on the official calculator page, confirm once, review the estimate, and use **Export Excel in the CSV Import panel**. For a smaller mixed-format example, use the command in the README against `examples/mixed-service-proposal`.

`--input` can also be repeated. `--recursive` includes subfolders explicitly. File hashes, relative names and row numbers remain traceable, including repeated line IDs across different files. All files are parsed before run artifacts are created. Missing configuration columns, wrong types, nonfinite/negative numbers, unsafe nested JSON, ambiguous files and unsupported shapes stop locally. Native versions/types are rechecked live and every supplied field is compared deeply after pricing. The v0.2 single-estimate checkpoint, stable IDs, bounded retries and server-requested cooldown remain in use.

Existing Chromium 154, Python 3.12 and Node 24 as a research-only DevTools transport were used. No browser drivers, automation frameworks or browser binaries were installed. Deployment is pinned to `20261019-0214-20261019-2100-186570892`. Examples use public prices and Basic support. Account Save, negotiated pricing and arbitrary configuration variants remain unverified. Native defaults are explicit examples, not workload recommendations or licensing eligibility checks.

Run `python3 -m unittest discover -s tests` and `node --test tests/test_browser.cjs`. Tests cover both formats, folder provenance/order, recursion, source collisions, all 152 samples, native types/schema checks, real workbook reconciliation, placeholder rejection, queue concurrency, retries and checkpoint safety.
