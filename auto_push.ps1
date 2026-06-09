$projectPath = "D:\Dashboard_Bakso Ibu"
$debounceSeconds = 10
$lastPushTime = [datetime]::MinValue

$excludePatterns = @("node_modules", ".git", "package-lock.json", "auto_push.ps1")

function Should-Ignore($path) {
    foreach ($pattern in $excludePatterns) {
        if ($path -match [regex]::Escape($pattern)) { return $true }
    }
    return $false
}

function Push-Changes {
    $now = Get-Date
    $timeSinceLast = ($now - $script:lastPushTime).TotalSeconds

    if ($timeSinceLast -lt $debounceSeconds) {
        return
    }

    Set-Location $projectPath

    $status = git status --porcelain 2>&1
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "No actual changes detected."
        return
    }

    $timestamp = $now.ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "AUTO-PUSH triggered at $timestamp"

    git add -A 2>&1 | Out-Null
    $commitMsg = "auto-update: $timestamp"
    git commit -m $commitMsg 2>&1 | Out-Null
    git push origin main 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Push successful!"
    } else {
        Write-Host "Push failed."
    }

    $script:lastPushTime = $now
}

Clear-Host
Write-Host "Watching for changes... (Press Ctrl+C to stop)"

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $projectPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $false
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::DirectoryName

try {
    while ($true) {
        $result = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::All, 5000)

        if (-not $result.TimedOut) {
            $changedPath = $result.Name
            if (-not (Should-Ignore $changedPath)) {
                Write-Host "Change detected: $changedPath"
                Start-Sleep -Seconds $debounceSeconds
                Push-Changes
            }
        }
    }
}
catch {
    Write-Host "Auto-push stopped."
}
finally {
    $watcher.Dispose()
    Write-Host "Watcher disposed."
}
