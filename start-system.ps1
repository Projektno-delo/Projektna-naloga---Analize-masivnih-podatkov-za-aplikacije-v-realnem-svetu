$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

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

$lanIp = Get-HribovcLanIp

Write-Host "Starting Hribovc Docker services without the backend container..."
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker compose stop backend 2>$null | Out-Null
$ErrorActionPreference = $previousErrorActionPreference

docker compose up --build -d mongodb mosquitto orv-api

$composeExitCode = $LASTEXITCODE

if ($composeExitCode -eq 0) {
    docker compose up --build -d --no-deps frontend
    $composeExitCode = $LASTEXITCODE
}

if ($composeExitCode -ne 0) {
    Write-Host ""
    Write-Host "Docker Compose start failed. Check whether one of these ports is already in use:"

    $ports = @(5173, 8000, 1883, 9001, 27017)

    foreach ($port in $ports) {
        $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

        if (-not $listeners) {
            Write-Host "Port ${port}: free"
            continue
        }

        foreach ($listener in $listeners) {
            $processName = "unknown"

            try {
                $processName = (Get-Process -Id $listener.OwningProcess -ErrorAction Stop).ProcessName
            } catch {
                $processName = "unknown"
            }

            Write-Host "Port ${port}: used by PID $($listener.OwningProcess) ($processName)"
        }
    }

    Write-Host ""
    docker compose ps
    exit $composeExitCode
}

Write-Host ""
Write-Host "Hribovc Docker services are starting."
Write-Host "Frontend:  http://localhost:5173"
Write-Host "Frontend LAN for phone: http://${lanIp}:5173"
Write-Host "ORV API:   http://localhost:8000/health"
Write-Host "MQTT TCP:  mqtt://localhost:1883"
Write-Host "MQTT WS:   ws://localhost:9001"
Write-Host "MQTT WS LAN for phone: ws://${lanIp}:9001"
Write-Host "MongoDB:   mongodb://localhost:27017"
Write-Host ""
Write-Host "Backend is intentionally NOT started in Docker, so PC camera login can run on the host."
Write-Host "Start backend manually in a separate PowerShell window:"
Write-Host "  .\start-backend.ps1"
Write-Host ""
Write-Host "If Expo mobile app shows localhost, start it with:"
Write-Host "  `$env:EXPO_PUBLIC_API_URL=`"http://${lanIp}:3000`""
Write-Host "  `$env:EXPO_PUBLIC_MQTT_BROKER_URL=`"ws://${lanIp}:9001`""
Write-Host "  npx expo start -c"
Write-Host ""
Write-Host "Status:"
docker compose ps
