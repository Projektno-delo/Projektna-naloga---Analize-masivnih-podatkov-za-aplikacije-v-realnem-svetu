# Osnove racunalniskega vida - ORV modul

ORV modul je del sistema Hribovc in skrbi za dodatno preverjanje identitete uporabnika z obrazno prepoznavo. Modul uporablja slike obrazov, OpenCV za zaznavo in pripravo obraza, model za prepoznavo uporabnika ter FastAPI streznik za povezavo z aplikacijskim sistemom.

## Glavne datoteke

| Datoteka | Namen |
|---|---|
| `api_server.py` | FastAPI streznik za uporabo ORV modela prek HTTP API-ja |
| `face_name_preview.py` | Trening modela, predogled kamere in prijava z obrazom |
| `train_model.py` | Ucenje SVM modela iz pripravljenih uporabniskih vzorcev |
| `augment_images.py` | Augmentacija slik za bolj robusten nabor podatkov |
| `requirements.txt` | Python knjiznice za ORV modul |
| `Dockerfile` | Docker okolje za zagon ORV API streznika |
| `API.md` | Podrobna dokumentacija API endpointov |

## Namestitev Python okolja

Priporocena je uporaba Python 3.11 ali 3.12 iz uradne strani:

```text
https://www.python.org/downloads/
```

Pri namestitvi oznacite:

```text
Add python.exe to PATH
```

Nato v PowerShell zazenite:

```powershell
cd osnove-racunalniskega-vida

python -m venv .venv

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

Preverjanje namestitve:

```powershell
python -c "import cv2, numpy, sklearn, fastapi, uvicorn, joblib; print('ORV dependencies OK')"
```

## Priprava modela

Slike oseb morajo biti v mapah:

```text
data/test_images/ImeOsebe
```

Primer:

```text
data/test_images/Anze
data/test_images/Ziga
data/test_images/Maja
```

Trening modela:

```powershell
python .\face_name_preview.py train
```

Model se shrani v:

```text
model_from_test_images
```

Za pripravo uporabniskih profilov za login:

```powershell
python .\face_name_preview.py export-users --overwrite
```

## Zagon ORV API-ja

API se zazene na portu `8000`.

Rocni zagon:

```powershell
python -m uvicorn api_server:app --host 0.0.0.0 --port 8000
```

Zagon prek PowerShell skripte:

```powershell
.\start_orv_api.ps1
```

Preverjanje:

```powershell
curl http://localhost:8000/health
```

Primer odgovora:

```json
{
  "status": "ok",
  "modelDirectory": "C:\\...\\model_from_test_images",
  "modelAvailable": true
}
```

## Docker zagon

Docker nacin je namenjen ponovljivemu zagonu ORV API streznika v izoliranem okolju.

Predpogoji:

- namescen Docker Desktop,
- Docker Desktop mora biti zagnan,
- Docker Linux engine mora delovati.

Build slike:

```powershell
docker build -t api_server .
```

Zagon containerja:

```powershell
docker run --rm --name api_server -p 8000:8000 api_server
```

Preverjanje:

```powershell
curl http://localhost:8000/health
```

Ce Docker vrne napako o `dockerDesktopLinuxEngine`, Docker Desktop ni zagnan ali Linux engine ni pripravljen.

## API endpointi

ORV API ima glavne endpointe:

| Endpoint | Metoda | Namen |
|---|---|---|
| `/health` | GET | Preveri stanje API-ja in modela |
| `/predict-face` | POST | Vrne prepoznanega uporabnika iz slike |
| `/verify-face` | POST | Preveri, ali slika pripada pricakovanemu uporabniku |

Podrobnosti in primeri klicev so v:

```text
API.md
```

## Povezava z backendom

Spletni backend uporablja ORV API prek okoljske spremenljivke:

```text
ORV_API_URL=http://localhost:8000
```

Privzeti threshold:

```text
ORV_FACE_THRESHOLD=0.7
```

Timeout za ORV API:

```text
ORV_FACE_TIMEOUT_MS=30000
```

Backend pri prijavi uporabnika poslje sliko na:

```text
POST /verify-face
```

Ce API vrne `verified: true`, se uporabniku dovoli nadaljevanje prijave.

## Testiranje

Namestitev testnih dependencyjev je del `requirements.txt`.

Zagon novih API testov:

```powershell
pytest tests/test_api_health.py tests/test_api_threshold_validation.py tests/test_api_no_face_response.py -q
```

Zagon vseh ORV testov:

```powershell
pytest tests -q
```

## Pogoste tezave

### PowerShell ne dovoli aktivacije venv

Zazeni:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### Venv kaze na staro pot

Ce se pojavi napaka z napacno potjo, na primer na drugega uporabnika, odstrani in ponovno ustvari venv:

```powershell
Remove-Item -Recurse -Force .venv
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### `No module named uvicorn`

Venv ni aktiviran ali dependencyji niso namesceni:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Docker engine ni dosegljiv

Ce Docker izpise napako z `dockerDesktopLinuxEngine`, odpri Docker Desktop in pocakaj, da se engine zazene.

### Model ni pripravljen

Zazeni:

```powershell
python .\face_name_preview.py train
```
