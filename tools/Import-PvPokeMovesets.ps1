param(
  [string]$RankingPath = "pvpoke-rankings-1500.json",
  [string]$OutputPath = "pvpoke-default-movesets.js",
  [string]$SourceUrl = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RankingPath)) {
  Write-Host "Downloading PvPoke rankings from $SourceUrl"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $SourceUrl -UseBasicParsing -OutFile $RankingPath
}

$rankings = Get-Content -LiteralPath $RankingPath -Raw | ConvertFrom-Json
$movesets = [ordered]@{}

foreach ($entry in $rankings) {
  if (-not $entry.speciesId -or -not $entry.moveset -or $entry.moveset.Count -lt 3) {
    continue
  }

  $movesets[$entry.speciesId] = [ordered]@{
    fast = [string]$entry.moveset[0]
    charged = @([string]$entry.moveset[1], [string]$entry.moveset[2])
  }
}

$json = $movesets | ConvertTo-Json -Depth 5
$generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$content = @(
  "// Generated from PvPoke rankings-1500.json on $generatedAt."
  "// Source: $SourceUrl"
  "window.PVPOKE_DEFAULT_MOVESETS = $json;"
  ""
) -join [Environment]::NewLine

Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
Write-Host "Wrote $($movesets.Count) movesets to $OutputPath"
