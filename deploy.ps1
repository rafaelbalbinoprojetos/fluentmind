# ============================================================
#  KORDEN — Deploy Script
#  Uso: .\deploy.ps1 [-msg "sua mensagem de commit"] [-prod]
# ============================================================

param(
    [string]$msg  = "",
    [switch]$prod             # -prod faz deploy para producao (vercel --prod)
)

$ErrorActionPreference = "Stop"

# ── Cores ────────────────────────────────────────────────────
function Write-Step  { param($text) Write-Host "`n▶  $text" -ForegroundColor Cyan }
function Write-OK    { param($text) Write-Host "   ✓ $text" -ForegroundColor Green }
function Write-Warn  { param($text) Write-Host "   ⚠ $text" -ForegroundColor Yellow }
function Write-Fail  { param($text) Write-Host "`n   ✗ $text" -ForegroundColor Red }

# ── Cabeçalho ────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║     KORDEN  ·  Deploy        ║" -ForegroundColor DarkCyan
Write-Host "  ╚══════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""

# ── 1. Verifica dependências ─────────────────────────────────
Write-Step "Verificando dependências..."

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Fail "Git não encontrado. Instale em https://git-scm.com"
    exit 1
}
Write-OK "git OK"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Fail "Vercel CLI não encontrado. Execute: npm i -g vercel"
    exit 1
}
Write-OK "vercel CLI OK"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm não encontrado."
    exit 1
}
Write-OK "npm OK"

# ── 2. Build local (lint + build) ────────────────────────────
Write-Step "Executando build..."

npm run build 2>&1 | ForEach-Object { Write-Host "   $_" }

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Build falhou. Corrija os erros antes de fazer deploy."
    exit 1
}
Write-OK "Build concluído"

# ── 3. Git ────────────────────────────────────────────────────
Write-Step "Preparando commit..."

$status = git status --porcelain
if (-not $status) {
    Write-Warn "Nenhuma alteração para commitar. Pulando etapa de git."
} else {
    git add .

    # Mensagem de commit
    if ($msg -eq "") {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $commitMsg = "chore: deploy automatico $timestamp"
    } else {
        $commitMsg = $msg
    }

    git commit -m $commitMsg
    Write-OK "Commit: `"$commitMsg`""

    git push
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "git push falhou."
        exit 1
    }
    Write-OK "Push para repositório remoto OK"
}

# ── 4. Deploy Vercel ──────────────────────────────────────────
Write-Step "Iniciando deploy no Vercel..."

if ($prod) {
    Write-Host "   Modo: PRODUÇÃO" -ForegroundColor Yellow
    vercel --prod 2>&1 | ForEach-Object { Write-Host "   $_" }
} else {
    Write-Host "   Modo: preview (use -prod para produção)" -ForegroundColor Gray
    vercel 2>&1 | ForEach-Object { Write-Host "   $_" }
}

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Deploy Vercel falhou."
    exit 1
}

# ── 5. Concluído ───────────────────────────────────────────────
Write-Host ""
Write-Host "  ══════════════════════════════════" -ForegroundColor DarkGreen
if ($prod) {
    Write-Host "  ✅  Deploy em PRODUÇÃO concluído!" -ForegroundColor Green
} else {
    Write-Host "  ✅  Deploy (preview) concluído!"   -ForegroundColor Green
}
Write-Host "  ══════════════════════════════════" -ForegroundColor DarkGreen
Write-Host ""
