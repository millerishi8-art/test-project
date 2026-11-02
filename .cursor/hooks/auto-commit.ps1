$ErrorActionPreference = 'Continue'
try { [Console]::In.ReadToEnd() | Out-Null } catch { }

function Finish {
  Write-Output '{}'
  exit 0
}

if (-not (Test-Path -LiteralPath '.git')) { Finish }

git rev-parse -q --verify MERGE_HEAD 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { Finish }

$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq 'HEAD') { Finish }

$dirty = git status --porcelain
if ($dirty) {
  git add -A
  $cached = @(git diff --cached --name-only)
  if ($cached.Count -gt 0) {
    $names = ($cached | Select-Object -First 6) -join ', '
    $message = "Save the latest request on the insurance site.`n`nUpdated: $names"
    git commit -m $message | Out-Null
  }
}

git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  git push -u origin HEAD | Out-Null
} else {
  $ahead = (git rev-list --count '@{u}..HEAD' 2>$null).Trim()
  if ($ahead -match '^\d+$' -and [int]$ahead -gt 0) {
    git push | Out-Null
  }
}

Finish
