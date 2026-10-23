# Feasibility — 22 October 2026

Version 0.2 adds verified loading of 250 rows into one estimate, resumable chunks and compact official export. See [current acceptance results](revision-v0.2-results.md). The observations below describe the original integration spike; account Save remains untested.

**PARTIAL GO: a browser-assisted import and native Excel export have been proven.** No authenticated saved-estimate API round-trip has been claimed. The useful route is CSV → validated job → Microsoft's own `openSavedOrSharedEstimate` frontend action → native pricing → browser-persisted estimate → native Export. This corresponds to the pack's permitted in-page adapter route and is more fragile than a documented API.

The test used Python 3.12.14, Node 24.19.0 only as a research DevTools transport, and existing Chromium 154.0.8037.57 in a new anonymous profile. No Playwright, Selenium, Puppeteer, drivers or browser binaries were installed. The managed proxy's public CA was added to the browser trust store; TLS verification remained enabled. There was no account sign-in, credential capture, public Share operation, saved-estimate overwrite or Delete request.

## Direct observations

- Calculator page: `GET https://azure.microsoft.com/en-us/pricing/calculator/` → 200 HTML.
- Tested deployment: `20261019-0214-20261019-2100-186570892`; downloaded assets under `cdn-classic/cvt-92e6c8a972b2f733b1ce8cefffffc67f4568f7606b5be84e6316aa1ccdbbfcff/`.
- The live page uses React and Redux. Its `#azure-calculator` root exposes the provider store through the React fiber tree. Bound `appActions.openSavedOrSharedEstimate` creates a new calculator estimate, normalizes modules, fetches pricing data and renders native service modules.
- Native browser persistence survived a full page navigation/reload with the resource fields, quantity and repriced total intact. The tool invokes normal frontend actions instead of writing storage keys.
- Native public pricing context is `discounts.base = mca`, with empty billing account/profile/tenant and no additional discounts. Price responses identify public `WebDirect` offers. Existing customer contexts are not inherited by the new public-price estimates.
- Export is **server-side**. The actual Export control populates a hidden form and posts `estimate` and `currency` to `https://azure.microsoft.com/pricing/calculator/exportestimate/`. Observed response: 200, `application/octet-stream`, attachment `ExportedEstimate.xlsx`. Chromium reported a completed download. ZIP/XML inspection confirmed a real workbook containing the loaded estimate and requested resource lines.

Read-only public endpoints directly returned 200 JSON:

| Method | Path | Observed use |
| --- | --- | --- |
| GET | `/api/v2/pricing/calculator/regions/?culture=en-us` | Region aliases and exact calculator slugs |
| GET | `/api/v4/pricing/virtual-machines/metadata/?discount=mca` | Size names and VM schema `v1.3.1` |
| GET | `/api/v4/pricing/virtual-machines/calculator/united-kingdom-south/?culture=en-us&discount=mca` | Region-specific available public VM meters |
| GET | `/api/v2/pricing/managed-disks/calculator/?culture=en-us&discount=mca` | Disk capacities/meters and schema `v1.0.1` |

The browser's own load additionally requested managed-disk and bandwidth data for VM modules. Generated VMs explicitly have zero attached disks and outbound transfer, avoiding default extra consumption.

The independent TypeScript repository's API client, types and estimate store were inspected through the GitHub connector. They supplied research leads only. Implementation behavior was established from Microsoft's own current bundles and live page. In particular, this implementation does not assume that the third-party persistence format is Microsoft's storage format.

## Unknowns and deferred work

- Authenticated POST Save and account-based reopening remain untested. Use Microsoft's Save control manually; do not call an unverified endpoint from Python.
- Negotiated account pricing, AHB, reservations, savings plans and other services require separate proof and fixtures.
- Revalidation is required when the pinned frontend deployment or service schemas change. Public endpoints and frontend actions are private implementation details, not supported Microsoft integration APIs.

## Minimal operator check for account Save, if needed later

1. Use a new public-rate scratch estimate and normal interactive sign-in. Keep existing estimates intact.
2. Open DevTools Network and perform Save once. Record method, path, status, content type and **redacted body structure**. Do not copy request headers, cookies, tokens, raw HAR, tenant/billing identifiers or negotiated prices.
3. Reopen that scratch estimate through Saved estimates; check every input and export a new native workbook.
4. If developing an authenticated adapter, provide two redacted save-body examples differing only in quantity plus a redacted response shape. Keep the untouched example workbook local unless all of its contents are approved for sharing.

References: [Microsoft calculator guide](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/pricing-calculator), [live calculator](https://azure.microsoft.com/en-us/pricing/calculator/), [independent research lead](https://github.com/shrirajh/azure-pricing-calculator).
