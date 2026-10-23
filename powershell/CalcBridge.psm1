#requires -Version 5.1
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:Root = Split-Path $PSScriptRoot -Parent
$script:Version = '0.4.0'
$script:Utf8 = [Text.UTF8Encoding]::new($false, $true)
$script:Culture = [Globalization.CultureInfo]::InvariantCulture
$script:Core = 'batch_id line_id service label region sku os quantity hours_per_month pricing_option term storage_size_gib notes'.Split(' ')
$script:Extra = @('license', 'linux_type', 'redundancy')
$script:NativeCore = @('batch_id', 'line_id', 'service', 'label', 'notes')
if ($null -eq ('CalcBridge.Formats' -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot 'Formats.cs')
}
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

function New-CBMap {
    return ,([Collections.Specialized.OrderedDictionary]::new([StringComparer]::Ordinal))
}
function New-CBSet {
    return ,([Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal))
}
function New-CBObject([hashtable] $Fields) {
    $map = New-CBMap
    foreach ($key in $Fields.Keys) { $map[$key] = $Fields[$key] }
    return ,$map
}
function Copy-CBMap($Value) {
    $copy = New-CBMap
    foreach ($key in $Value.get_Keys()) { $copy[$key] = $Value[$key] }
    return ,$copy
}
function Get-CBJson([string] $Path) {
    return ,([CalcBridge.Formats]::Parse([CalcBridge.Formats]::Utf8([IO.File]::ReadAllBytes($Path))))
}
function ConvertTo-CBJson($Value) { return [CalcBridge.Formats]::Json($Value, $true, $true) }
function Write-CBText([string] $Path, [string] $Text) { [IO.File]::WriteAllText($Path, $Text, $script:Utf8) }
function Write-CBJson([string] $Path, $Value) { Write-CBText $Path ((ConvertTo-CBJson $Value) + "`n") }
function Get-CBHash([byte[]] $Bytes) {
    $hash = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
}
function Resolve-CBPath([string] $Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { throw 'A required file or directory path is missing' }
    return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}
