# Verified mapping

Version 0.4 changes the local CLI to PowerShell without changing the v3 job contract or the browser mapping. The 15-item mixed job and 149-service job are semantically identical to their proven version 0.3 jobs, including source hashes and every typed configuration value. Original official workbooks reconcile through the PowerShell inspector. This is a port check against earlier live evidence, not a new live run or broader pricing certification. See [PowerShell verification](revision-v0.4-results.md).

Version 0.3 also includes a native-field adapter for the pinned 152-service catalog. Friendly mappings below remain unchanged. Native configurations combine actual server schemas with the common state added by Microsoft's observed `addBaseSchema` helper, with input values normalized by the real page. Each CSV supplies every configured native field explicitly; computed price/total fields, service/schema identifiers, descriptions and UI metadata are excluded from editable columns. Native versions/field types are rechecked before loading, then every supplied field is compared deeply against native state. Native unit/factor fields are retained; no universal SKU or quantity conversion is inferred. See [current evidence](revision-v0.3-results.md) for service-level import/export status.

The common base contains unpriced zero placeholders and an initial `hasPricing` flag. Neither establishes fresh pricing. Verification also requires native derived outputs (description, layout or service-specific price-cache fields) and computed totals. Three services whose normal product picker produces only placeholders are blocked explicitly before import. The 149-service combined official workbook covers the remaining default samples.

Templates were captured from **real UI-created modules**, cross-checked against the live public schema and then exercised in the live calculator. Versioned fixtures retain input state; derived prices, descriptions and layout identifiers are not used to author an estimate. `total=0` and `upfrontTotal=0` are unpriced initial placeholders from the native schema. Successful verification requires fresh native `prices.total` equal to the actual module total, matching source fields and the official export. Neither stored totals nor a `hasPricing` flag alone establish success.

The reusable script pins the site deployment and SHA-256 of each full verified template. It checks live schema version, field names and field types before creating an estimate. Unsupported shapes abort. Additional service-specific invariants are covered by live mapping checks and negative tests; the signature is not a complete general-purpose JSON schema validator.

| Input | Native state | Validation |
| --- | --- | --- |
| `batch_id`, `line_id`, `label` | `displayName = [batch_id/line_id] label` | Exact round-trip; unique line IDs per source group; combined workbook coverage |
| `region` | `region` | Unique match against current region slug or displayed name; `uksouth` → `united-kingdom-south` observed |
| VM `sku` | `size` | Exact match in current `sizesPayGo`; `Standard_D4s_v5` → `d4sv5` observed; no fuzzy fallback |
| VM `os`, Linux type | `operatingSystem=linux`, `type=ubuntu` | Only Ubuntu path verified |
| Windows licence included | `operatingSystem=windows`, `type=os-only`, `osBillingOption=payg` | AHB disabled; exact round-trip |
| VM `quantity` | `count` | Positive integer; exact round-trip |
| VM `hours_per_month` | `hours`, `hoursFactor=1` | 0–744 hours; 730-hour examples verified |
| VM PAYG | `computeBillingOption=payg`, payment `monthly` | No reservation/savings/Spot substitution |
| Disk `sku` | `managedDiskType`, `tier=premiumssd` | Exact meter `premiumssd-{tier}-lrs` must exist in region |
| Disk `storage_size_gib` | Live offer's `size` | Must equal the tier capacity; P30 → 1024 GiB observed |
| Disk `quantity` | `managedDisks` | Number of fixed monthly disks, not GiB or VM count |
| Disk redundancy | `managedDiskRedundancy=lrs` | Required explicit choice; only LRS verified |
| Currency | Estimate `currentCurrency`, native export form | Live calculator must offer it; native Export does conversion |

VM managed disks, snapshots and outbound transfer are explicitly zero. Disk snapshot, bursting and shared-mount flags are disabled; transaction usage is zero for the supported Premium SSD path. Each row becomes one independent module. Version 0.2 preassigns UUID module IDs, then passes absolute prefixes through the site's native `addCalculatorModules` action. Live tests confirm the IDs remain unchanged across loading steps and reload/resume. One empty destination is created through `openSavedOrSharedEstimate`; source groups never create additional estimates.

The compact exporter clones the native Export form payload and removes only `instances[].prices.premiumssdV2Offer` for verified compute-only VMs: `managedDisks === 0`, `managedDiskTier === "standardhdd"`, `addSnapshot === false`, and `snapshotStorage === 0`. It retains other price data, totals, descriptions and all configurations. A small baseline and compact export have identical worksheet XML; a 250-line combined official export also passed. This is a deployment-specific observation, not a general permission to strip pricing fields. See [revision evidence](revision-v0.2-results.md).

The private frontend state stores base monthly values in USD before display-currency conversion. Browser reports label those values `calculator_base_monthly_usd`; they must not be presented as GBP totals. Selected-currency totals come from Microsoft's native rendered page and native exported workbook.
