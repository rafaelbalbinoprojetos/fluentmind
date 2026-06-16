param(
  [string]$RemoteUrl = "https://github.com/rafaelbalbinoprojetos/fluentmind.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Initial FluentMind upload",
  [switch]$IncludeEnv
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)
  Write-Host ""
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

Write-Step "Checking FluentMind project folder"
Write-Host "Project: $ProjectRoot"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "Git is not installed or is not available in PATH."
}

if (-not (Test-Path -LiteralPath "package.json")) {
  Fail "package.json was not found. Run this script from the FluentMind project folder."
}

if (-not $IncludeEnv) {
  Write-Step "Protecting local environment files from this upload"

  if (-not (Test-Path -LiteralPath ".git")) {
    git init | Out-Host
  }

  $InfoExclude = Join-Path $ProjectRoot ".git\info\exclude"
  $SensitivePatterns = @(
    ".env",
    ".env.*",
    "!.env.example"
  )

  foreach ($Pattern in $SensitivePatterns) {
    $Existing = if (Test-Path -LiteralPath $InfoExclude) { Get-Content -LiteralPath $InfoExclude } else { @() }
    if ($Existing -notcontains $Pattern) {
      Add-Content -LiteralPath $InfoExclude -Value $Pattern
    }
  }

  Write-Host "Environment files are excluded locally. Use -IncludeEnv only if you are certain they contain no secrets."
} elseif (-not (Test-Path -LiteralPath ".git")) {
  Write-Step "Initializing Git repository"
  git init | Out-Host
}

Write-Step "Configuring remote repository"
$ExistingRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0 -and $ExistingRemote) {
  git remote set-url origin $RemoteUrl
} else {
  git remote add origin $RemoteUrl
}
Write-Host "origin -> $RemoteUrl"

Write-Step "Preparing branch"
git branch -M $Branch

Write-Step "Adding project files"
git add -A

$Status = git status --short
if (-not $Status) {
  Write-Host "No local changes to commit."
} else {
  Write-Step "Creating commit"
  git commit -m $CommitMessage | Out-Host
}

Write-Step "Pushing to GitHub"
git push -u origin $Branch

Write-Host ""
Write-Host "Upload finished." -ForegroundColor Green
Write-Host "Repository: $RemoteUrl"
