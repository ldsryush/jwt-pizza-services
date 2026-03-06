param(
    [Parameter(Mandatory=$true)]
    [string]$endpoint
)

Write-Host "Fetching menu from: $endpoint"
Write-Host ""

$menu = Invoke-RestMethod -Uri "$endpoint/api/order/menu" -Method Get

Write-Host "Menu Descriptions:"
Write-Host "==================`n"

foreach ($item in $menu) {
    Write-Host "`"$($item.description)`""
}

Write-Host "`n=================="
Write-Host "Total menu items: $($menu.Count)"
