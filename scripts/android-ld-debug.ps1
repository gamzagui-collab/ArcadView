[CmdletBinding()]
param(
    [int]$InstanceIndex = -1,
    [string]$Serial,
    [string]$LdPlayerHome,
    [string]$SdkRoot,
    [string]$JdkHome,
    [string]$ReportRoot,
    [int]$VersionCode = 0,
    [ValidateRange(1,60)][int]$CaptureSeconds = 5,
    [switch]$SkipBuild,
    [switch]$Launch
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$workspaceRoot = Split-Path $projectRoot -Parent
$packageId = 'com.izcad.viewer'
$result = [ordered]@{ Started = (Get-Date).ToString('o'); Status = 'FAIL'; Build = 'NOT_RUN'; Install = 'NOT_RUN'; Launch = 'NOT_RUN' }
$forwardPort = $null
$transcribing = $false
$targetVerified = $false
$script:commandNumber = 0

function Run-Tool([string]$File, [string[]]$Arguments) {
    Write-Host ("`n> " + $File + ' ' + ($Arguments -join ' '))
    $previousPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5 represents native stderr (including java -version)
        # as ErrorRecords. Decide success from the native exit code instead.
        $ErrorActionPreference = 'Continue'
        $lines = & $File @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    $text = ($lines | ForEach-Object { "$_" }) -join "`n"
    $script:commandNumber++
    Save-Text ('command-{0:D3}.txt' -f $script:commandNumber) $text
    if ($text.Length -gt 6000) { Write-Host (($text -split "`n" | Select-Object -Last 35) -join "`n"); Write-Host '(Full output saved in command log.)' } else { Write-Host $text }
    if ($code -ne 0) { throw "Command failed ($code): $File $($Arguments -join ' ')`n$text" }
    return $text.Trim()
}
function Device([string[]]$Arguments) { Run-Tool $script:adbPath (@('-s', $script:deviceSerial) + $Arguments) }
function Save-Text([string]$Name, [string]$Value) { [IO.File]::WriteAllText((Join-Path $script:reportDir $Name), $Value, (New-Object Text.UTF8Encoding($false))) }
function First-Existing($Candidates) { foreach ($item in $Candidates) { if ($item -and (Test-Path -LiteralPath $item)) { return (Resolve-Path -LiteralPath $item).Path } } }

Push-Location $projectRoot
try {
    $localFile = Join-Path $projectRoot '.android-ld-debug.local.json'
    if (Test-Path -LiteralPath $localFile) {
        $local = Get-Content -LiteralPath $localFile -Raw | ConvertFrom-Json
        foreach ($key in 'LdPlayerHome','SdkRoot','JdkHome','ReportRoot','InstanceIndex') {
            if (!$PSBoundParameters.ContainsKey($key) -and $null -ne $local.$key) { Set-Variable -Name $key -Value $local.$key }
        }
    }
    if (!$ReportRoot) { $ReportRoot = Join-Path $projectRoot 'debug-artifacts' }
    $script:reportDir = Join-Path ([IO.Path]::GetFullPath($ReportRoot)) ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID)
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    Start-Transcript -Path (Join-Path $reportDir 'commands.log') | Out-Null
    $transcribing = $true
    $result.ReportDirectory = $reportDir
    $result.GitHead = Run-Tool 'git.exe' @('-c',"safe.directory=$projectRoot",'rev-parse','HEAD')
    Save-Text 'git-status.txt' (Run-Tool 'git.exe' @('-c',"safe.directory=$projectRoot",'status','--short'))
    $LdPlayerHome = First-Existing @($LdPlayerHome, 'C:\LDPlayer\LDPlayer9', 'C:\Program Files\LDPlayer\LDPlayer9')
    if (!$LdPlayerHome) { throw 'LDPlayer 9 not found. Pass -LdPlayerHome or set .android-ld-debug.local.json.' }
    $console = Join-Path $LdPlayerHome 'ldconsole.exe'
    if (!(Test-Path -LiteralPath $console)) { throw "LDPlayer console missing: $console" }
    $SdkRoot = First-Existing @($SdkRoot, $env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA 'Android\Sdk'), (Join-Path $workspaceRoot '.build-tools\android-sdk'))
    if (!$SdkRoot) { throw 'Android SDK not found. Set -SdkRoot.' }
    $script:adbPath = Join-Path $SdkRoot 'platform-tools\adb.exe'
    if (!(Test-Path -LiteralPath $adbPath)) { throw "ADB missing: $adbPath" }
    $result.Adb = Run-Tool $adbPath @('version')
    $instancesText = Run-Tool $console @('list2')
    Save-Text 'ldplayer-instances.txt' $instancesText
    $instances = @($instancesText -split "`n" | Where-Object { $_ -match '^\d+,' } | ForEach-Object {
        $fields = $_.Trim() -split ','
        [pscustomobject]@{ Index = [int]$fields[0]; Name = $fields[1]; Running = $fields[4] -eq '1' }
    })
    if ($InstanceIndex -lt 0) {
        $running = @($instances | Where-Object Running)
        if ($running.Count -ne 1) { throw 'Select exactly one LDPlayer with -InstanceIndex. No APK was installed.' }
        $InstanceIndex = $running[0].Index
    }
    $instance = @($instances | Where-Object Index -eq $InstanceIndex)
    if ($instance.Count -ne 1) { throw "LDPlayer instance $InstanceIndex does not exist." }
    if (!$instance[0].Running) {
        if (!$Launch) { throw "LDPlayer $InstanceIndex is stopped. Start it or pass -Launch. No APK was installed." }
        $null = Run-Tool $console @('launch','--index',"$InstanceIndex")
    }
    $deadline = (Get-Date).AddSeconds(60)
    do {
        # Ask LDPlayer itself for the serial. No port/index formula, no generic adb target.
        $serialText = & $console adb --index $InstanceIndex --command 'get-serialno' 2>&1
        $detected = @($serialText | ForEach-Object { "$_".Trim() } | Where-Object { $_ -match '^(emulator-\d+|127\.0\.0\.1:\d+)$' })
        if ($detected.Count -eq 1) { break }
        if (!$Launch) { break }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    if ($detected.Count -ne 1) { throw "No ADB device for LDPlayer $InstanceIndex. Enable ADB local connection in that instance and retry. $serialText" }
    $script:deviceSerial = $detected[0]
    if ($Serial -and $Serial -ne $deviceSerial) { throw "Refusing serial ${Serial}: LDPlayer $InstanceIndex reports $deviceSerial." }
    $result.Serial = $deviceSerial
    $result.Instance = @{ Index = $InstanceIndex; Name = $instance[0].Name; Version = (Get-Item (Join-Path $LdPlayerHome 'dnplayer.exe')).VersionInfo.FileVersion }
    Save-Text 'adb-devices.txt' (Run-Tool $adbPath @('devices','-l'))
    if ((Device @('get-state')) -ne 'device') { throw "LDPlayer $deviceSerial is not ready (device)." }
    $targetVerified = $true
    $result.Android = Device @('shell','getprop','ro.build.version.release')
    $result.Api = Device @('shell','getprop','ro.build.version.sdk')
    $result.Abi = Device @('shell','getprop','ro.product.cpu.abilist')
    $result.Resolution = Device @('shell','wm','size')
    $result.WebView = Device @('shell','dumpsys','webviewupdate')
    Save-Text 'webview-provider.txt' $result.WebView
    $beforePackage = Device @('shell','pm','list','packages',$packageId)
    $result.ExistingPackage = $beforePackage -match "package:$([regex]::Escape($packageId))\b"
    if ($result.ExistingPackage) { Save-Text 'package-before.txt' (Device @('shell','dumpsys','package',$packageId)) }
    if (!$SkipBuild) {
        if (!$JdkHome) {
            $portable = @(Get-ChildItem (Join-Path $workspaceRoot '.build-tools\jdk21') -Directory -ErrorAction SilentlyContinue | ForEach-Object FullName)
            $JdkHome = First-Existing (@($env:JAVA_HOME) + $portable)
        }
        if (!$JdkHome) { throw 'JDK 21 not found. Set -JdkHome.' }
        $javaVersion = Run-Tool (Join-Path $JdkHome 'bin\java.exe') @('-version')
        if ($javaVersion -notmatch 'version "21\.') { throw 'This project requires JDK 21.' }
        if (!(Test-Path -LiteralPath (Join-Path $SdkRoot 'platforms\android-36\android.jar'))) { throw 'Android SDK 36 is missing.' }
        $env:JAVA_HOME = $JdkHome
        $env:ANDROID_HOME = $SdkRoot
        $env:ANDROID_SDK_ROOT = $SdkRoot
        $env:GRADLE_USER_HOME = Join-Path $workspaceRoot '.build-tools\gradle-home'
        $env:ANDROID_USER_HOME = Join-Path $workspaceRoot '.build-tools\android-user-home'
        $env:Path = "$JdkHome\bin;$env:Path"
        $result.Java = $javaVersion
        $result.Node = Run-Tool 'node.exe' @('--version')
        $result.Npm = Run-Tool 'npm.cmd' @('--version')
        if (!(Test-Path -LiteralPath 'node_modules')) { $null = Run-Tool 'npm.cmd' @('ci','--no-audit','--no-fund') }
        $null = Run-Tool 'npm.cmd' @('test')
        $null = Run-Tool 'npm.cmd' @('run','android:prepare')
        if ($VersionCode -eq 0) {
            $VersionCode = 7
            if ($result.ExistingPackage) {
                $previous = Get-Content (Join-Path $reportDir 'package-before.txt') -Raw
                if ($previous -match 'versionCode=(\d+)') { $VersionCode = [Math]::Max(7, [int]$Matches[1] + 1) }
            }
        }
        Push-Location 'android'
        try { $null = Run-Tool '.\gradlew.bat' @('assembleDebug',"-PIZCAD_VERSION_CODE=$VersionCode",'--console=plain','--no-daemon') } finally { Pop-Location }
        $result.Build = 'PASS'
    } else { $result.Build = 'SKIPPED_EXISTING_APK' }
    $apk = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
    if (!(Test-Path -LiteralPath $apk)) { throw "Debug APK missing: $apk" }
    $hasher = [Security.Cryptography.SHA256]::Create()
    $apkStream = [IO.File]::OpenRead($apk)
    try { $apkHash = ([BitConverter]::ToString($hasher.ComputeHash($apkStream))).Replace('-','') } finally { $apkStream.Dispose(); $hasher.Dispose() }
    $result.Apk = @{ Path = $apk; Bytes = (Get-Item -LiteralPath $apk).Length; Sha256 = $apkHash }
    Save-Text 'apk-metadata.json' (Get-Content 'android\app\build\outputs\apk\debug\output-metadata.json' -Raw)
    $install = Device @('install','-r',$apk)
    if ($install -notmatch '(?m)^Success\s*$') { throw "APK install failed: $install. Existing app/data were retained; no uninstall/reset is attempted." }
    $result.Install = 'PASS'
    # Do not clear global logcat, uninstall, use -d, or reset app data.
    $start = Device @('shell','am','start','-W','-n',"$packageId/.MainActivity")
    Save-Text 'activity-start.txt' $start
    $processDeadline = (Get-Date).AddSeconds(20)
    $launchRetryTime = (Get-Date).AddSeconds(5)
    $launchRetried = $false
    do {
        $appPidBefore = (& $adbPath -s $deviceSerial shell pidof $packageId | Out-String).Trim()
        if ($appPidBefore -match '^\d+$') { break }
        if (!$launchRetried -and (Get-Date) -ge $launchRetryTime) {
            # LDPlayer can report the old Activity immediately after package
            # replacement. Retry the same explicit component, without clearing data.
            $null = Device @('shell','am','start','-W','-n',"$packageId/.MainActivity")
            $launchRetried = $true
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $processDeadline)
    if ($appPidBefore -notmatch '^\d+$') { throw 'App process not found after launch.' }
    Start-Sleep -Seconds $CaptureSeconds
    $appPidAfter = Device @('shell','pidof',$packageId)
    $result.AppPid = $appPidAfter
    $result.ProcessStable = $appPidBefore -eq $appPidAfter
    $activities = Device @('shell','dumpsys','activity','activities')
    Save-Text 'activity.txt' $activities
    if ($activities -notmatch 'mResumedActivity:.*com\.izcad\.viewer/\.MainActivity') { throw 'izCAD is not the resumed Activity.' }
    Save-Text 'package-after.txt' (Device @('shell','dumpsys','package',$packageId))
    Save-Text 'logcat.txt' (Device @('logcat','-d','-t','4000','-v','threadtime'))
    $appLog = Device @('logcat','-d','-t','4000','--pid',$appPidAfter,'-v','threadtime')
    Save-Text 'app-logcat.txt' $appLog
    $result.NativeCrash = $appLog -match 'FATAL EXCEPTION|Fatal signal \d+'
    $deviceScreenshot = "/sdcard/izcad-debug-$PID.png"
    $null = Device @('shell','screencap','-p',$deviceScreenshot)
    $null = Device @('pull',$deviceScreenshot,(Join-Path $reportDir 'screen.png'))
    $sockets = Device @('shell','cat','/proc/net/unix')
    $socketName = "webview_devtools_remote_$appPidAfter"
    if ($sockets -notmatch [regex]::Escape("@$socketName")) { throw 'Debug WebView socket missing. Check debug-only native configuration.' }
    $forwardPort = Device @('forward','tcp:0',"localabstract:$socketName")
    if ($forwardPort -notmatch '^\d+$') { throw 'Could not allocate local WebView debugging port.' }
    $result.WebViewForwardPort = [int]$forwardPort
    $result.ChromeInspect = 'chrome://inspect/#devices'
    $null = Run-Tool 'node.exe' @('scripts/android-webview-probe.mjs',$forwardPort,$reportDir,'2')
    $result.WebViewDebug = 'PASS'
    $probe = Get-Content (Join-Path $reportDir 'webview.json') -Raw | ConvertFrom-Json
    $result.WebViewErrorCount = @($probe.errors).Count
    if (!$result.ProcessStable -or $result.NativeCrash) { throw 'App crashed or restarted during the observation window.' }
    $result.Launch = 'PASS'
    $result.Status = 'PASS'
    $result.CadTests = 'NOT_RUN: execute drawing tests separately; startup does not validate CAD compatibility.'
} catch {
    $result.Error = $_.Exception.Message
    Write-Host "ERROR: $($result.Error)" -ForegroundColor Red
    if ($targetVerified) {
        # A process that dies during startup still needs diagnostic evidence.
        try { Save-Text 'failure-logcat.txt' (Device @('logcat','-d','-t','2000','-v','threadtime')) } catch { Write-Warning 'Could not collect failure Logcat.' }
    }
} finally {
    if ($forwardPort) { & $adbPath -s $deviceSerial forward --remove "tcp:$forwardPort" | Out-Null }
    $result.Finished = (Get-Date).ToString('o')
    if ($reportDir) { Save-Text 'result.json' ($result | ConvertTo-Json -Depth 10) }
    if ($transcribing) { Stop-Transcript | Out-Null }
    Pop-Location
}
Write-Host ($result | ConvertTo-Json -Depth 10)
if ($result.Status -ne 'PASS') { exit 1 }
