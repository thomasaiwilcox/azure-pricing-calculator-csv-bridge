# Agent instructions — Azure Pricing Calculator CSV Bridge

Read `AGENT_PACK.md` before making changes; it defines the requirements, observed facts versus unverified hypotheses, milestones, validation gates and deliverables. `CODEX_START_HERE.md` is the kickoff task; `example-input.csv` is an *illustrative input format*, not an Azure schema fixture.

## Current user request — extension pilot 0.5
- Implement the approved Chrome/Edge Manifest V3 side-panel plan. Shared importer changes are authorized; preserve CLI compatibility, v3 job identity and safety checks.
- Deliver an unpacked pilot ZIP and feature-branch PR. Proposal editing is required; full proposal storage is session-only. Keep compact export optional.
- Distinguish shared-engine live proof, mocked extension UI/transport tests and actual installed-browser acceptance. Do not claim installed Chrome/Edge checks without executing them.

## Current user request - version 0.4
- Make PowerShell the primary local CLI for Windows CSP/MSP workstations without Python. Target built-in Windows PowerShell 5.1 and PowerShell 7; no Python, Azure modules, Excel installation, browser drivers or external module dependencies for operators.
- Port validation, folder/multi-file ingestion, catalog/sample generation, job building, summaries/manifests and read-only official workbook inspection. Preserve v3 job semantics, traceability and the existing JavaScript browser adapter unchanged.
- The explicit user request supersedes the original Python language preference. Built-in .NET APIs and a reviewed local parsing helper compiled by Add-Type are allowed. A portable PowerShell runtime may be used only in the agent's test environment. Do not change workstation execution policy.
- Distinguish actual runtime validation from Windows PowerShell 5.1 compatibility review. Do not claim testing on Windows unless a real Windows runtime is available.

## Current user request — version 0.3
- Extend to the live calculator service catalog, supply a sample CSV per service, and combine multiple CSV files or a folder into the same estimate. Preserve the v0.2 recovery behavior.
- Keep the existing friendly VM/disk CSV supported. Broader services may use explicit, typed native configuration columns derived from actual Microsoft schemas. Never invent cross-service SKU mappings or silently fill economically meaningful missing inputs.
- Record per-service validation status and actual failures. A catalog entry or schema alone does not prove native import/pricing/export. Do not call untested or retired services verified; retain clear diagnostics and evidence.
- Version 0.3 proved 149 native service samples in one estimate and one Microsoft workbook. The normal product picker returned only placeholders for MariaDB, Healthcare agent service and SQL Edge; these remain blocked. Native templates include Microsoft's observed common base, but its initial zero totals / pricing flag must never count as fresh pricing.

## Current user request — version 0.2
- Put all selected CSV items in **one estimate in the same official calculator session**. Source `batch_id` groups preserve identity and no longer create separate estimates. This later explicit user request supersedes the original pack's grouping recommendation.
- Load configurable chunks into that same tool-created estimate. Use bounded backoff/retry, reconcile committed state before repeating a load, preserve module IDs, and resume from tool-owned checkpoints. Never blindly repeat account Save/Share writes or modify an unrelated estimate.
- Checkpoints may use the tool's own `calcbridge:v2:` localStorage namespace. Never directly write Microsoft's storage keys or store authentication material.
- Compact export may remove only the experimentally verified unused Premium SSD v2 cache for compute-only VMs. Preserve every resource, actual configuration, native price, total and description. Use the verified official export endpoint and leave its returned workbook untouched.

## Non-negotiable
- The final evidence is an **unmodified Excel workbook exported by Microsoft's official Azure Pricing Calculator**. A locally generated workbook, Retail Prices API estimate, fabricated cached total or mere saved payload is not proof of success.
- Do **not** use/install Playwright, Selenium, Puppeteer, browser drivers or new browser binaries. Prefer Python 3.11+ standard library and existing-browser DevTools/native JS.
- Treat all undocumented APIs and third-party JSON formats as unverified until directly tested against the current live site.
- Do not automate sign-in, read/export cookies or tokens, save unsanitized HAR files, delete/overwrite user estimates, or circumvent security/rate controls. Use scratch estimates only.
- Work in small phases: R0/R1 research, R2 official save/reopen/reprice/export proof, only then CSV builder and scaling.
- If browser access is unavailable to the agent, give the operator a minimal, safe DevTools capture procedure and ask only for redacted non-secret schemas. Do not block independent offline work.
- Mark untested assumptions and report an evidence-backed GO / PARTIAL GO / NO GO. Fail closed for any unsupported SKU, service, region, licensing or pricing combination.
- No unrelated infrastructure, frameworks, database, SaaS, or over-engineered test suite.
