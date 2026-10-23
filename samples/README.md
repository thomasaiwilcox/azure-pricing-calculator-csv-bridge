# Service CSV templates

`all-services/` contains one explicit native-field CSV for each of the 152 services listed by Microsoft's calculator on 22 October 2026. Copy the files you need into your own input folder, edit the explicit configurations, then build with `python3 -m calcbridge build --input-dir YOUR-FOLDER ...`.

Check `python3 -m calcbridge catalog` and [current acceptance results](../docs/revision-v0.3-results.md) before use. Catalog presence and a generated CSV are distinct from successful native pricing and export. Known failing samples are retained so coverage gaps stay visible; the importer does not silently omit them.

All `config.*` columns are required. Values use the site's native option names and units. Strings are literal; booleans use `true`/`false`; arrays and objects use JSON in quoted CSV cells. Computed prices/totals are not editable inputs. Samples contain observed default choices, including zero usage, rather than proposal recommendations. Native unit/factor fields must be reviewed together.

The friendly VM/disk CSV remains available at `fixtures/example-input.csv`. Both formats can share the same input folder and destination estimate. All files are validated before any new estimate is created.
