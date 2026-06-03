param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PythonCandidates = @(
    ".\.venv311\Scripts\python.exe",
    ".\.venv\Scripts\python.exe",
    "python"
)

$PythonCommand = $null

foreach ($Candidate in $PythonCandidates) {
    if ($Candidate -eq "python") {
        $PythonCommand = $Candidate
        break
    }

    if (Test-Path $Candidate) {
        $PythonCommand = $Candidate
        break
    }
}

Write-Host "[ORV] Zagon ORV API streznika"
Write-Host "[ORV] Delovna mapa: $ScriptDir"
Write-Host "[ORV] Python: $PythonCommand"
Write-Host "[ORV] URL: http://localhost:$Port"
Write-Host ""

& $PythonCommand -m uvicorn api_server:app --host $HostAddress --port $Port