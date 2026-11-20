param()
$ErrorActionPreference='Stop'
$projectRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$package=Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
$source=Get-Content -LiteralPath 'source-config.json' -Raw | ConvertFrom-Json
$build=Get-Content -LiteralPath 'release-config.json' -Raw | ConvertFrom-Json
if($source.owner -ne 'gamzagui-collab' -or $source.repository -ne 'ArcadView-Source' -or $build.owner -ne $source.owner -or $build.repository -ne 'ArcadView'){throw 'Unexpected publication repositories'}
$tag="v$($package.version)"
if($tag -notmatch '^v\d+\.\d+\.\d+$'){throw 'Invalid version'}
$safe=$projectRoot.Replace('\','/')
function Invoke-ProjectGit { & git -c "safe.directory=$safe" @args; if($LASTEXITCODE -ne 0){throw 'Git publication failed; no force push is attempted'} }
$dirty=Invoke-ProjectGit status --porcelain
if($dirty){throw 'Commit and verify the current changes first'}
$head=(Invoke-ProjectGit rev-parse HEAD | Out-String).Trim()
$tracked=Invoke-ProjectGit ls-tree -r --name-only HEAD
if($tracked | Where-Object {$_ -match '\.(apk|aab|keystore|jks|p12|pem|key)$'}){throw 'Executable packages or private keys must not enter the source repository'}
$tags=Invoke-ProjectGit tag --list $tag
if(!$tags){Invoke-ProjectGit tag $tag $head}
if((Invoke-ProjectGit rev-list -n 1 $tag | Out-String).Trim() -ne $head){throw 'Existing version tag differs from HEAD'}
# Reuse the developer's existing Git authentication. No new keys or tokens.
Invoke-ProjectGit push --atomic "https://github.com/$($source.owner)/$($source.repository).git" HEAD:refs/heads/main --tags
Invoke-ProjectGit push --atomic "https://github.com/$($build.owner)/$($build.repository).git" HEAD:refs/heads/main "refs/tags/$tag"
Write-Output "Published source first, then started the APK release for $tag."
