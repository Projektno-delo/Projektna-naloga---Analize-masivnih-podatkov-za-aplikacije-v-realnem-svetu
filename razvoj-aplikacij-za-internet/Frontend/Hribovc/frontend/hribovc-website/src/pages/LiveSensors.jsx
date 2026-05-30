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

function LiveSensors() {
  const [status, setStatus] = useState('connecting')
  const [latestReading, setLatestReading] = useState(null)
  const [heartbeat, setHeartbeat] = useState(null)
  const [readings, setReadings] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const clientRef = useRef(null)

  useEffect(() => {
    setStatus('connecting')
    const client = createWebMqttClient({
      onStatusChange: nextStatus => setStatus(nextStatus),
      onSensorReading: reading => {
        setLatestReading(reading)
        setReadings(previous => [reading, ...previous].slice(0, 8))
      },
      onHeartbeat: value => setHeartbeat(value),
      onError: error => setErrorMessage(error?.message || 'MQTT povezava ni uspela'),
    })

    clientRef.current = client

    return () => {
      clientRef.current?.end(true)
      clientRef.current = null
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
          <h1>Senzorji v zivo</h1>
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
              <dt>Heartbeat</dt>
              <dd>{formatTime(heartbeat?.timestamp)}</dd>
            </div>
          </dl>
          {errorMessage && <p className="mqtt-error">{errorMessage}</p>}
        </div>

        <div className="sensor-panel accelerometer-panel">
          <div className="panel-heading">
            <LuActivity size={22} />
            <h2>Pospeskomer</h2>
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

      <section className="sensor-history-section">
        <div className="history-header">
          <h2>Zadnje meritve</h2>
          <span>{readings.length}/8</span>
        </div>
        <div className="sensor-history-list">
          {readings.length === 0 ? (
            <p className="empty-history">Ni prejetih meritev.</p>
          ) : readings.map(reading => (
            <div className="history-row" key={`${reading.timestamp}-${reading.accelerometer.x}`}>
              <span>{formatTime(reading.timestamp)}</span>
              <span>X {formatNumber(reading.accelerometer.x)}</span>
              <span>Y {formatNumber(reading.accelerometer.y)}</span>
              <span>Z {formatNumber(reading.accelerometer.z)}</span>
              <span>{formatCoordinate(reading.location?.latitude)}, {formatCoordinate(reading.location?.longitude)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export default LiveSensors
