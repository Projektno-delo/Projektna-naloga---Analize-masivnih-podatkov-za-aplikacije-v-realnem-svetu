# NPO MQTT sistem

Ta del projekta pokriva namensko programsko opremo za zajem senzorskih podatkov, pošiljanje podatkov prek MQTT protokola in prikaz podatkov v spletni aplikaciji.

Sistem je sestavljen iz treh glavnih delov:

```txt
Mobilna aplikacija -> MQTT broker -> Spletna aplikacija
```

---

## Arhitektura sistema

### 1. Mobilna aplikacija

Mobilna aplikacija deluje kot MQTT publisher.

Njena naloga je:

- zajem GPS lokacije,
- zajem podatkov pospeškomera,
- pošiljanje senzorskih podatkov na MQTT broker,
- pošiljanje heartbeat sporočil,
- pošiljanje statusnih sporočil naprave,
- prikaz MQTT connection statusa,
- prikaz trenutnega deviceId,
- ročno pošiljanje testne meritve.

Mobilna aplikacija podatke pošilja v JSON obliki.

---

### 2. MQTT broker

Za MQTT broker se uporablja Mosquitto.

Broker sprejema sporočila iz mobilne aplikacije in jih posreduje spletni aplikaciji.

Uporabljena porta:

```txt
1883 - MQTT TCP povezava
9001 - MQTT WebSocket povezava
```

Spletna aplikacija uporablja WebSocket povezavo:

```txt
ws://localhost:9001
```

---

### 3. Spletna aplikacija

Spletna aplikacija deluje kot MQTT subscriber.

Poveže se na broker prek:

```txt
ws://localhost:9001
```

Nato posluša MQTT topice:

```txt
hribovc/senzorji
hribovc/heartbeat
hribovc/status
```

Dashboard prikazuje:

- seznam povezanih naprav,
- zadnjo meritev za vsako napravo,
- GPS podatke,
- podatke pospeškomera,
- status naprave,
- active/inactive stanje,
- število trenutno aktivnih naprav.

---

## MQTT topici

### `hribovc/senzorji`

Topic za senzorske meritve.

Mobilna aplikacija na ta topic pošilja podatke iz GPS in pospeškomera.

Primer payload-a:

