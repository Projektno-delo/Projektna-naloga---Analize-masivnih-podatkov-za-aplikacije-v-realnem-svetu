$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot "razvoj-aplikacij-za-internet\backend"
$orvPython = Join-Path $projectRoot "osnove-racunalniskega-vida\.venv\Scripts\python.exe"

function Get-HribovcLanIp {
    $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
        Sort-Object RouteMetric, InterfaceMetric |
        Select-Object -First 1

    if ($route) {
        $routeAddress = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" } |
            Select-Object -First 1 -ExpandProperty IPAddress

        if ($routeAddress) {
            return $routeAddress
        }
    }

    $fallbackAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" } |
        Select-Object -First 1 -ExpandProperty IPAddress

    if ($fallbackAddress) {
        return $fallbackAddress
    }

    return "127.0.0.1"
}

if (-not (Test-Path $orvPython)) {
    throw "ORV Python virtual environment was not found: $orvPython"
}

$portInUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

if ($portInUse) {
    foreach ($listener in $portInUse) {
        $processName = "unknown"

        try {
            $processName = (Get-Process -Id $listener.OwningProcess -ErrorAction Stop).ProcessName
        } catch {
            $processName = "unknown"
        }

        Write-Host "Port 3000 is already used by PID $($listener.OwningProcess) ($processName)."
    }

    Write-Host "Stop that process before starting the manual backend."
    exit 1
}

Set-Location $backendDir
$lanIp = Get-HribovcLanIp

$env:MONGODB_URI = "mongodb://127.0.0.1:27017"
$env:MONGODB_DB = "hribovc"
$env:MQTT_BROKER_URL = "mqtt://${lanIp}:1883"
$env:ORV_API_URL = "http://127.0.0.1:8000"
$env:ORV_PC_FACE_LOGIN_ENABLED = "true"
$env:PYTHON_BIN = $orvPython

Write-Host "Starting manual Hribovc backend on http://localhost:3000"
Write-Host "Backend LAN URL: http://${lanIp}:3000"
Write-Host "MQTT broker for backend/mobile: $env:MQTT_BROKER_URL"
Write-Host "Using ORV Python: $env:PYTHON_BIN"
node server.js
