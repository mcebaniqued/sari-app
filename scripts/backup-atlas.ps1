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
  throw 'Install the MongoDB Database Tools; see docs/database-operations.md.'
}
if (!(Test-Path -LiteralPath $CredentialPath)) {
  throw 'The protected backup connection is missing; see docs/database-operations.md.'
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
if ($connection -notmatch '^mongodb\+srv://[^/]+/sari_mvp1(?:\?|$)') {
  throw 'Backup source must be the sari_mvp1 production database.'
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$archive = Join-Path $OutputDirectory "sari_mvp1-$timestamp.archive.gz"
$configPath = [IO.Path]::GetTempFileName()
try {
  # Credentials remain off the command line. Delete the temporary config on every exit.
  $jsonConnection = ConvertTo-Json -InputObject $connection -Compress
  [IO.File]::WriteAllText($configPath, "uri: $jsonConnection`n")
  & $dumpTool --config $configPath --db sari_mvp1 "--archive=$archive" --gzip
  if ($LASTEXITCODE -ne 0) { throw 'mongodump failed; the archive is incomplete.' }
  if ($VerifyRestore) {
    # Only this disposable database is writable by the backup user.
    & $restoreTool --config $configPath "--archive=$archive" --gzip '--nsFrom=sari_mvp1.*' '--nsTo=sari_restore_verify.*' --drop
    if ($LASTEXITCODE -ne 0) { throw 'mongorestore failed in the disposable verification database.' }
    $connection | & node (Join-Path $PSScriptRoot 'verify-atlas-restore.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Restore verification or cleanup failed; see the verification output.' }
  }
  $manifest = [ordered]@{
    database = 'sari_mvp1'
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
