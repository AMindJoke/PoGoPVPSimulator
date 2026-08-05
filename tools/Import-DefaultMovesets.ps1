param(
  [string]$RankingPath = "rankings-1500.json",
  [string]$OutputPath = "default-movesets.js"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RankingPath)) {
  throw "Rankings file not found: $RankingPath"
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
  "// Generated default Great League movesets on $generatedAt."
  "window.BATTLE_DEFAULT_MOVESETS = $json;"
  ""
) -join [Environment]::NewLine

Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
Write-Host "Wrote $($movesets.Count) movesets to $OutputPath"
