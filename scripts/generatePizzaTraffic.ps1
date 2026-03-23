# generatePizzaTraffic.ps1 - Simulate pizza service traffic
# Usage: .\scripts\generatePizzaTraffic.ps1 -host https://pizza-service.pizzasanghwa.click

param(
    [Parameter(Mandatory=$true)]
    [string]$host
)

Write-Host "Targeting host: $host"
Write-Host "Press Ctrl-C to stop all traffic simulation"
Write-Host "-------------------------------------------"

# Helper to extract token from JSON response
function Get-Token($response) {
    try { ($response | ConvertFrom-Json).token } catch { "" }
}

# Background job 1: Hit menu every 3 seconds
$job1 = Start-Job -ScriptBlock {
    param($h)
    while ($true) {
        try {
            $r = Invoke-WebRequest -Uri "$h/api/order/menu" -UseBasicParsing -TimeoutSec 10
            Write-Output "Requesting menu... $($r.StatusCode)"
        } catch {
            Write-Output "Requesting menu... ERROR"
        }
        Start-Sleep 3
    }
} -ArgumentList $host

# Background job 2: Invalid login every 25 seconds
$job2 = Start-Job -ScriptBlock {
    param($h)
    while ($true) {
        try {
            $body = '{"email":"unknown@jwt.com","password":"bad"}'
            $r = Invoke-WebRequest -Uri "$h/api/auth" -Method PUT -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
            Write-Output "Logging in with invalid credentials... $($r.StatusCode)"
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            Write-Output "Logging in with invalid credentials... $code"
        }
        Start-Sleep 25
    }
} -ArgumentList $host

# Background job 3: Franchisee login, wait 110s, logout
$job3 = Start-Job -ScriptBlock {
    param($h)
    while ($true) {
        try {
            $body = '{"email":"f@jwt.com","password":"franchisee"}'
            $r = Invoke-RestMethod -Uri "$h/api/auth" -Method PUT -Body $body -ContentType "application/json" -TimeoutSec 10
            $token = $r.token
            Write-Output "Login franchisee..."
            Start-Sleep 110
            Invoke-WebRequest -Uri "$h/api/auth" -Method DELETE -Headers @{Authorization="Bearer $token"} -UseBasicParsing -TimeoutSec 10 | Out-Null
            Write-Output "Logout franchisee..."
        } catch {
            Write-Output "Franchisee login error: $($_.Exception.Message)"
        }
        Start-Sleep 10
    }
} -ArgumentList $host

# Background job 4: Diner login, buy pizza, logout
$job4 = Start-Job -ScriptBlock {
    param($h)
    while ($true) {
        try {
            $body = '{"email":"d@jwt.com","password":"diner"}'
            $r = Invoke-RestMethod -Uri "$h/api/auth" -Method PUT -Body $body -ContentType "application/json" -TimeoutSec 10
            $token = $r.token
            Write-Output "Login diner..."
            $orderBody = '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05}]}'
            try {
                $pr = Invoke-WebRequest -Uri "$h/api/order" -Method POST -Body $orderBody -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing -TimeoutSec 30
                Write-Output "Bought a pizza... $($pr.StatusCode)"
            } catch {
                $code = $_.Exception.Response.StatusCode.value__
                Write-Output "Bought a pizza... $code"
            }
            Start-Sleep 20
            Invoke-WebRequest -Uri "$h/api/auth" -Method DELETE -Headers @{Authorization="Bearer $token"} -UseBasicParsing -TimeoutSec 10 | Out-Null
            Write-Output "Logout diner..."
        } catch {
            Write-Output "Diner error: $($_.Exception.Message)"
        }
        Start-Sleep 30
    }
} -ArgumentList $host

# Background job 5: Buy too many pizzas (overflow, causes factory failure)
$job5 = Start-Job -ScriptBlock {
    param($h)
    while ($true) {
        try {
            $body = '{"email":"d@jwt.com","password":"diner"}'
            $r = Invoke-RestMethod -Uri "$h/api/auth" -Method PUT -Body $body -ContentType "application/json" -TimeoutSec 10
            $token = $r.token
            Write-Output "Login hungry diner..."
            $items = ('{"menuId":1,"description":"Veggie","price":0.05},' * 22).TrimEnd(',')
            $orderBody = "{`"franchiseId`":1,`"storeId`":1,`"items`":[$items]}"
            try {
                $pr = Invoke-WebRequest -Uri "$h/api/order" -Method POST -Body $orderBody -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing -TimeoutSec 30
                Write-Output "Bought too many pizzas... $($pr.StatusCode)"
            } catch {
                $code = $_.Exception.Response.StatusCode.value__
                Write-Output "Bought too many pizzas... $code"
            }
            Start-Sleep 5
            Invoke-WebRequest -Uri "$h/api/auth" -Method DELETE -Headers @{Authorization="Bearer $token"} -UseBasicParsing -TimeoutSec 10 | Out-Null
            Write-Output "Logging out hungry diner..."
        } catch {
            Write-Output "Hungry diner error: $($_.Exception.Message)"
        }
        Start-Sleep 295
    }
} -ArgumentList $host

$jobs = @($job1, $job2, $job3, $job4, $job5)
Write-Host "All traffic generators started (Job IDs: $($jobs.Id -join ', '))"
Write-Host "Press Ctrl-C to stop..."

try {
    while ($true) {
        # Receive and display output from all jobs
        foreach ($job in $jobs) {
            $output = Receive-Job -Job $job
            if ($output) {
                $output | ForEach-Object { Write-Host $_ }
            }
        }
        Start-Sleep 1
    }
} finally {
    Write-Host "`nStopping all traffic generators..."
    $jobs | Stop-Job
    $jobs | Remove-Job
    Write-Host "Done."
}
