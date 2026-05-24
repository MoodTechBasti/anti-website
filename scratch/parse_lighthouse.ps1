$reportPath = "C:\Users\basti\AppData\Local\Temp\chrome-devtools-mcp-ykPi5B\report.json"
if (Test-Path $reportPath) {
    $json = Get-Content $reportPath -Raw | ConvertFrom-Json
    $keys = $json.audits | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name
    Write-Output "--- FOUND AUDIT KEYS ($($keys.Count)) ---"
    $keys | Sort-Object | Out-String | Write-Output
} else {
    Write-Output "Report not found"
}
