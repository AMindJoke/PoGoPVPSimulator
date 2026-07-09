param(
  [switch]$AllShieldStates,
  [switch]$AllPokemon,
  [switch]$RankingOnly,
  [int]$Limit = 0,
  [string]$Profiles = "",
  [string]$Opponents = "",
  [string]$RankingModel = "",
  [switch]$SplitMatchups,
  [switch]$FullOutput
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "build-great-league-meta-database.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to run the offline builder. Install Node.js or run this from an environment with node available."
}

$argsList = @($script)
if ($AllShieldStates) {
  $argsList += "--all-shield-states"
}
if ($AllPokemon) {
  $argsList += "--all-pokemon"
}
if ($RankingOnly) {
  $argsList += "--ranking-only"
}
if ($Limit -gt 0) {
  $argsList += "--limit=$Limit"
}
if ($Profiles) {
  $argsList += "--profiles=$Profiles"
}
if ($Opponents) {
  $argsList += "--opponents=$Opponents"
}
if ($RankingModel) {
  $argsList += "--ranking-model=$RankingModel"
}
if ($SplitMatchups) {
  $argsList += "--split-matchups"
}
if ($FullOutput) {
  $argsList += "--full-output"
}

Push-Location $root
try {
  & node @argsList
} finally {
  Pop-Location
}
