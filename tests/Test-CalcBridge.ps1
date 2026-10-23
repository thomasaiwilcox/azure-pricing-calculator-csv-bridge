#requires -Version 5.1
[CmdletBinding()]
param([string] $ReportPath)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
$root = Split-Path $PSScriptRoot -Parent
Import-Module (Join-Path $root 'powershell/CalcBridge.psm1') -Force
$temp = Join-Path ([IO.Path]::GetTempPath()) ('CalcBridge tests ' + [Guid]::NewGuid().ToString('N'))
[void] [IO.Directory]::CreateDirectory($temp)
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$results = [Collections.Generic.List[object]]::new()
$options = @{ LinuxType = 'ubuntu'; WindowsLicense = 'included'; DiskRedundancy = 'lrs' }
function Assert($Condition, [string] $Message = 'Assertion failed') { if (-not $Condition) { throw $Message } }
function Read-Json([string] $Path) { return ,([CalcBridge.Formats]::Parse([CalcBridge.Formats]::Utf8([IO.File]::ReadAllBytes($Path)))) }
function Canonical($Value) { return [CalcBridge.Formats]::Json($Value, $true, $true) }
function Hash([string] $Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Expect-Error([scriptblock] $Body, [string] $Pattern) {
    $observed = $false
    try { & $Body | Out-Null } catch {
        $observed = $true
        Assert ($_.Exception.GetBaseException().Message -match $Pattern) ('Unexpected failure: ' + $_.Exception.GetBaseException().Message)
    }
    Assert $observed 'Expected operation to fail'
}
function Case([string] $Name, [scriptblock] $Body) {
    try {
        & $Body | Out-Null
        $results.Add(@{ name = $Name; passed = $true })
        Write-Host ('PASS ' + $Name)
    } catch {
        $results.Add(@{ name = $Name; passed = $false; error = $_.Exception.GetBaseException().Message })
        Write-Host ('FAIL ' + $Name + ': ' + $_.Exception.GetBaseException().Message)
    }
}
function Write-Fixture([string] $Path, [string[]] $Headers, [object[]] $Rows) {
    $builder = [Text.StringBuilder]::new()
    [void] $builder.Append([CalcBridge.Formats]::CsvLine($Headers))
    if ($Rows.Count -gt 0 -and $Rows[0] -is [string]) {
        [void] $builder.Append([CalcBridge.Formats]::CsvLine([string[]] $Rows))
    } else {
        foreach ($row in $Rows) { [void] $builder.Append([CalcBridge.Formats]::CsvLine([string[]] $row)) }
    }
    [IO.File]::WriteAllText($Path, $builder.ToString(), $utf8)
}
$sample = Join-Path $root 'fixtures/example-input.csv'
$friendly = [CalcBridge.Formats]::Csv([IO.File]::ReadAllBytes($sample))
$mixed = Join-Path $temp 'mixed run'
$catalogRun = Join-Path $temp 'catalog run'
try {
    Case 'version and help work without external modules' {
        Assert ((Invoke-CalcBridge -Command Version) -ceq '0.4.0')
        Assert ((Invoke-CalcBridge -Command Help).Count -gt 3)
    }
    Case 'friendly CSV validates with explicit licensing' {
        Assert ((Invoke-CalcBridge -Command Validate -InputPath $sample @options) -match '3 rows from 1 files')
    }
    Case 'Linux distribution is not silently assumed' {
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $sample -WindowsLicense included -DiskRedundancy lrs } 'Linux requires'
    }
    Case 'Windows licence is not silently assumed' {
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $sample -LinuxType ubuntu -DiskRedundancy lrs } 'Windows requires'
    }
    Case 'disk redundancy must be explicit' {
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $sample -LinuxType ubuntu -WindowsLicense included } 'redundancy'
    }
    Case 'mixed-folder job exactly matches the proven v3 job values' {
        Invoke-CalcBridge -Command Build -InputDirectory (Join-Path $root 'examples/mixed-service-proposal') @options -Currency GBP -PricingContext public -RunId mixed03-base -EstimateName CSV-mixed-services-03-base -ChunkSize 5 -OutputDirectory $mixed
        $actual = Read-Json (Join-Path $mixed 'import-job.json')
        $expected = Read-Json (Join-Path $root 'evidence/revision-v0.3/Mixed-services-native-base-import-job.json')
        Assert ((Canonical $actual) -ceq (Canonical $expected)) 'PowerShell job differs from the proven job'
        Assert ($actual['sources'].Count -eq 13)
        Assert ($actual['estimate']['rows'].Count -eq 15)
    }
    Case 'all 152 native service CSVs validate' {
        Assert ((Invoke-CalcBridge -Command Validate -InputDirectory (Join-Path $root 'samples/all-services')) -match '152 rows from 152 files')
    }
    Case 'all 152 samples regenerate and preserve typed settings' {
        $directory = Join-Path $temp 'all samples'
        Invoke-CalcBridge -Command Samples -OutputDirectory $directory
        Assert ([IO.Directory]::GetFiles($directory, '*.csv').Length -eq 152)
        Assert ((Invoke-CalcBridge -Command Validate -InputDirectory $directory) -match '152 rows')
        $output = Join-Path $temp 'regenerated samples run'
        Invoke-CalcBridge -Command Build -InputDirectory $directory -Currency GBP -PricingContext public -OutputDirectory $output
        $job = Read-Json (Join-Path $output 'import-job.json')
        foreach ($row in $job['estimate']['rows']) {
            Assert ((Canonical $row['configuration']) -ceq (Canonical $job['native_templates'][$row['service']]['configuration'])) 'Generated CSV changed a native setting'
        }
    }
    Case 'verified-only samples exclude the three unpriced native services' {
        $directory = Join-Path $temp 'verified samples'
        Invoke-CalcBridge -Command Samples -OutputDirectory $directory -ExportVerifiedOnly
        Assert ([IO.Directory]::GetFiles($directory, '*.csv').Length -eq 149)
        foreach ($slug in @('mariadb', 'healthcare-agent-service', 'azure-sql-edge')) { Assert (-not [IO.File]::Exists((Join-Path $directory ($slug + '.csv')))) }
    }
    Case '149-source job exactly matches the official combined-export proof' {
        $directory = Join-Path $temp '149 source files'
        [void] [IO.Directory]::CreateDirectory($directory)
        $catalog = Read-Json (Join-Path $root 'fixtures/catalog/index.json')
        foreach ($entry in $catalog['services']) {
            if ($entry['export_verified_formats'] -ccontains 'native') {
                $name = [IO.Path]::GetFileNameWithoutExtension($entry['template']) + '.csv'
                [IO.File]::Copy((Join-Path (Join-Path $root 'samples/all-services') $name), (Join-Path $directory $name))
            }
        }
        Invoke-CalcBridge -Command Build -InputDirectory $directory -Currency GBP -PricingContext public -RunId catalog03-base149 -EstimateName CSV-catalog-03-base149 -OutputDirectory $catalogRun
        $actual = Read-Json (Join-Path $catalogRun 'import-job.json')
        $expected = Read-Json (Join-Path $root 'evidence/revision-v0.3/Catalog-149-import-job.json')
        Assert ((Canonical $actual) -ceq (Canonical $expected)) '149-service PowerShell job differs from the proven job'
        Assert ($actual['estimate']['rows'].Count -eq 149)
        Assert (-not $actual.Contains('batches'))
    }
    Case 'official 149-line workbook is inspected without changing a byte' {
        $path = Join-Path $root 'evidence/revision-v0.3/Catalog-149-services-GBP.xlsx'
        $before = Hash $path
        $result = [CalcBridge.Formats]::Parse((Invoke-CalcBridge -Command InspectExport -File $path -RunDirectory $catalogRun))
        Assert ($result['matched_source_lines'] -eq 149)
        Assert ($result['sha256'] -ceq '9ff58af7907b46f2766cf13e96ccac490909923c97d387de48a15f254cba1ae5')
        Assert ($result['verification_status'] -ceq 'not-tested')
        Assert ((Hash $path) -ceq $before)
    }
    Case 'mixed workbook reconciles every file and source row' {
        $path = Join-Path $root 'evidence/revision-v0.3/Mixed-services-native-base-15-GBP.xlsx'
        $result = [CalcBridge.Formats]::Parse((Invoke-CalcBridge -Command InspectExport -File $path -RunDirectory $mixed))
        Assert ($result['matched_source_lines'] -eq 15)
        Assert ($result['origin'] -ceq 'not-established-by-file-inspection')
    }
    Case 'personal review is recorded only when explicitly requested' {
        Invoke-CalcBridge -Command InspectExport -File (Join-Path $root 'evidence/revision-v0.3/Mixed-services-native-base-15-GBP.xlsx') -RunDirectory $mixed -ConfirmReviewed
        $manifest = Read-Json (Join-Path $mixed 'manifest.json')
        Assert ($manifest['verification_status'] -ceq 'manual-export-verified')
    }
    Case 'missing or duplicate workbook lines fail reconciliation' {
        $path = Join-Path $root 'evidence/revision-v0.3/Mixed-services-native-base-15-GBP.xlsx'
        Expect-Error { Get-CBWorkbookInspection -File $path -ExpectedNames @('[missing] wrong') } 'coverage mismatch'
        $job = Read-Json (Join-Path $mixed 'import-job.json'); $one = $job['estimate']['rows'][0]['custom_name']
        Expect-Error { Get-CBWorkbookInspection -File $path -ExpectedNames @($one, $one) } 'coverage mismatch'
    }
    Case 'workbook from another estimate is rejected' {
        Expect-Error { Get-CBWorkbookInspection -File (Join-Path $root 'evidence/revision-v0.3/Mixed-services-native-base-15-GBP.xlsx') -EstimateName 'another customer' } 'estimate name'
    }
    Case 'build never overwrites an earlier run' {
        $before = Hash (Join-Path $mixed 'import-job.json')
        Expect-Error { Invoke-CalcBridge -Command Build -InputPath $sample @options -Currency GBP -PricingContext public -OutputDirectory $mixed } 'already exists'
        Assert ((Hash (Join-Path $mixed 'import-job.json')) -ceq $before)
    }
    Case 'tampering with built job bytes stops export inspection' {
        $directory = Join-Path $temp 'tamper run'
        Invoke-CalcBridge -Command Build -InputPath $sample @options -Currency GBP -PricingContext public -OutputDirectory $directory
        [IO.File]::AppendAllText((Join-Path $directory 'import-job.json'), ' ', $utf8)
        Expect-Error { Invoke-CalcBridge -Command InspectExport -File (Join-Path $root 'evidence/revision-v0.3/Mixed-services-native-base-15-GBP.xlsx') -RunDirectory $directory } 'changed after build'
    }
    Case 'bad input fails before an output directory is created' {
        $directory = Join-Path $temp 'must not exist'
        Expect-Error { Invoke-CalcBridge -Command Build -InputPath $sample -Currency GBP -PricingContext public -OutputDirectory $directory } 'Linux requires'
        Assert (-not [IO.Directory]::Exists($directory))
    }
    Case 'explicit file order and repeated line IDs across files are preserved' {
        $a = Join-Path $temp 'a.csv'; $b = Join-Path $temp 'b.csv'
        [IO.File]::Copy($sample, $a); [IO.File]::Copy($sample, $b)
        $directory = Join-Path $temp 'ordered run'
        Invoke-CalcBridge -Command Build -InputPath @($b, $a) @options -Currency USD -PricingContext public -OutputDirectory $directory
        $job = Read-Json (Join-Path $directory 'import-job.json')
        Assert ($job['sources'][0]['file'] -ceq 'b.csv')
        Assert ($job['estimate']['rows'].Count -eq 6)
        Assert ($job['estimate']['rows'][0]['custom_name'].StartsWith('[b.csv:', [StringComparison]::Ordinal))
        Assert ($job['estimate']['rows'][3]['custom_name'].StartsWith('[a.csv:', [StringComparison]::Ordinal))
    }
    Case 'recursive input is explicit and relative paths are retained' {
        $directory = Join-Path $temp 'recursive input'; [void] [IO.Directory]::CreateDirectory((Join-Path $directory 'sub'))
        [IO.File]::Copy($sample, (Join-Path $directory 'a.csv')); [IO.File]::Copy($sample, (Join-Path $directory 'sub/B.CSV'))
        Assert ((Invoke-CalcBridge -Command Validate -InputDirectory $directory @options) -match '3 rows from 1 files')
        $output = Join-Path $temp 'recursive run'
        Invoke-CalcBridge -Command Build -InputDirectory $directory -Recurse @options -Currency USD -PricingContext public -OutputDirectory $output
        $job = Read-Json (Join-Path $output 'import-job.json')
        Assert ($job['sources'][1]['file'] -ceq 'sub/B.CSV')
    }
    Case 'source-group selection retains one estimate and original source hashes' {
        $path = Join-Path $temp 'groups.csv'; $other = [string[]] $friendly.Records[1].Cells.Clone()
        $other[0] = 'second-group'
        Write-Fixture $path $friendly.Headers @($friendly.Records[0].Cells, $other)
        $output = Join-Path $temp 'selected group run'
        Invoke-CalcBridge -Command Build -InputPath $path @options -Currency GBP -PricingContext public -BatchId @('second-group') -OutputDirectory $output
        $job = Read-Json (Join-Path $output 'import-job.json')
        Assert ($job['estimate']['rows'].Count -eq 1 -and $job['estimate']['rows'][0]['batch_id'] -ceq 'second-group')
        Assert ($job['source_sha256'] -ceq (Hash $path))
        Assert ($job['sources'][0]['rows'] -eq 2 -and -not $job.Contains('batches'))
        Expect-Error { Invoke-CalcBridge -Command Build -InputPath $path @options -Currency GBP -PricingContext public -BatchId @('absent') -OutputDirectory (Join-Path $temp 'absent group run') } 'BatchId is absent'
    }
    Case 'invalid chunk and retry bounds fail before creating a run' {
        $output = Join-Path $temp 'invalid bounds run'
        foreach ($size in @(0, 101)) {
            Expect-Error { Invoke-CalcBridge -Command Build -InputPath $sample @options -Currency GBP -PricingContext public -ChunkSize $size -OutputDirectory $output } 'ChunkSize must'
        }
        foreach ($attempts in @(0, 6)) {
            Expect-Error { Invoke-CalcBridge -Command Build -InputPath $sample @options -Currency GBP -PricingContext public -MaxAttempts $attempts -OutputDirectory $output } 'MaxAttempts must'
        }
        Assert (-not [IO.Directory]::Exists($output))
    }
    Case 'ambiguous filenames and selecting a file twice are rejected' {
        $a = Join-Path $temp 'a.csv'
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath @($a, $a) @options } 'ambiguous|more than once'
        $directory = Join-Path $temp 'other'; [void] [IO.Directory]::CreateDirectory($directory)
        $other = Join-Path $directory 'a.csv'; [IO.File]::Copy($sample, $other)
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath @($a, $other) @options } 'ambiguous'
    }
    Case 'empty folders and recursion without a folder are rejected' {
        $directory = Join-Path $temp 'empty'; [void] [IO.Directory]::CreateDirectory($directory)
        Expect-Error { Invoke-CalcBridge -Command Validate -InputDirectory $directory } 'No CSV'
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $sample -Recurse @options } 'requires'
    }
    Case 'invalid UTF-8 and malformed CSV quotes are rejected' {
        $path = Join-Path $temp 'bad.csv'; [IO.File]::WriteAllBytes($path, [byte[]] @(255, 254, 0))
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path } 'UTF|translate|Unicode'
        [IO.File]::WriteAllText($path, 'batch_id,line_id' + "`n" + '"unterminated', $utf8)
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path } 'unterminated'
    }
    Case 'quoted CRLF notes retain physical source-row positions' {
        $bytes = $utf8.GetBytes("a,b`r`n1,`"first`r`nsecond`"`r`n2,last`r`n")
        $parsed = [CalcBridge.Formats]::Csv($bytes)
        Assert ($parsed.Records[0].Line -eq 2)
        Assert ($parsed.Records[1].Line -eq 4)
        Assert ($parsed.Records[0].Cells[1] -ceq "first`r`nsecond")
    }
    Case 'BOM input is accepted without modifying its source hash' {
        $path = Join-Path $temp 'bom.csv'; $bytes = [byte[]] (@(239, 187, 191) + [IO.File]::ReadAllBytes($sample))
        [IO.File]::WriteAllBytes($path, $bytes)
        $output = Join-Path $temp 'bom run'
        Invoke-CalcBridge -Command Build -InputPath $path @options -Currency USD -PricingContext public -OutputDirectory $output
        $job = Read-Json (Join-Path $output 'import-job.json')
        Assert ($job['source_sha256'] -ceq (Hash $path))
    }
    Case 'Unicode filenames and quoted labels survive the complete CSV/job path' {
        $name = 'caf' + [char] 0x00e9 + '.csv'; $label = 'caf' + [char] 0x00e9 + ', "west"'
        $path = Join-Path $temp $name; $row = [string[]] $friendly.Records[0].Cells.Clone()
        $row[[Array]::IndexOf($friendly.Headers, 'label')] = $label
        Write-Fixture $path $friendly.Headers @($row)
        $output = Join-Path $temp 'unicode run'
        Invoke-CalcBridge -Command Build -InputPath $path @options -Currency GBP -PricingContext public -OutputDirectory $output
        $job = Read-Json (Join-Path $output 'import-job.json')
        Assert ($job['sources'][0]['file'] -ceq $name -and $job['estimate']['rows'][0]['label'] -ceq $label)
        Assert ($job['source_sha256'] -ceq (Hash $path))
        Assert ($job['estimate']['rows'][0]['custom_name'].EndsWith($label, [StringComparison]::Ordinal))
    }
    Case 'duplicate source identities are rejected within a file' {
        $path = Join-Path $temp 'duplicates.csv'
        Write-Fixture $path $friendly.Headers @($friendly.Records[0].Cells, $friendly.Records[0].Cells)
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path @options } 'Duplicate line_id'
    }
    Case 'fractional, nonfinite and oversized quantities are rejected exactly' {
        $path = Join-Path $temp 'quantity.csv'; $index = [Array]::IndexOf($friendly.Headers, 'quantity')
        foreach ($quantity in @('0', '-1', '1.5', 'NaN', 'Infinity', '9007199254740991.1', '9007199254740992')) {
            $row = [string[]] $friendly.Records[0].Cells.Clone(); $row[$index] = $quantity
            Write-Fixture $path $friendly.Headers @($row)
            Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path @options } 'row 2: quantity:'
        }
    }
    Case 'formula-like labels and unsupported services are rejected' {
        $path = Join-Path $temp 'unsafe.csv'; $row = [string[]] $friendly.Records[0].Cells.Clone()
        $row[[Array]::IndexOf($friendly.Headers, 'label')] = '=HYPERLINK("https://example.org")'
        Write-Fixture $path $friendly.Headers @($row)
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path @options } 'formula'
        $row = [string[]] $friendly.Records[0].Cells.Clone(); $row[[Array]::IndexOf($friendly.Headers, 'service')] = 'azure-sql-database'
        Write-Fixture $path $friendly.Headers @($row)
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path @options } 'Unsupported friendly'
    }
    Case 'nested JSON preserves empty/single arrays, booleans and case-distinct keys' {
        $value = [CalcBridge.Formats]::Parse('{"empty":[],"one":[false],"a":1,"A":2,"text":"caf\u00e9"}')
        Assert ($value['empty'] -is [array] -and $value['empty'].Length -eq 0)
        Assert ($value['one'] -is [array] -and $value['one'].Length -eq 1 -and $value['one'][0] -is [bool])
        Assert ($value['a'] -eq 1 -and $value['A'] -eq 2)
        Assert ((Canonical $value) -match 'caf\\u00e9')
    }
    Case 'duplicate/unsafe JSON keys and nonfinite JSON are rejected' {
        foreach ($value in @('{"x":1,"x":2}', '{"__proto__":{}}', '{"constructor":{}}', '[NaN]', '[1e9999]')) {
            Expect-Error { [CalcBridge.Formats]::Parse($value) } 'JSON|key|finite'
        }
    }
    Case 'native numeric/boolean type mistakes and output columns are rejected' {
        $csv = [CalcBridge.Formats]::Csv([IO.File]::ReadAllBytes((Join-Path $root 'samples/all-services/storage.csv')))
        $path = Join-Path $temp 'native.csv'; $index = [Array]::IndexOf($csv.Headers, 'config.count')
        foreach ($invalid in @('true', '"1000"', '-1')) {
            $row = [string[]] $csv.Records[0].Cells.Clone(); $row[$index] = $invalid
            Write-Fixture $path $csv.Headers @($row)
            Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path } 'type|nonnegative'
        }
        Write-Fixture $path ([string[]] (@($csv.Headers) + 'config.total')) @([string[]] (@($csv.Records[0].Cells) + '999'))
        Expect-Error { Invoke-CalcBridge -Command Validate -InputPath $path } 'columns differ'
    }
    Case 'unknown catalog services and empty verified selections fail before writing' {
        $path = Join-Path $temp 'bad samples'
        Expect-Error { Invoke-CalcBridge -Command Samples -Service @('unknown-service') -OutputDirectory $path } 'Unknown calculator'
        Assert (-not [IO.Directory]::Exists($path))
        Expect-Error { Invoke-CalcBridge -Command Samples -Service @('mariadb') -ExportVerifiedOnly -OutputDirectory $path } 'No services'
    }
    Case 'legacy v1 official export remains inspectable' {
        $jobPath = Join-Path $root 'evidence/Final-import-job.json'; $directory = Join-Path $temp 'legacy run'
        [void] [IO.Directory]::CreateDirectory($directory); [IO.File]::Copy($jobPath, (Join-Path $directory 'import-job.json'))
        $manifest = @{ job_sha256 = Hash $jobPath; exports = @{}; verification_status = 'not-tested' }
        [IO.File]::WriteAllText((Join-Path $directory 'manifest.json'), (Canonical $manifest), $utf8)
        $result = [CalcBridge.Formats]::Parse((Invoke-CalcBridge -Command InspectExport -File (Join-Path $root 'evidence/Microsoft-Final-GBP.xlsx') -RunDirectory $directory))
        Assert ($result['matched_source_lines'] -eq 3)
    }
    Case 'plain text pretending to be XLSX is rejected without modification' {
        $path = Join-Path $temp 'not-an-export.xlsx'; [IO.File]::WriteAllText($path, 'not a workbook', $utf8); $before = Hash $path
        Expect-Error { Get-CBWorkbookInspection -File $path } 'Invalid or unsupported XLSX workbook'
        Assert ((Hash $path) -ceq $before)
    }
    Case 'decimal parsing is independent of the Windows user locale' {
        $original = [Threading.Thread]::CurrentThread.CurrentCulture
        try {
            [Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::GetCultureInfo('de-DE')
            Assert ((Invoke-CalcBridge -Command Validate -InputPath $sample @options) -match '3 rows')
        } finally { [Threading.Thread]::CurrentThread.CurrentCulture = $original }
    }
    $failures = @($results | Where-Object { -not $_['passed'] })
    $report = @{
        powershell_version = $PSVersionTable.PSVersion.ToString()
        os = [Environment]::OSVersion.VersionString
        windows_powershell_51_executed = ($PSVersionTable.PSEdition -ceq 'Desktop' -and $PSVersionTable.PSVersion.Major -eq 5 -and [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT)
        passed = $results.Count - $failures.Count; failed = $failures.Count; tests = $results.ToArray()
    }
    if ($ReportPath) { [IO.File]::WriteAllText([IO.Path]::GetFullPath($ReportPath), (Canonical $report) + "`n", $utf8) }
    Write-Host ('{0} passed; {1} failed.' -f $report['passed'], $report['failed'])
    if ($failures.Count -gt 0) { exit 1 }
} finally {
    if ([IO.Directory]::Exists($temp)) { [IO.Directory]::Delete($temp, $true) }
}