function Test-CBReparse([string] $Path) {
    $current = $Path
    while ($current) {
        if ([IO.File]::Exists($current) -or [IO.Directory]::Exists($current)) {
            if (([IO.File]::GetAttributes($current) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $true }
        }
        $parent = [IO.Path]::GetDirectoryName($current)
        if ($parent -ceq $current) { break }
        $current = $parent
    }
    return $false
}
function Assert-CBText([string] $Value, [string] $Field) {
    if (-not $Value -or $Value.Length -gt 180 -or $Value -cmatch '[\x00-\x1f\x7f]') {
        throw ('{0}: must contain 1-180 characters without control characters' -f $Field)
    }
    if ($Value.TrimStart() -cmatch '^[=+\-@]') { throw ('{0}: spreadsheet formula-like text is not allowed' -f $Field) }
}
function ConvertTo-CBNumber([string] $Value, [string] $Field, [bool] $Integer, [decimal] $Minimum, [decimal] $Maximum) {
    $number = [decimal] 0
    if (-not [decimal]::TryParse($Value, [Globalization.NumberStyles]::Float, $script:Culture, [ref] $number)) {
        throw ('{0}: expected a finite number with a decimal point' -f $Field)
    }
    if ($number -lt $Minimum -or $number -gt $Maximum) { throw ('{0}: outside the supported range' -f $Field) }
    if ($Integer) {
        if ([decimal]::Truncate($number) -ne $number) { throw ('{0}: expected a whole number' -f $Field) }
        return [long] $number
    }
    return [double]::Parse($Value, [Globalization.NumberStyles]::Float, $script:Culture)
}
function Get-CBCatalog {
    if ($null -eq $script:Catalog) { $script:Catalog = Get-CBJson (Join-Path $script:Root 'fixtures/catalog/index.json') }
    return ,$script:Catalog
}
$script:Catalog = $null
function Get-CBTemplate([string] $Service) {
    $entry = $null
    foreach ($candidate in (Get-CBCatalog)['services']) {
        if ($candidate['service'] -ceq $Service) { $entry = $candidate; break }
    }
    if ($null -eq $entry) { throw ("service '{0}' is absent from the pinned calculator catalog" -f $Service) }
    $path = Join-Path (Join-Path $script:Root 'fixtures/catalog') $entry['template']
    $bytes = [IO.File]::ReadAllBytes($path)
    if ((Get-CBHash $bytes) -cne $entry['template_sha256']) { throw ('Pinned template changed for {0}; revalidation is required' -f $Service) }
    return ,([CalcBridge.Formats]::Parse([CalcBridge.Formats]::Utf8($bytes)))
}
function Assert-CBJsonValue($Value, [int] $Depth, [ref] $Count) {
    $Count.Value++
    if ($Count.Value -gt 20000 -or $Depth -gt 30) { throw 'Native JSON is too large or deeply nested' }
    if ($null -eq $Value -or $Value -is [bool]) { return }
    if ($Value -is [string]) {
        if ($Value.Length -gt 10000) { throw 'Native JSON string is too long' }
        return
    }
    if ($Value -is [Collections.IDictionary]) {
        foreach ($key in $Value.get_Keys()) { Assert-CBJsonValue $Value[$key] ($Depth + 1) $Count }
    } elseif ($Value -is [array]) {
        foreach ($item in $Value) { Assert-CBJsonValue $item ($Depth + 1) $Count }
    } else {
        $number = [double] $Value
        if ([double]::IsNaN($number) -or [double]::IsInfinity($number) -or $number -lt 0 -or $number -gt 9007199254740991) {
            throw 'Native numbers must be finite, nonnegative and within the safe JavaScript range'
        }
    }
}
function ConvertFrom-CBNativeCell([string] $Text, $Default, [string] $Field) {
    if ($Default -is [string]) {
        if ($Text.Length -gt 1000 -or $Text -cmatch '[\x00-\x1f]') { throw ('{0}: invalid string' -f $Field) }
        return $Text
    }
    $value = [CalcBridge.Formats]::Parse($Text)
    $count = 0
    Assert-CBJsonValue $value 0 ([ref] $count)
    if ($null -ne $Default) {
        $valid = if ($Default -is [bool]) { $value -is [bool] }
        elseif ($Default -is [Collections.IDictionary]) { $value -is [Collections.IDictionary] }
        elseif ($Default -is [array]) { $value -is [array] }
        else { $null -ne $value -and $value -isnot [bool] -and ($value -is [long] -or $value -is [double]) }
        if (-not $valid) { throw ('{0}: type differs from the native schema' -f $Field) }
    }
    return ,$value
}
function Read-CBRows([byte[]] $Bytes, [string] $LinuxType, [string] $WindowsLicense, [string] $DiskRedundancy) {
    $csv = [CalcBridge.Formats]::Csv($Bytes)
    $header = $csv.Headers
    $known = New-CBSet
    foreach ($field in $header) {
        if (-not $known.Add($field)) { throw 'CSV has duplicate column names' }
    }
    $native = @($header | Where-Object { $_.StartsWith('config.', [StringComparison]::Ordinal) }).Count -gt 0
    $core = if ($native) { $script:NativeCore } else { $script:Core }
    foreach ($field in $core) { if (-not $known.Contains($field)) { throw ('CSV is missing column: {0}' -f $field) } }
    if (-not $native) {
        foreach ($field in $header) { if ($script:Core -cnotcontains $field -and $script:Extra -cnotcontains $field) { throw ('Unknown CSV column: {0}' -f $field) } }
    }
    $rows = [Collections.Generic.List[object]]::new()
    $seen = New-CBSet
    $templates = New-CBMap
    foreach ($record in $csv.Records) {
        try {
            if ($record.Cells.Length -ne $header.Length) { throw ('Expected {0} cells, got {1}' -f $header.Length, $record.Cells.Length) }
            $raw = New-CBMap
            for ($i = 0; $i -lt $header.Length; $i++) { $raw[$header[$i]] = $record.Cells[$i].Trim() }
            foreach ($field in @('batch_id', 'line_id', 'label')) { Assert-CBText $raw[$field] $field }
            if ($raw['line_id'] -cnotmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$') { throw 'line_id: use 1-80 letters, digits, dots, underscores or hyphens' }
            if (-not $seen.Add($raw['batch_id'] + [char]0 + $raw['line_id'])) { throw 'Duplicate line_id within source group' }
            $row = New-CBMap
            foreach ($field in @('batch_id', 'line_id', 'label', 'notes')) { $row[$field] = $raw[$field] }
            $row['source_row'] = $record.Line
            $service = $raw['service']
            if ($native) {
                if (-not $templates.Contains($service)) { $templates[$service] = Get-CBTemplate $service }
                $template = $templates[$service]
                $expected = New-CBSet
                foreach ($field in $script:NativeCore) { [void] $expected.Add($field) }
                foreach ($field in $template['configuration'].get_Keys()) { [void] $expected.Add('config.' + $field) }
                if (-not $known.SetEquals($expected)) { throw 'Native CSV columns differ from the pinned service template; retain every config column' }
                $configuration = New-CBMap
                foreach ($field in $template['configuration'].get_Keys()) {
                    $configuration[$field] = ConvertFrom-CBNativeCell $raw['config.' + $field] $template['configuration'][$field] $field
                }
                $notesIndex = [Array]::IndexOf($header, 'notes')
                $row['notes'] = $record.Cells[$notesIndex]
                $row['format'] = 'native'; $row['configuration'] = $configuration; $row['service'] = $service
                $rows.Add($row); continue
            }
            foreach ($field in @('region', 'sku')) { Assert-CBText $raw[$field] $field; $row[$field] = $raw[$field] }
            $service = $service.ToLowerInvariant()
            if (@('virtual-machines', 'managed-disks') -cnotcontains $service) { throw ('Unsupported friendly-format service: {0}' -f $service) }
            if ($raw['pricing_option'].ToLowerInvariant() -cne 'payg' -or $raw['term']) { throw 'Friendly rows require payg and an empty term' }
            $row['service'] = $service; $row['pricing_option'] = 'payg'
            $row['quantity'] = ConvertTo-CBNumber $raw['quantity'] 'quantity' $true 1 9007199254740991
            if ($service -ceq 'virtual-machines') {
                $row['hours'] = ConvertTo-CBNumber $raw['hours_per_month'] 'hours_per_month' $false 0 744
                $os = $raw['os'].ToLowerInvariant()
                if (@('linux', 'ubuntu') -ccontains $os) {
                    $distro = if ($raw['linux_type']) { $raw['linux_type'] } elseif ($LinuxType) { $LinuxType.ToLowerInvariant() } elseif ($os -ceq 'ubuntu') { 'ubuntu' } else { '' }
                    if ($distro -cne 'ubuntu') { throw 'Linux requires linux_type=ubuntu or -LinuxType ubuntu' }
                    if ($raw['license']) { throw 'license must be empty for Ubuntu' }
                    $row['os'] = 'linux'; $row['os_type'] = 'ubuntu'; $row['license'] = ''
                } elseif ($os -ceq 'windows') {
                    $license = if ($raw['license']) { $raw['license'] } elseif ($WindowsLicense) { $WindowsLicense.ToLowerInvariant() } else { '' }
                    if ($license -cne 'included') { throw 'Windows requires license=included or -WindowsLicense included; AHB is unverified' }
                    if ($raw['linux_type']) { throw 'linux_type must be empty for Windows' }
                    $row['os'] = 'windows'; $row['os_type'] = 'os-only'; $row['license'] = 'included'
                } else { throw 'Supported friendly OS values are Linux, Ubuntu and Windows' }
                if ($raw['storage_size_gib'] -or $raw['redundancy']) { throw 'VM storage must be a separate managed-disks row' }
            } else {
                if ($raw['os'] -or $raw['hours_per_month'] -or $raw['license'] -or $raw['linux_type']) { throw 'Disk rows must leave OS, hours and licensing fields empty' }
                if ($raw['sku'] -notmatch '^P[0-9]+$') { throw 'Friendly disks support fixed Premium SSD P-tiers only' }
                $redundancy = if ($raw['redundancy']) { $raw['redundancy'] } elseif ($DiskRedundancy) { $DiskRedundancy.ToLowerInvariant() } else { '' }
                if ($redundancy -cne 'lrs') { throw 'Disk requires redundancy=lrs or -DiskRedundancy lrs' }
                $row['storage_size_gib'] = ConvertTo-CBNumber $raw['storage_size_gib'] 'storage_size_gib' $true 1 9007199254740991
                $row['redundancy'] = 'lrs'
            }
            $rows.Add($row)
        } catch { throw ('row {0}: {1}' -f $record.Line, $_.Exception.GetBaseException().Message) }
    }
    if ($rows.Count -eq 0) { throw 'CSV has no resource rows' }
    return ,$rows.ToArray()
}

function Read-CBInputs([string[]] $InputPath, [string] $InputDirectory, [bool] $Recurse,
    [string] $LinuxType, [string] $WindowsLicense, [string] $DiskRedundancy) {
    if (($InputPath -and $InputDirectory) -or (-not $InputPath -and -not $InputDirectory)) { throw 'Choose either -InputPath or -InputDirectory' }
    if ($Recurse -and -not $InputDirectory) { throw '-Recurse requires -InputDirectory' }
    $files = [Collections.Generic.List[object]]::new()
    if ($InputDirectory) {
        $directory = Resolve-CBPath $InputDirectory
        if (-not [IO.Directory]::Exists($directory) -or (Test-CBReparse $directory)) { throw 'InputDirectory must be an ordinary directory without reparse points' }
        $prefix = $directory.TrimEnd([char[]] @('\', '/')) + [IO.Path]::DirectorySeparatorChar
        $pending = [Collections.Generic.Stack[string]]::new(); $pending.Push($directory)
        $byName = New-CBMap
        while ($pending.Count -gt 0) {
            $current = $pending.Pop()
            foreach ($path in [IO.Directory]::GetFiles($current)) {
                if ([IO.Path]::GetExtension($path).ToLowerInvariant() -ceq '.csv') {
                    $relative = $path.Substring($prefix.Length).Replace('\', '/')
                    $byName[$relative] = $path
                }
            }
            if ($Recurse) {
                foreach ($subdirectory in [IO.Directory]::GetDirectories($current)) {
                    if (Test-CBReparse $subdirectory) { throw 'Recursive input contains a symbolic link or junction; select ordinary input folders' }
                    $pending.Push($subdirectory)
                }
            }
        }
        [string[]] $names = @($byName.get_Keys())
        [Array]::Sort($names, [StringComparer]::Ordinal)
        foreach ($relative in $names) { $files.Add((New-CBObject @{ path = $byName[$relative]; name = $relative })) }
    } else {
        foreach ($inputFile in $InputPath) {
            $path = Resolve-CBPath $inputFile
            $files.Add((New-CBObject @{ path = $path; name = [IO.Path]::GetFileName($path) }))
        }
    }
    if ($files.Count -eq 0) { throw 'No CSV input files found' }
    $namesSeen = New-CBSet
    $pathComparer = if ([IO.Path]::DirectorySeparatorChar -eq '\') { [StringComparer]::OrdinalIgnoreCase } else { [StringComparer]::Ordinal }
    $pathsSeen = [Collections.Generic.HashSet[string]]::new($pathComparer)
    foreach ($selected in $files) {
        $path = $selected['path']; $name = $selected['name']
        if (-not $namesSeen.Add($name)) { throw 'Input filenames are ambiguous; use distinct names or a common InputDirectory' }
        if (-not $pathsSeen.Add($path)) { throw 'The same CSV file was selected more than once' }
        if (-not [IO.File]::Exists($path) -or [IO.Path]::GetExtension($path).ToLowerInvariant() -cne '.csv') { throw ('{0}: expected an existing .csv file' -f $name) }
        if (Test-CBReparse $path) { throw ('{0}: symbolic links and junctions are not accepted as input' -f $name) }
        if ($name.Length -gt 120 -or $name -cmatch '[\x00-\x1f\x7f]') { throw 'Input filename is too long or contains control characters' }
    }
    $rows = [Collections.Generic.List[object]]::new(); $sources = [Collections.Generic.List[object]]::new()
    $firstBytes = $null
    foreach ($selected in $files) {
        $path = $selected['path']; $name = $selected['name']
        try {
            $bytes = [IO.File]::ReadAllBytes($path)
            $parsed = Read-CBRows $bytes $LinuxType $WindowsLicense $DiskRedundancy
            foreach ($row in $parsed) { $row['source_file'] = $name; $rows.Add($row) }
            $sources.Add((New-CBObject @{ file = $name; sha256 = Get-CBHash $bytes; bytes = $bytes.LongLength; rows = $parsed.Count }))
            if ($files.Count -eq 1) { $firstBytes = $bytes }
        } catch { throw ('{0}: {1}' -f $name, $_.Exception.GetBaseException().Message) }
    }
    [byte[]] $sourceBytes = $firstBytes
    if ($files.Count -ne 1) { $sourceBytes = $script:Utf8.GetBytes((ConvertTo-CBJson $sources.ToArray())) }
    return ,(New-CBObject @{ rows = $rows.ToArray(); sources = $sources.ToArray(); data = [byte[]] $sourceBytes })
}

function New-CBJob($InputData, [string] $Currency, [string] $RunId, [string] $EstimateName,
    [int] $ChunkSize, [int] $MaxAttempts, [string[]] $BatchId) {
    if ($RunId -cnotmatch '^[A-Za-z0-9][A-Za-z0-9_.-]{0,50}$') { throw 'RunId must use 1-51 letters, digits, dots, underscores or hyphens' }
    if ($Currency -cnotmatch '^[A-Z]{3}$') { throw 'Currency must be a three-letter code; live support is checked in the calculator' }
    if ($ChunkSize -lt 1 -or $ChunkSize -gt 100 -or $MaxAttempts -lt 1 -or $MaxAttempts -gt 5) { throw 'ChunkSize must be 1-100; MaxAttempts must be 1-5' }
    $name = if ($EstimateName) { $EstimateName } else { 'CSV-' + $RunId }
    Assert-CBText $name 'EstimateName'
    if (-not $name.Trim()) { throw 'EstimateName must not be whitespace' }
    $available = New-CBSet
    foreach ($row in $InputData['rows']) { [void] $available.Add($row['batch_id']) }
    $selectedGroups = New-CBSet
    foreach ($group in $BatchId) {
        if (-not $available.Contains($group)) { throw ('Requested BatchId is absent from the input: {0}' -f $group) }
        [void] $selectedGroups.Add($group)
    }
    $rows = [Collections.Generic.List[object]]::new(); $names = New-CBSet
    $templates = New-CBMap; $nativeTemplates = New-CBMap
    $multiple = $InputData['sources'].Count -gt 1
    foreach ($sourceRow in $InputData['rows']) {
        if ($selectedGroups.Count -gt 0 -and -not $selectedGroups.Contains($sourceRow['batch_id'])) { continue }
        $row = Copy-CBMap $sourceRow
        $filePrefix = if ($multiple) { $row['source_file'] + ':' } else { '' }
        $customName = '[' + $filePrefix + $row['batch_id'] + '/' + $row['line_id'] + '] ' + $row['label']
        if ($customName.Length -gt 220) { throw 'Combined source names exceed 220 characters; shorten file, group, line or label names' }
        if (-not $names.Add($customName)) { throw 'Source identities produce ambiguous calculator names' }
        $row['custom_name'] = $customName
        $service = $row['service']
        if ($row['format'] -ceq 'native') {
            if (-not $nativeTemplates.Contains($service)) { $nativeTemplates[$service] = Get-CBTemplate $service }
        } elseif (-not $templates.Contains($service)) {
            $templates[$service] = Get-CBJson (Join-Path (Join-Path $script:Root 'fixtures/templates') ($service + '.json'))
        }
        $rows.Add($row)
    }
    if ($rows.Count -eq 0) { throw 'No source rows selected' }
    return ,(New-CBObject @{
        format = 'calcbridge-job/v3'; run_id = $RunId; source_sha256 = Get-CBHash $InputData['data']
        currency = $Currency; pricing_context = 'public'; support = 'basic'; templates = $templates
        native_templates = $nativeTemplates; sources = $InputData['sources']
        loading = New-CBObject @{ chunk_size = $ChunkSize; max_attempts = $MaxAttempts; initial_backoff_ms = 1000; max_backoff_ms = 30000 }
        estimate = New-CBObject @{ name = $name; rows = $rows.ToArray() }
    })
}

function New-CBDirectory([string] $Path) {
    $absolute = Resolve-CBPath $Path
    if ([IO.File]::Exists($absolute) -or [IO.Directory]::Exists($absolute)) { throw 'OutputDirectory already exists; choose a new run to protect existing artifacts' }
    [void] [IO.Directory]::CreateDirectory($absolute)
    return $absolute
}
function Write-CBRun($Job, $InputData, [string] $OutputDirectory, [bool] $SelectedGroups) {
    # Finish serialization/summary checks before creating the output directory.
    $json = ConvertTo-CBJson $Job
    $snippet = [CalcBridge.Formats]::Utf8([IO.File]::ReadAllBytes((Join-Path $script:Root 'web/import-snippet.js')))
    $count = $Job['estimate']['rows'].Count; $size = $Job['loading']['chunk_size']
    $steps = [int] [Math]::Ceiling($count / [double] $size)
    $summary = [Collections.Generic.List[string]]::new()
    $summary.Add(('{0} source rows in ONE estimate: {1}; currency {2}; public prices; Basic support.' -f $count, $Job['estimate']['name'], $Job['currency']))
    $summary.Add(('{0} loading steps of up to {1} rows; up to {2} transient-failure attempts.' -f $steps, $size, $Job['loading']['max_attempts']))
    $summary.Add(('Selected {0} of {1} input rows; {2} source files.' -f $count, $InputData['rows'].Count, $Job['sources'].Count))
    $summary.Add('Friendly VM/disk scope: compute-only VMs and fixed Premium SSD LRS monthly disks.')
    $summary.Add('Native rows use every explicit configuration column; review units, licensing, storage and usage.')
    $summary.Add('Confirm once in the browser. Source groups and files do not create separate estimates. Account Save/Share is never invoked.')
    foreach ($row in $Job['estimate']['rows']) {
        $detail = if ($row['format'] -ceq 'native') { 'native configuration ' + (ConvertTo-CBJson $row['configuration']) }
        elseif ($row['service'] -ceq 'virtual-machines') { '{0}, {1}, quantity {2}; {3}/{4}; license {5}; {6} hours' -f $row['region'], $row['sku'], $row['quantity'], $row['os'], $row['os_type'], $row['license'], $row['hours'].ToString($script:Culture) }
        else { '{0}, {1}, quantity {2}; {3} GiB each; {4}' -f $row['region'], $row['sku'], $row['quantity'], $row['storage_size_gib'], $row['redundancy'] }
        $summary.Add(('{0}:{1} / {2}/{3}: {4}; {5}' -f $row['source_file'], $row['source_row'], $row['batch_id'], $row['line_id'], $row['service'], $detail))
    }
    $directory = New-CBDirectory $OutputDirectory
    $jobPath = Join-Path $directory 'import-job.json'
    Write-CBText $jobPath ($json + "`n")
    Write-CBText (Join-Path $directory 'import.js') ($snippet + "`nvoid AzureCalcBridge.importJob(" + $json + ");`n")
    Write-CBText (Join-Path $directory 'operator-summary.txt') ([string]::Join("`r`n", $summary.ToArray()) + "`r`n")
    $manifest = New-CBObject @{ run_id = $Job['run_id']; input_sha256 = $Job['source_sha256']; job_sha256 = Get-CBHash ([IO.File]::ReadAllBytes($jobPath)); sources = $Job['sources']; verification_status = 'not-tested'; exports = New-CBMap }
    Write-CBJson (Join-Path $directory 'manifest.json') $manifest
    return ('Built {0}. Run import.js in the official calculator DevTools console. Nothing has been sent to Microsoft.' -f $directory)
}

function Write-CBSample([string] $Path, $Template) {
    $headers = [Collections.Generic.List[string]]::new()
    $values = [Collections.Generic.List[string]]::new()
    foreach ($field in $script:NativeCore) { $headers.Add($field) }
    foreach ($value in @($Template['service'].Replace('\', '-'), 'example-001', $Template['service'], ($Template['display_name'] + ' example'), 'Microsoft native defaults; review every setting and usage')) { $values.Add([string] $value) }
    foreach ($field in $Template['configuration'].get_Keys()) {
        $headers.Add('config.' + $field); $value = $Template['configuration'][$field]
        $values.Add($(if ($value -is [string]) { $value } else { [CalcBridge.Formats]::Json($value, $false, $true) }))
    }
    Write-CBText $Path ([CalcBridge.Formats]::CsvLine($headers.ToArray()) + [CalcBridge.Formats]::CsvLine($values.ToArray()))
}

function Read-CBXml($Entry) {
    $stream = $Entry.Open()
    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $reader = [Xml.XmlReader]::Create($stream, $settings)
    try {
        $document = [Xml.XmlDocument]::new(); $document.XmlResolver = $null
        $document.Load($reader)
        return ,$document
    } finally { $reader.Dispose(); $stream.Dispose() }
}
function Get-CBWorkbookInspection {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)] [string] $File, [string[]] $ExpectedNames, [string] $EstimateName)
    $path = Resolve-CBPath $File
    try { $archive = [IO.Compression.ZipFile]::OpenRead($path) }
    catch { throw ('Invalid or unsupported XLSX workbook: {0}' -f $_.Exception.GetBaseException().Message) }
    $customNames = [Collections.Generic.List[string]]::new()
    $estimateFound = -not $EstimateName
    try {
        [long] $expanded = 0
        foreach ($entry in $archive.Entries) { $expanded += $entry.Length }
        if ($archive.Entries.Count -gt 10000 -or $expanded -gt 67108864) { throw 'Workbook exceeds the inspection size limit' }
        if ($null -eq $archive.GetEntry('xl/workbook.xml')) { throw 'File is not an XLSX workbook' }
        $strings = [Collections.Generic.List[string]]::new()
        $shared = $archive.GetEntry('xl/sharedStrings.xml')
        if ($null -ne $shared) {
            $xml = Read-CBXml $shared
            $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
            $ns.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
            foreach ($node in $xml.SelectNodes('/s:sst/s:si', $ns)) { $strings.Add($node.InnerText) }
        }
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName -cnotmatch '^xl/worksheets/sheet[^/]*\.xml$') { continue }
            $xml = Read-CBXml $entry
            $ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
            $ns.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
            $nameColumn = $null
            foreach ($row in $xml.SelectNodes('/s:worksheet/s:sheetData/s:row', $ns)) {
                $values = New-CBMap
                foreach ($cell in $row.SelectNodes('s:c', $ns)) {
                    $column = [regex]::Replace($cell.GetAttribute('r'), '[^A-Za-z]', '')
                    $valueNode = $cell.SelectSingleNode('s:v', $ns)
                    $type = $cell.GetAttribute('t')
                    $value = ''
                    if ($type -ceq 's' -and $null -ne $valueNode) {
                        $index = 0
                        if (-not [int]::TryParse($valueNode.InnerText, [ref] $index) -or $index -lt 0 -or $index -ge $strings.Count) { throw 'Invalid workbook shared-string index' }
                        $value = $strings[$index]
                    } elseif ($type -ceq 'inlineStr') {
                        $inline = $cell.SelectSingleNode('s:is', $ns)
                        if ($null -ne $inline) { $value = $inline.InnerText }
                    } elseif ($null -ne $valueNode) { $value = $valueNode.InnerText }
                    $values[$column] = $value
                    if ($EstimateName -and $value -ceq $EstimateName) { $estimateFound = $true }
                }
                if ($null -eq $nameColumn) {
                    foreach ($column in $values.get_Keys()) {
                        if ($values[$column] -ceq 'Custom name') { $nameColumn = $column; break }
                    }
                } elseif ($null -ne $values[$nameColumn] -and $values[$nameColumn].StartsWith('[', [StringComparison]::Ordinal)) {
                    $customNames.Add($values[$nameColumn])
                }
            }
        }
    } finally { $archive.Dispose() }
    if (-not $estimateFound) { throw 'Workbook estimate name does not match the requested estimate' }
    if ($PSBoundParameters.ContainsKey('ExpectedNames')) {
        $counts = New-CBMap
        foreach ($name in $ExpectedNames) { if (-not $counts.Contains($name)) { $counts[$name] = 0 }; $counts[$name]++ }
        foreach ($name in $customNames) { if (-not $counts.Contains($name)) { $counts[$name] = 0 }; $counts[$name]-- }
        $mismatch = @($counts.get_Keys() | Where-Object { $counts[$_] -ne 0 })
        if ($mismatch.Count -gt 0) { throw ('Workbook line coverage mismatch: {0}' -f [string]::Join(', ', [string[]] $mismatch)) }
    }
    return ,(New-CBObject @{
        file = [IO.Path]::GetFileName($path); sha256 = Get-CBHash ([IO.File]::ReadAllBytes($path)); bytes = ([IO.FileInfo]::new($path)).Length
        structure = 'xlsx'; custom_names = $customNames.ToArray(); line_coverage = $(if ($PSBoundParameters.ContainsKey('ExpectedNames')) { 'matched' } else { 'not-checked' })
        origin = 'not-established-by-file-inspection'
    })
}

function Invoke-CalcBridge {
    [CmdletBinding()]
    param(
        [string] $Command = 'Help', [string[]] $InputPath, [string] $InputDirectory, [switch] $Recurse,
        [string] $LinuxType, [string] $WindowsLicense, [string] $DiskRedundancy, [string] $Currency,
        [string] $PricingContext, [string] $OutputDirectory, [string] $RunId, [string[]] $BatchId,
        [int] $ChunkSize = 50, [int] $MaxAttempts = 3, [string] $EstimateName, [string] $File,
        [string] $RunDirectory, [switch] $ConfirmReviewed, [string[]] $Service,
        [switch] $ExportVerifiedOnly, [switch] $AsJson
    )
    $action = $Command.Replace('-', '').ToLowerInvariant()
    if ($action -ceq 'help') {
        return @(
            'Azure Pricing Calculator CSV Bridge - PowerShell 0.4.0',
            '.\CalcBridge.ps1 Validate -InputDirectory .\proposal',
            '.\CalcBridge.ps1 Build -InputDirectory .\proposal -Currency GBP -PricingContext public -OutputDirectory .\runs\proposal',
            '.\CalcBridge.ps1 Build -InputPath .\a.csv,.\b.csv -Currency GBP -PricingContext public -OutputDirectory .\runs\mixed',
            '.\CalcBridge.ps1 Samples -ExportVerifiedOnly -OutputDirectory .\templates',
            '.\CalcBridge.ps1 Catalog [-AsJson]',
            '.\CalcBridge.ps1 InspectExport -File .\estimate.xlsx -RunDirectory .\runs\proposal [-ConfirmReviewed]',
            'Friendly VMs/disks may require -LinuxType ubuntu -WindowsLicense included -DiskRedundancy lrs.',
            'Use Get-Help .\CalcBridge.ps1 -Full and README.md for the complete workflow.'
        )
    }
    if ($action -ceq 'version') { return $script:Version }
    if ($action -ceq 'catalog' -or $action -ceq 'samples') {
        $catalog = Get-CBCatalog
        if ($action -ceq 'catalog') {
            if ($AsJson) { return ConvertTo-CBJson $catalog }
            'service' + "`t" + 'import/pricing' + "`t" + 'official Excel' + "`t" + 'name'
            foreach ($entry in $catalog['services']) { '{0}{4}{1}{4}{2}{4}{3}' -f $entry['service'], $entry['status'], $entry['export_status'], $entry['display_name'], "`t" }
            return
        }
        $wanted = New-CBSet
        foreach ($slug in $Service) { [void] $wanted.Add($slug) }
        $available = New-CBSet
        foreach ($entry in $catalog['services']) { [void] $available.Add($entry['service']) }
        foreach ($slug in $wanted) { if (-not $available.Contains($slug)) { throw ('Unknown calculator service: {0}' -f $slug) } }
        $selected = [Collections.Generic.List[object]]::new()
        foreach ($entry in $catalog['services']) {
            if ($wanted.Count -gt 0 -and -not $wanted.Contains($entry['service'])) { continue }
            if ($ExportVerifiedOnly -and $entry['export_verified_formats'] -cnotcontains 'native') { continue }
            $selected.Add((New-CBObject @{ entry = $entry; template = Get-CBTemplate $entry['service'] }))
        }
        if ($selected.Count -eq 0) { throw 'No services match the requested coverage filter' }
        $directory = New-CBDirectory $OutputDirectory
        foreach ($item in $selected) {
            Write-CBSample (Join-Path $directory ([IO.Path]::GetFileNameWithoutExtension($item['entry']['template']) + '.csv')) $item['template']
        }
        return ('Wrote {0} service samples to {1}. Review configurations and catalog status before importing.' -f $selected.Count, $directory)
    }
    if ($action -ceq 'build' -or $action -ceq 'validate') {
        $data = Read-CBInputs $InputPath $InputDirectory $Recurse.IsPresent $LinuxType $WindowsLicense $DiskRedundancy
        if ($action -ceq 'validate') { return ('CSV valid: {0} rows from {1} files. Build combines selected rows into ONE estimate; live availability is checked in the browser.' -f $data['rows'].Count, $data['sources'].Count) }
        if (-not $Currency -or $PricingContext -cne 'public') { throw 'Build requires -Currency and -PricingContext public; negotiated pricing is unverified' }
        if (-not $RunId) { $RunId = [DateTime]::UtcNow.ToString("yyyyMMdd'T'HHmmssfffffff'Z'", $script:Culture) }
        $job = New-CBJob $data $Currency.ToUpperInvariant() $RunId $EstimateName $ChunkSize $MaxAttempts $BatchId
        return Write-CBRun $job $data $OutputDirectory ([bool] $BatchId)
    }
    if ($action -ceq 'inspectexport') {
        $directory = Resolve-CBPath $RunDirectory
        $jobPath = Join-Path $directory 'import-job.json'; $manifestPath = Join-Path $directory 'manifest.json'
        $job = Get-CBJson $jobPath; $manifest = Get-CBJson $manifestPath
        if ((Get-CBHash ([IO.File]::ReadAllBytes($jobPath))) -cne $manifest['job_sha256']) { throw 'Import job changed after build; create a fresh run' }
        $modern = @('calcbridge-job/v2', 'calcbridge-job/v3') -ccontains $job['format']
        if ($modern) {
            if ($BatchId) { throw 'This job has one combined estimate; omit BatchId to inspect every source row' }
            $estimate = $job['estimate']; $exportKey = 'combined'
        } else {
            $batches = @($job['batches'] | Where-Object { -not $BatchId -or $BatchId -ccontains $_['batch_id'] })
            if ($batches.Count -ne 1) { throw 'Select exactly one legacy batch with -BatchId' }
            $estimate = $batches[0]; $exportKey = $estimate['batch_id']
        }
        [string[]] $expected = @($estimate['rows'] | ForEach-Object { $_['custom_name'] })
        $result = Get-CBWorkbookInspection -File $File -ExpectedNames $expected -EstimateName $estimate['name']
        $result['verification_status'] = if ($ConfirmReviewed) { 'manual-export-verified' } else { 'not-tested' }
        $manifest['exports'][$exportKey] = $result
        $status = $result['verification_status']
        if (-not $modern) {
            foreach ($batch in $job['batches']) {
                if ($null -eq $manifest['exports'][$batch['batch_id']] -or $manifest['exports'][$batch['batch_id']]['verification_status'] -cne 'manual-export-verified') { $status = 'not-tested' }
            }
        }
        $manifest['verification_status'] = $status
        Write-CBJson $manifestPath $manifest
        $display = New-CBMap
        foreach ($key in $result.get_Keys()) { if ($key -cne 'custom_names') { $display[$key] = $result[$key] } }
        $display['matched_source_lines'] = $result['custom_names'].Count
        return ConvertTo-CBJson $display
    }
    throw ('Unknown command: {0}' -f $Command)
}

Export-ModuleMember -Function Invoke-CalcBridge, Get-CBWorkbookInspection