```json
{
  "deviceId": "test@example.com",
  "userEmail": "test@example.com",
  "accelerometer": {
    "x": 0.123,
    "y": -0.245,
    "z": 0.981
  },
  "location": {
    "latitude": 46.5547,
    "longitude": 15.6459
  },
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

---

### `hribovc/heartbeat`

Topic za preverjanje aktivnih naprav.

Mobilna aplikacija pošilja heartbeat sporočila vsakih nekaj sekund.

Primer payload-a:

```json
{
  "status": "alive",
  "deviceId": "test@example.com",
  "userEmail": "test@example.com",
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

Spletna aplikacija uporablja heartbeat za izračun, ali je naprava aktivna.

---

### `hribovc/status`

Topic za status naprave.

Mobilna aplikacija pošlje status, ko se poveže ali odklopi.

Primer online statusa:

```json
{
  "deviceId": "test@example.com",
  "userEmail": "test@example.com",
  "status": "online",
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

Primer offline statusa:

```json
{
  "deviceId": "test@example.com",
  "userEmail": "test@example.com",
  "status": "offline",
  "timestamp": "2026-06-01T12:05:00.000Z"
}
```

---

## Aktivne naprave

Spletna aplikacija zazna aktivne naprave na podlagi heartbeat sporočil.

Logika:

```txt
Če je zadnji heartbeat mlajši od 15 sekund:
naprava je active

Če heartbeat ni bil prejet več kot 15 sekund:
naprava je inactive
```

Časovna meja je nastavljena v web aplikaciji:

```txt
VITE_ACTIVE_DEVICE_TIMEOUT_MS=15000
```

Če `.env` vrednost ni nastavljena, se uporabi privzeta vrednost:

```txt
15000 ms
```

---

## Konfiguracija spletne aplikacije

Spletna aplikacija uporablja MQTT konfiguracijo:

```txt
VITE_MQTT_BROKER_URL=ws://localhost:9001
VITE_MQTT_SENSORS_TOPIC=hribovc/senzorji
VITE_MQTT_HEARTBEAT_TOPIC=hribovc/heartbeat
VITE_MQTT_STATUS_TOPIC=hribovc/status
VITE_ACTIVE_DEVICE_TIMEOUT_MS=15000
```

Če `.env` datoteka ni nastavljena, se uporabijo privzete vrednosti iz kode.

---

## Zagon MQTT brokerja

V mapi `namenska-programska-oprema` zaženi:

```bash
docker compose up -d
```

Preveri, da broker teče:

```bash
docker ps
```

Pričakovano mora biti odprt container za Mosquitto broker.

Uporabljena porta:

```txt
localhost:1883
localhost:9001
```

Za ustavitev brokerja:

```bash
docker compose down
```

---

## Zagon spletne aplikacije

Spletna aplikacija se nahaja v RAIN delu projekta:

```txt
razvoj-aplikacij-za-internet/Frontend/Hribovc/frontend/hribovc-website
```

Zagon:

```bash
cd razvoj-aplikacij-za-internet/Frontend/Hribovc/frontend/hribovc-website
npm install
npm run dev
```

Spletna aplikacija se poveže na:

```txt
ws://localhost:9001
```

MQTT dashboard je stran, ki prikazuje podatke naprav.

---

## Zagon mobilne aplikacije

Mobilna aplikacija se nahaja v:

```txt
namenska-programska-oprema/mobilna-app
```

Zagon:

```bash
cd namenska-programska-oprema/mobilna-app
npm install
npm start
```

Mobilna aplikacija prikazuje:

- MQTT connection status,
- trenutni deviceId,
- MQTT broker,
- MQTT topic,
- GPS lokacijo,
- podatke pospeškomera,
- zadnji status pošiljanja.

Dodana je tudi možnost ročnega pošiljanja testne meritve:

```txt
SEND TEST READING
```

---

## Testiranje sistema

### 1. Zaženi Mosquitto broker

V mapi `namenska-programska-oprema`:

```bash
docker compose up -d
```

Preveri:

```bash
docker ps
```

Broker mora poslušati na:

```txt
1883
9001
```

---

### 2. Zaženi spletno aplikacijo

```bash
cd razvoj-aplikacij-za-internet/Frontend/Hribovc/frontend/hribovc-website
npm run dev
```

Odpri spletno aplikacijo v brskalniku.

Na MQTT dashboardu mora biti prikazan broker URL:

```txt
ws://localhost:9001
```

Če je broker povezan, mora biti status:

```txt
Povezan
```

V browser console moraš videti nekaj podobnega:

```txt
Subscribed to MQTT topics:
```

---

### 3. Zaženi mobilno aplikacijo

```bash
cd namenska-programska-oprema/mobilna-app
npm start
```

V mobilni aplikaciji preveri:

- MQTT status,
- deviceId,
- MQTT broker,
- MQTT topic.

---

### 4. Pošlji testno meritev

V mobilni aplikaciji klikni:

```txt
SEND TEST READING
```

Spletna aplikacija mora prikazati novo napravo.

Na dashboardu se morajo prikazati:

- deviceId,
- zadnja meritev,
- GPS latitude,
- GPS longitude,
- accelerometer X,
- accelerometer Y,
- accelerometer Z,
- status naprave,
- active/inactive oznaka.

---

### 5. Preveri heartbeat

Mobilna aplikacija periodično pošilja heartbeat sporočila na:

```txt
hribovc/heartbeat
```

Dokler heartbeat prihaja, mora biti naprava označena kot:

```txt
active
```

Če heartbeat ni prejet več kot 15 sekund, mora web dashboard napravo označiti kot:

```txt
inactive
```


## Kaj prikazuje web dashboard

Web dashboard prikazuje:

```txt
MQTT connection status
broker URL
sensor topic
heartbeat topic
status topic
heartbeat timeout
število aktivnih naprav
seznam naprav
zadnjo meritev za vsako napravo
GPS podatke
pospeškomer podatke
zadnji status naprave
active/inactive stanje
zgodovino zadnjih meritev
```

---

## Troubleshooting

### Web app se ne poveže na MQTT broker

Preveri, ali Mosquitto container teče:

```bash
docker ps
```

Preveri, ali `mosquitto.conf` vsebuje WebSocket listener:

```conf
listener 1883
protocol mqtt

listener 9001
protocol websockets

allow_anonymous true
```

Če imaš `mosquitto.conf` direktno v `namenska-programska-oprema`, mora biti v `docker-compose.yml`:

```yml
volumes:
  - ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
```

Če imaš config v `namenska-programska-oprema/mosquitto/mosquitto.conf`, mora biti:

```yml
volumes:
  - ./mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
```

---

### Naprava se ne prikaže v dashboardu

Preveri, da MQTT payload vsebuje `deviceId`.

Primer:

```json
{
  "deviceId": "test-device",
  "accelerometer": {
    "x": 0.1,
    "y": 0.2,
    "z": 0.9
  },
  "location": {
    "latitude": 46.5547,
    "longitude": 15.6459
  },
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

---

### Naprava se ne označi kot active

Preveri, da mobile app pošilja heartbeat na topic:

```txt
hribovc/heartbeat
```

Heartbeat mora vsebovati isti `deviceId` kot senzorska meritev.

Primer:

```json
{
  "deviceId": "test-device",
  "status": "alive",
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```

---

### Status naprave se ne prikaže

Preveri, da mobile app pošilja status na topic:

```txt
hribovc/status
```

Primer:

```json
{
  "deviceId": "test-device",
  "status": "online",
  "timestamp": "2026-06-01T12:00:00.000Z"
}
```


