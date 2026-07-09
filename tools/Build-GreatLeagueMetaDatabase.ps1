param(
  [switch]$AllShieldStates,
  [int]$Limit = 0,
  [string]$Profiles = ""
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
if ($Limit -gt 0) {
  $argsList += "--limit=$Limit"
}
if ($Profiles) {
  $argsList += "--profiles=$Profiles"
}

Push-Location $root
try {
  & node @argsList
} finally {
  Pop-Location
}
