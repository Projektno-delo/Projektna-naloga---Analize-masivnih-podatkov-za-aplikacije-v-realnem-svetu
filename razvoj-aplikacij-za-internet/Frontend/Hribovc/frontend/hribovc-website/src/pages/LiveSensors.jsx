import { useEffect, useMemo, useRef, useState } from 'react'
import { LuActivity, LuMapPin, LuRadio, LuSatellite, LuWifiOff } from 'react-icons/lu'
import { MQTT_CONFIG } from '../mqttConfig'
import { createWebMqttClient } from '../mqttClient'
import './LiveSensors.css'

const formatNumber = value => (
  Number.isFinite(value) ? value.toFixed(3) : '--'
)

const formatCoordinate = value => (
  Number.isFinite(value) ? value.toFixed(5) : '--'
)

const formatTime = timestamp => {
  if (!timestamp) {
    return '--'
  }

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return date.toLocaleTimeString('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const statusLabel = {
  connecting: 'Povezujem',
  connected: 'Povezan',
  reconnecting: 'Ponovno povezujem',
  offline: 'Odklopljen',
  error: 'Napaka',
}

const getDeviceId = value => (
  value?.deviceId
  || value?.device_id
  || value?.clientId
  || value?.id
  || 'unknown-device'
)

const createEmptyDevice = deviceId => ({
  deviceId,
  lastReading: null,
  lastReadingAt: null,
  lastHeartbeatAt: null,
  status: 'unknown',
  lastStatusAt: null,
})

const isDeviceActive = (device, now = Date.now()) => {
  if (!device.lastHeartbeatAt) {
    return false
  }

  const lastHeartbeatTime = new Date(device.lastHeartbeatAt).getTime()

  return now - lastHeartbeatTime <= MQTT_CONFIG.activeDeviceTimeoutMs
}

function LiveSensors() {
  const [status, setStatus] = useState('connecting')
  const [latestReading, setLatestReading] = useState(null)
  const [heartbeat, setHeartbeat] = useState(null)
  const [readings, setReadings] = useState([])
  const [devices, setDevices] = useState({})
  const [activityNow, setActivityNow] = useState(Date.now())
  const [errorMessage, setErrorMessage] = useState('')
  const clientRef = useRef(null)

  const deviceList = Object.values(devices)
  const activeDevicesCount = deviceList.filter(device => isDeviceActive(device, activityNow)).length
  const totalDevicesCount = deviceList.length

  useEffect(() => {
    setStatus('connecting')

    const client = createWebMqttClient({
      onStatusChange: nextStatus => setStatus(nextStatus),

      onSensorReading: reading => {
        const deviceId = getDeviceId(reading)
        const receivedAt = reading.timestamp || new Date().toISOString()

        setLatestReading(reading)
        setReadings(previous => [reading, ...previous].slice(0, 8))

        setDevices(previous => {
          const currentDevice = previous[deviceId] || createEmptyDevice(deviceId)

          return {
            ...previous,
            [deviceId]: {
              ...currentDevice,
              lastReading: reading,
              lastReadingAt: receivedAt,
            },
          }
        })
      },

      onHeartbeat: heartbeatMessage => {
        const deviceId = getDeviceId(heartbeatMessage)
        const heartbeatAt = heartbeatMessage.timestamp || new Date().toISOString()

        setHeartbeat(heartbeatMessage)

        setDevices(previous => {
          const currentDevice = previous[deviceId] || createEmptyDevice(deviceId)

          return {
            ...previous,
            [deviceId]: {
              ...currentDevice,
              lastHeartbeatAt: heartbeatAt,
              status: currentDevice.status === 'unknown' ? 'active' : currentDevice.status,
            },
          }
        })
      },

      onDeviceStatus: statusMessage => {
        const deviceId = getDeviceId(statusMessage)
        const statusAt = statusMessage.timestamp || new Date().toISOString()
        const deviceStatus = statusMessage.status || statusMessage.state || 'unknown'

        setDevices(previous => {
          const currentDevice = previous[deviceId] || createEmptyDevice(deviceId)

          return {
            ...previous,
            [deviceId]: {
              ...currentDevice,
              status: deviceStatus,
              lastStatusAt: statusAt,
            },
          }
        })
      },

      onError: error => setErrorMessage(error?.message || 'MQTT povezava ni uspela'),
    })

    clientRef.current = client

    return () => {
      clientRef.current?.end(true)
      clientRef.current = null
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActivityNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const connectionClass = status === 'connected' ? 'connected' : 'offline'
  const accelerometer = latestReading?.accelerometer
  const location = latestReading?.location
  const latestTime = latestReading?.timestamp

  const metrics = useMemo(() => ([
    { label: 'X', value: formatNumber(accelerometer?.x) },
    { label: 'Y', value: formatNumber(accelerometer?.y) },
    { label: 'Z', value: formatNumber(accelerometer?.z) },
  ]), [accelerometer])

  return (
    <main className="live-sensors-page">
      <section className="live-sensors-hero">
        <div>
          <p className="live-eyebrow">MQTT sprejemnik</p>
          <h1>Senzorji v živo</h1>
        </div>

        <div className={`mqtt-status-pill ${connectionClass}`}>
          {status === 'connected' ? <LuRadio size={18} /> : <LuWifiOff size={18} />}
          <span>{statusLabel[status] || status}</span>
        </div>
      </section>

      <section className="live-sensors-grid">
        <div className="sensor-panel connection-panel">
          <div className="panel-heading">
            <LuSatellite size={22} />
            <h2>Broker</h2>
          </div>

          <dl className="connection-list">
            <div>
              <dt>URL</dt>
              <dd>{MQTT_CONFIG.brokerUrl}</dd>
            </div>

            <div>
              <dt>Topic</dt>
              <dd>{MQTT_CONFIG.sensorsTopic}</dd>
            </div>

            <div>
              <dt>Status topic</dt>
              <dd>{MQTT_CONFIG.statusTopic}</dd>
            </div>

            <div>
              <dt>Heartbeat</dt>
              <dd>{formatTime(heartbeat?.timestamp)}</dd>
            </div>

            <div>
              <dt>Aktivne naprave</dt>
              <dd>{activeDevicesCount}/{totalDevicesCount}</dd>
            </div>
          </dl>

          {errorMessage && <p className="mqtt-error">{errorMessage}</p>}
        </div>

        <div className="sensor-panel accelerometer-panel">
          <div className="panel-heading">
            <LuActivity size={22} />
            <h2>Pospeškomer</h2>
          </div>

          <div className="metric-row">
            {metrics.map(metric => (
              <div className="metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="sensor-panel location-panel">
          <div className="panel-heading">
            <LuMapPin size={22} />
            <h2>GPS</h2>
          </div>

          <div className="location-values">
            <div>
              <span>Lat</span>
              <strong>{formatCoordinate(location?.latitude)}</strong>
            </div>

            <div>
              <span>Lon</span>
              <strong>{formatCoordinate(location?.longitude)}</strong>
            </div>
          </div>

          <p className="last-reading">Zadnja meritev: {formatTime(latestTime)}</p>
        </div>
      </section>

      <section className="devices-section">
        <div className="history-header">
          <h2>Povezane naprave</h2>
          <span>{activeDevicesCount}/{totalDevicesCount} aktivnih</span>
        </div>

        {deviceList.length === 0 ? (
          <p className="empty-history">Čakam na MQTT podatke iz naprav.</p>
        ) : (
          <div className="device-list">
            {deviceList.map(device => {
              const active = isDeviceActive(device, activityNow)

              return (
                <article className={`device-card ${active ? 'active' : 'inactive'}`} key={device.deviceId}>
                  <div className="device-card-header">
                    <div>
                      <span className="device-label">Device ID</span>
                      <h3>{device.deviceId}</h3>
                    </div>

                    <span className={`device-status ${active ? 'active' : 'inactive'}`}>
                      {active ? 'active' : 'inactive'}
                    </span>
                  </div>

                  <div className="device-meta">
                    <span>Zadnji heartbeat: {formatTime(device.lastHeartbeatAt)}</span>
                    <span>Zadnja meritev: {formatTime(device.lastReadingAt)}</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="sensor-history-section">
        <div className="history-header">
          <h2>Zadnje meritve</h2>
          <span>{readings.length}/8</span>
        </div>

        <div className="sensor-history-list">
          {readings.length === 0 ? (
            <p className="empty-history">Ni prejetih meritev.</p>
          ) : readings.map((reading, index) => (
            <div className="history-row" key={`${reading.timestamp || index}-${index}`}>
              <span>{formatTime(reading.timestamp)}</span>
              <span>X {formatNumber(reading.accelerometer?.x)}</span>
              <span>Y {formatNumber(reading.accelerometer?.y)}</span>
              <span>Z {formatNumber(reading.accelerometer?.z)}</span>
              <span>
                {formatCoordinate(reading.location?.latitude)}, {formatCoordinate(reading.location?.longitude)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default LiveSensors