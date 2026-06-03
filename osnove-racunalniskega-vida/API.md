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





