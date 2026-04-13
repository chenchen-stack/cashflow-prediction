# 一键提交并推送到 origin/main（在仓库根目录执行，或右键「使用 PowerShell 运行」）
# 用法：.\scripts\push-to-github.ps1
# 可选参数：.\scripts\push-to-github.ps1 -Message "你的说明"
param(
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$changes = git status --porcelain
if (-not $changes) {
  Write-Host "无变更，无需推送。" -ForegroundColor DarkGray
  exit 0
}

git add -A
$ts = Get-Date -Format "yyyy-MM-dd HH:mm"
if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "chore: sync $ts"
}
git commit -m $Message
git push origin main
Write-Host "已推送到 GitHub: origin/main" -ForegroundColor Green
