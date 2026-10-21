<#
.SYNOPSIS
Export sari_prod and optionally verify a restore in sari_restore_verify.
.DESCRIPTION
Requires Node.js and the MongoDB Database Tools (mongodump and mongorestore).
The backup account needs read access to sari_prod and write access only to
sari_restore_verify. Its URI must explicitly name sari_prod. Application users
must remain scoped separately to sari_prod, sari_dev, or sari_preview.

Store the URI as a Windows-protected SecureString, readable by the current user:
Read-Host 'Backup MongoDB URI' -AsSecureString | Export-Clixml -LiteralPath '.backups/backup-connection.xml'
Restrict access to .backups. The protected credential is tied to its Windows user
and machine; it is not a portable recovery key. Never put the URI in arguments.

Archives preserve BSON types and indexes but are not encrypted by mongodump.
Protect archives containing authentication data, copy them to private off-machine
storage, and choose a retention schedule. Run during a quiet period: this export
is not an oplog-based point-in-time snapshot.

Verification compares documents, BSON types, collection options, and indexes,
then clears only the disposable sari_restore_verify collections. A success
manifest records the archive SHA-256 and whether restore verification completed.

For recovery, restore into a new database using temporary scoped credentials,
verify it, then switch the API connection and redeploy. Keep BETTER_AUTH_SECRET
stable for a database-only restore. For controlled migrations, deploy with
MAINTENANCE_MODE=true, verify blocked reads/writes, and drain in-flight requests
before copying. Disable maintenance and verify readiness, login, and pantry
persistence before retiring the former database or revoking migration access.
.PARAMETER VerifyRestore
Restore into sari_restore_verify, compare it with production, then clean it up.
.PARAMETER ToolsDirectory
Directory containing the official mongodump.exe and mongorestore.exe tools.
.PARAMETER OutputDirectory
Private archive directory; defaults to .backups/archives.
.PARAMETER CredentialPath
SecureString XML file created by the Windows user running this script.
.EXAMPLE
./scripts/backup-atlas.ps1
.EXAMPLE
./scripts/backup-atlas.ps1 -VerifyRestore
#>
param(
  [switch]$VerifyRestore,
  [string]$ToolsDirectory = (Join-Path $PSScriptRoot '../.backups/tools/mongodb-database-tools-windows-x86_64-100.19.1/bin'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '../.backups/archives'),
  [string]$CredentialPath = (Join-Path $PSScriptRoot '../.backups/backup-connection.xml')
)

$ErrorActionPreference = 'Stop'
$dumpTool = Join-Path $ToolsDirectory 'mongodump.exe'
$restoreTool = Join-Path $ToolsDirectory 'mongorestore.exe'
if (!(Test-Path -LiteralPath $dumpTool) -or !(Test-Path -LiteralPath $restoreTool)) {
  throw 'Install MongoDB Database Tools or pass -ToolsDirectory. Run Get-Help ./scripts/backup-atlas.ps1 -Full for setup.'
}
if (!(Test-Path -LiteralPath $CredentialPath)) {
  throw 'The protected backup connection is missing. Run Get-Help ./scripts/backup-atlas.ps1 -Full for credential setup.'
}

$protectedConnection = Import-Clixml -LiteralPath $CredentialPath
if ($protectedConnection -isnot [Security.SecureString]) {
  throw 'Expected a Windows-protected SecureString connection.'
}
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protectedConnection)
try {
  $connection = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
if ($connection -notmatch '^mongodb\+srv://[^/]+/sari_prod(?:\?|$)') {
  throw 'Backup source must be the sari_prod production database.'
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$archive = Join-Path $OutputDirectory "sari_prod-$timestamp.archive.gz"
$configPath = [IO.Path]::GetTempFileName()
try {
  # Credentials remain off the command line. Delete the temporary config on every exit.
  $jsonConnection = ConvertTo-Json -InputObject $connection -Compress
  [IO.File]::WriteAllText($configPath, "uri: $jsonConnection`n")
  & $dumpTool --config $configPath --db sari_prod "--archive=$archive" --gzip
  if ($LASTEXITCODE -ne 0) { throw 'mongodump failed; the archive is incomplete.' }
  if ($VerifyRestore) {
    # Only this disposable database is writable by the backup user.
    & $restoreTool --config $configPath "--archive=$archive" --gzip '--nsFrom=sari_prod.*' '--nsTo=sari_restore_verify.*' --drop
    if ($LASTEXITCODE -ne 0) { throw 'mongorestore failed in the disposable verification database.' }
    $connection | & node (Join-Path $PSScriptRoot 'verify-atlas-restore.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Restore verification or cleanup failed; see the verification output.' }
  }
  $manifest = [ordered]@{
    database = 'sari_prod'
    createdUtc = [DateTime]::UtcNow.ToString('o')
    archive = [IO.Path]::GetFileName($archive)
    sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    restoreVerified = [bool]$VerifyRestore
  }
  $manifest | ConvertTo-Json | Set-Content -LiteralPath "$archive.json" -Encoding utf8
  Write-Output "Backup complete: $archive"
} finally {
  Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
  $connection = $null
  $jsonConnection = $null
  $protectedConnection.Dispose()
}
