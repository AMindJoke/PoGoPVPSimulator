param(
  [switch]$IncludeMatchups
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot "build-great-league-meta-database.js"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js is required to run the offline builder. Install Node.js or run this from an environment with node available."
}

$argsList = @($script)
if ($IncludeMatchups) {
  $argsList += "--include-matchups"
}

Push-Location $root
try {
  & node @argsList
} finally {
  Pop-Location
}
