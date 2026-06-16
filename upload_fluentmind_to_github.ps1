param(
  [string]$RemoteUrl = "https://github.com/rafaelbalbinoprojetos/fluentmind.git",
  [string]$Branch = "main",
  [string]$CommitMessage = "Initial FluentMind upload",
  [switch]$IncludeEnv,
  [switch]$ForceOverwriteRemote
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

Write-Step "Checking remote branch"
$RemoteBranchExists = $false
git ls-remote --exit-code --heads origin $Branch *> $null
if ($LASTEXITCODE -eq 0) {
  $RemoteBranchExists = $true
}

if ($RemoteBranchExists -and -not $ForceOverwriteRemote) {
  Write-Step "Integrating existing remote history"
  Write-Host "The remote branch already exists. Pulling it before push..."

  git fetch origin $Branch | Out-Host
  git merge "origin/$Branch" --allow-unrelated-histories --no-edit

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Merge stopped because Git found conflicts." -ForegroundColor Yellow
    Write-Host "Resolve the conflicts, then run:"
    Write-Host "  git add -A"
    Write-Host "  git commit"
    Write-Host "  git push -u origin $Branch"
    exit 1
  }
} elseif ($RemoteBranchExists -and $ForceOverwriteRemote) {
  Write-Host "ForceOverwriteRemote was provided. The remote branch will be overwritten with --force-with-lease." -ForegroundColor Yellow
}

Write-Step "Pushing to GitHub"
if ($ForceOverwriteRemote) {
  git push -u origin $Branch --force-with-lease
} else {
  git push -u origin $Branch
}

if ($LASTEXITCODE -ne 0) {
  Fail "Git push failed. Review the error above before running the script again."
}

Write-Host ""
Write-Host "Upload finished." -ForegroundColor Green
Write-Host "Repository: $RemoteUrl"
