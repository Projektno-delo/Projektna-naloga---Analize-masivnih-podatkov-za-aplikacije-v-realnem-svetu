# ORV API dokumentacija

ORV modul uporablja FastAPI streznik za preverjanje obraza uporabnika. API sprejme sliko, iz nje zazna obraz, obraz normalizira in ga poslje v naucen model za prepoznavo.

Privzeti naslov API-ja:

```text
http://localhost:8000
```

Zagon:

cd osnove-racunalniskega-vida
python -m uvicorn api_server:app --host 0.0.0.0 --port 8000

GET /health
Preveri, ali API tece in ali je model pripravljen.

curl http://localhost:8000/health

POST /predict-face
Endpoint prejme sliko in vrne, kateri uporabnik je bil prepoznan.

curl -X POST http://localhost:8000/predict-face `
  -F "image=@data/test_images/Anze/1.jpg" `
  -F "threshold=0.7" `
  -F "nightMode=false"



POST /verify-face
Endpoint preveri, ali se obraz ujema s pricakovanim uporabnikom. Ta endpoint uporablja spletni backend pri face-login preverjanju.

curl -X POST http://localhost:8000/verify-face `
  -F "image=@data/test_images/Anze/1.jpg" `
  -F "expectedUser=Anze" `
  -F "threshold=0.7" `
  -F "nightMode=false"

Povezava s spletno aplikacijo
Spletni backend uporablja okoljsko spremenljivko:

ORV_API_URL=http://localhost:8000

Pri prijavi uporabnika backend poslje sliko na:
POST /verify-face

Ce je odgovor verified: true, se uporabniku dovoli nadaljevanje prijave.

## ORV 2FA z izbiro kamere

Spletna prijava zdaj omogoca izbiro:

- PC kamera: backend pozene `face_name_preview.py login-users` in preveri obraz prek kamere na racunalniku.
- Telefon kamera: backend ustvari 2FA zahtevo, jo poslje prek MQTT na mobilno aplikacijo, telefon zajame sliko in jo poslje nazaj backendu.

### POST /orv-2fa/start

Backend endpoint v spletni aplikaciji zacne ORV 2FA preverjanje.

Primer za PC kamero:

```json
{
  "email": "uporabnik@example.com",
  "usernames": ["Uporabnik", "uporabnik"],
  "cameraMode": "pc",
  "threshold": 0.62,
  "frames": 9,
  "minAgreement": 0.7,
  "margin": 0.08
}
```

Primer za telefon kamero:

```json
{
  "email": "uporabnik@example.com",
  "usernames": ["Uporabnik", "uporabnik"],
  "cameraMode": "phone",
  "threshold": 0.62
}
```

Pri `cameraMode: "phone"` backend objavi MQTT sporocilo na:

```text
hribovc/orv-2fa/request
```

Primer MQTT sporocila:

```json
{
  "type": "orv-2fa-request",
  "challengeId": "...",
  "userEmail": "uporabnik@example.com",
  "expectedUser": "uporabnik",
  "threshold": 0.62,
  "nightMode": false,
  "expiresAt": "2026-06-03T16:00:00.000Z"
}
```

### POST /orv-2fa/verify

Mobilna aplikacija po zajemu slike poslje sliko nazaj backendu:

```json
{
  "challengeId": "...",
  "deviceId": "uporabnik@example.com",
  "userEmail": "uporabnik@example.com",
  "imageBase64": "data:image/jpeg;base64,..."
}
```

Backend nato sliko posreduje ORV API endpointu `POST /verify-face`.

### GET /orv-2fa/status

Spletna aplikacija med telefonskim preverjanjem periodično preverja status:

```text
GET /orv-2fa/status?challengeId=...
```

Mozni statusi:

- `pending`
- `approved`
- `rejected`
- `expired`





