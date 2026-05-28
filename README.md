# Hribovc

cd C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\backend

node server.js

cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\Frontend\Hribovc\frontend\hribovc-website"

npm install

npm install leaflet react-leaflet

npm run dev

ORV

cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\osnove-racunalniskega-vida"
python .\face_name_preview.py train
python .\face_name_preview.py preview
python .\face_name_preview.py login-users ziga

--------------------------------------------

Hribovc je projekt za varnejse nacrtovanje pohodov in vzponov. Zdruzuje spletno aplikacijo, backend z vremenskimi in pohodno-potnimi podatki, modul za prepoznavo obraza ter mobilno aplikacijo za zajem senzorskih podatkov.

Projekt pokriva tri projektne predmete:

- **Razvoj aplikacij za internet**: spletna aplikacija, backend API, MongoDB, scraping vremena in poti.
- **Osnove racunalniskega vida**: prijava oziroma dodatno preverjanje uporabnika s prepoznavo obraza.
- **Namenska programska oprema**: mobilna aplikacija za zajem pospeskomera, GPS lokacije in posiljanje podatkov prek MQTT.

## Kaj potrebujete pred zacetkom

Navodila so napisana za uporabnika brez predznanja. Najlazje je, da vse ukaze zaganjate v programu **PowerShell** na Windows racunalniku.

1. Namestite **Node.js LTS** iz strani <https://nodejs.org>.
2. Namestite **MongoDB Community Server** iz strani <https://www.mongodb.com/try/download/community>.
   - Med namestitvijo pustite oznaceno moznost, da se MongoDB zazene kot Windows Service.
   - Ce je vklopljeno kot storitev, baze ni treba rocno zaganjati.
3. Namestite **Python 3** iz strani <https://www.python.org/downloads/>.
   - Pri namestitvi obvezno oznacite **Add Python to PATH**.
4. Za mobilno aplikacijo namestite aplikacijo **Expo Go** na telefon.
   - Android: Google Play
   - iPhone: App Store

Preverjanje namestitve:

V powershell:
node -v
npm -v
python --version

Ce se pri vsakem ukazu izpise stevilka verzije, je osnovna namestitev pripravljena.

## Mapa projekta

V nadaljevanju predpostavljamo, da je projekt v tej mapi:

V powershell:
C:\Users\"Ziga"\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu

Ce imate projekt drugje, v ukazih zamenjajte pot do mape.

## 1. Razvoj aplikacij za internet

Ta del vsebuje backend in frontend aplikacijo Hribovc. Backend skrbi za uporabnike, prijavo, vremenske podatke, poti, analizo tveganja in povezavo z MongoDB. Frontend prikazuje spletno stran v brskalniku.

### Namestitev backenda

1. Odprite PowerShell.
2. Premaknite se v backend mapo:

V powershell:
cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\backend"

Namestite knjiznice:

V powershell:
npm install

Preverite, da MongoDB tece. Ce ste ga namestili kot Windows Service, ta korak navadno ni potreben.
Zazenite backend:

V powershell:
node server.js

Ce je vse pravilno, se izpise:

Server listening on <http://localhost:3000>

Backend uporablja privzeto bazo:

mongodb://127.0.0.1:27017

in ime baze: hribovc

### Namestitev frontenda

Backend naj ostane odprt v svojem PowerShell oknu. Nato odprite novo PowerShell okno.

Premaknite se v frontend mapo:

V powershell:
cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\Frontend\Hribovc\frontend\hribovc-website"

Namestite knjiznice:

V powershell:
npm install

Zazenite spletno aplikacijo:

V powershell:
npm run dev

V brskalniku odprite naslov, ki ga izpise Vite. Obicajno je:

<http://localhost:5173>

### Primer uporabe 1: registracija in prijava uporabnika

1. V brskalniku odprite `http://localhost:5173`.
2. Pojdite na stran za registracijo.
3. Vnesite ime, email, geslo, starost, visino in tezo.
4. Aplikacija uporabnika shrani v MongoDB in izracuna BMI.
5. Nato se prijavite z istim emailom in geslom.

Ta primer preveri, da delujejo frontend, backend, MongoDB in osnovna avtentikacija.

