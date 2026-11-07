# junctions every skill folder into ~/.claude/skills so claude code finds them anywhere
# junctions need no admin rights or developer mode, unlike symlinks
$source = $PSScriptRoot
$target = Join-Path $HOME '.claude\skills'
New-Item -ItemType Directory -Force $target | Out-Null

Get-ChildItem $source -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } | ForEach-Object {
    $link = Join-Path $target $_.Name
    if (Test-Path $link) {
        Write-Output "skip $($_.Name), already exists"
    } else {
        New-Item -ItemType Junction -Path $link -Target $_.FullName | Out-Null
        Write-Output "linked $($_.Name)"
    }
}
