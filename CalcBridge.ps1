#requires -Version 5.1
<#
.SYNOPSIS
Build CSV import jobs for the official Azure Pricing Calculator without Python.
.EXAMPLE
.\CalcBridge.ps1 Build -InputDirectory .\proposal -Currency GBP -PricingContext public -OutputDirectory .\runs\proposal
.EXAMPLE
.\CalcBridge.ps1 Samples -ExportVerifiedOnly -OutputDirectory .\templates
.EXAMPLE
.\CalcBridge.ps1 InspectExport -File .\estimate.xlsx -RunDirectory .\runs\proposal
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('Help', 'Version', 'Build', 'Validate', 'Catalog', 'Samples', 'InspectExport', 'Inspect-Export')]
    [string] $Command = 'Help',
    [string[]] $InputPath,
    [string] $InputDirectory,
    [switch] $Recurse,
    [ValidateSet('ubuntu')] [string] $LinuxType,
    [ValidateSet('included')] [string] $WindowsLicense,
    [ValidateSet('lrs')] [string] $DiskRedundancy,
    [string] $Currency,
    [ValidateSet('public')] [string] $PricingContext,
    [string] $OutputDirectory,
    [string] $RunId,
    [string[]] $BatchId,
    [ValidateRange(1, 100)] [int] $ChunkSize = 50,
    [ValidateRange(1, 5)] [int] $MaxAttempts = 3,
    [string] $EstimateName,
    [string] $File,
    [string] $RunDirectory,
    [switch] $ConfirmReviewed,
    [string[]] $Service,
    [switch] $ExportVerifiedOnly,
    [switch] $AsJson
)
$ErrorActionPreference = 'Stop'
try {
    Import-Module (Join-Path $PSScriptRoot 'powershell/CalcBridge.psm1') -Force -ErrorAction Stop
    Invoke-CalcBridge @PSBoundParameters
    exit 0
} catch {
    [Console]::Error.WriteLine('ERROR: ' + $_.Exception.GetBaseException().Message)
    exit 2
}