### Primer uporabe 2: pregled vremena in izbira poti

1. Najprej mora teci backend na `http://localhost:3000`.
2. V spletni aplikaciji odprite stran **Vremenska napoved**.
3. Aplikacija pridobi zadnje vremenske podatke. Ce so podatki prestari ali jih se ni, backend sprozi nov zajem.
4. Odprite stran **Izberi pot**.
5. Uporabite iskalnik ali filtre po tezavnosti in regiji.
6. Primerjajte poti glede na cas hoje, visinsko razliko, dolzino in oceno primernosti.

Ta primer pokaze osnovni namen Hribovca: uporabnik lahko pregleda razmere in se odloci za varnejso pot.

### Uporabni backend naslovi za testiranje

Te naslove lahko odprete v brskalniku, ko backend tece:

<http://localhost:3000/weather>
<http://localhost:3000/scrape>
<http://localhost:3000/stats>

## 2. Osnove racunalniskega vida

Ta del projekta omogoca prepoznavo obraza in preverjanje prijave s kamero. Uporablja Python, OpenCV, NumPy in scikit-learn. Backend uporablja skripto `face_name_preview.py`.

### Namestitev ORV modula

Odprite novo PowerShell okno.
Premaknite se v mapo ORV:

V powershell:
cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\osnove-racunalniskega-vida"

Namestite Python knjiznice:

V powershell:

pip install opencv-python numpy scikit-learn joblib

Preverite, da ima racunalnik delujoco kamero.

### Primer uporabe 1: ucenje modela iz slik

V mapi `osnove-racunalniskega-vida` zazenite:

V powershell:
python .\face_name_preview.py train

Slike naj bodo v podmapah `data\test_images\ImeOsebe`. Program ustvari model v mapi `model_from_test_images`.

Ce zelite iz slik ustvariti tudi uporabniske profile za login:

V powershell:
python .\face_name_preview.py export-users --overwrite

### Primer uporabe 2: prijava z obrazom

1. Po treningu ali izvozu profilov zazenite:

V powershell:
python .\face_name_preview.py login-users ziga

1. Poglejte v kamero.
2. Pritisnite **SPACE** za preverjanje.
3. Program vrne JSON rezultat prijave.

Za navaden predogled imena brez prijave:

V powershell:
python .\face_name_preview.py preview

## 3. Namenska programska oprema

Ta del vsebuje mobilno aplikacijo. Aplikacija prikazuje Hribovc vmesnik, omogoca prijavo prek backenda, zajema podatke pospeskomera in GPS lokacije ter meritve shrani v lokalno zgodovino. Ce je nastavljen MQTT posrednik, podatke posilja tudi na MQTT kanal.

### Namestitev mobilne aplikacije

## Pogoste tezave

### Backend se ne zazene

- Preverite, da je MongoDB namescen in zagnan.
- Preverite, da ste v pravi mapi `razvoj-aplikacij-za-internet\backend`.
- Ponovno namestite knjiznice z `npm install`.

### Frontend ne prikaze podatkov

- Preverite, da backend tece na `http://localhost:3000`.
- Odprite `http://localhost:3000/stats` in preverite, ali backend odgovori.
- Ce je stran prazna, osvezite brskalnik.

### Mobilna aplikacija ne najde streznika

- Telefon in racunalnik morata biti na istem Wi-Fi omrezju.
- V `config.ts` mora biti pravi IP naslov racunalnika.
- Backend mora biti zagnan.
- Windows Firewall lahko vprasa za dovoljenje; izberite **Allow access**.

### Kamera pri ORV ne deluje

- Zaprite druge programe, ki uporabljajo kamero.
- Preverite dovoljenja kamere v Windows nastavitvah.
- Ce imate vec kamer, poskusite z drugim indeksom:

V powershell:
python .\face_name_preview.py preview --camera 1

## Kratek povzetek zagonov

Backend:

cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\backend"
npm install
node server.js

Frontend:

cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\Frontend\Hribovc\frontend\hribovc-website"
npm install
npm run dev

ORV:

cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\osnove-racunalniskega-vida"
pip install opencv-python numpy scikit-learn joblib
python .\face_name_preview.py train
python .\face_name_preview.py preview
