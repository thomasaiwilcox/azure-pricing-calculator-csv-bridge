# Current implementation — PowerShell 0.4

The current local CLI is `CalcBridge.ps1`, targeting Windows PowerShell 5.1 and PowerShell 7 without Python or external modules. Read `README.md`, `AGENTS.md` and `docs/revision-v0.4-results.md`. The user explicitly requested this language/platform change; it supersedes the original Python/macOS/Linux preference below.

The browser importer is unchanged from the live-tested 0.3 adapter. Keep one estimate for all selected files/groups, sequential chunks, bounded retry/backoff and recovery. The catalog has 152 explicit templates, 149 native samples with combined official export proof and three explicitly blocked services. Preserve the original workbooks and avoid claiming untested Windows 5.1 runtime or negotiated CSP pricing validation.

The original research brief follows as historical context. Later user requests and the current scope in `AGENTS.md` take precedence.

---

# Codex kickoff prompt

You are implementing a focused, dependency-light Azure Pricing Calculator CSV integration. Read `AGENT_PACK.md` in full **before writing code**. It is the governing scope and contains the research gates, exact acceptance criteria, safety requirements, deliverables, sample input contract, and official/third-party references.

**Primary objective:** Turn CSV resources into an actual estimate in Microsoft's official Azure Pricing Calculator and obtain **its own untouched native Excel export** as consulting evidence. Never substitute a Retail Prices API approximation or locally manufactured spreadsheet.

**Constraints:** No Playwright, Selenium, Puppeteer, browser driver or separate browser install; target macOS/Linux; prefer Python standard library plus a short browser-native JavaScript snippet for signed-in actions. Do not extract or save cookies or credentials. Do not assume undocumented URLs or state shapes work without direct evidence.

**Immediate assignment:** Complete R0/R1 first and find the smallest safe route to R2 (create a new scratch estimate from an observed, valid module state; reopen, verify Microsoft re-pricing and export official XLSX). Inspect the independent repo only as an unverified research lead. If you cannot access the signed-in browser, write a concise safe DevTools capture procedure and request only redacted schema data; in the meantime complete read-only investigation and minimal offline scaffolding. Report an evidence-backed GO/PARTIAL GO/NO GO before scaling up.

After R2 succeeds, implement slices M1-M6 as documented, stopping for genuine blockers rather than fabricating success. Prefer small, reviewable changes, representative live validation and built-in `unittest`. Keep the application small and resist extra infrastructure.
