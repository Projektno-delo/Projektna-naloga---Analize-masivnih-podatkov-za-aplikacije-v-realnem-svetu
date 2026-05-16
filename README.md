# Ideja: **Hribovc** inteligentni načrtovalec varnih in zdravih vzponov

Spletna stran Hribovc se osredotoča na nekaj, kar je nam Slovencem res blizu in sicer hribi. Cilj je združiti pohodništvo z realnimi podatki in pametno analizo, ki uporabniku pomaga pri varnem in zdravem odločanju v gorah.

Uporabljali bomo web scraping za vreme po višinah

---

## 1. Načrtovanje: idejni koncept

Spletna stran glede na uporabnikovo starost in BMI uvrsti v stopnje sposobnosti in mu priporoči primerne poti, pri odločitvi odsvetuje pot če vreme ni primerno
(https://github.com/zejn/arsoapi)

---

## 2. Podatki in viri

### Web scraping

**ARSO (https://github.com/zejn/arsoapi)**

- podatki: temperatura, hitrost vetra, verjetnost neviht po višinah  
- uporaba: napoved tveganja glede na lokacijo uporabnika  

---

## 3. Kako bomo implementirali scraping

Scraping bo implementiran kot ločen backend modul v Node.js.

**Tehnologije:**

- axios za pridobivanje HTML strani  
- cheerio za parsanje HTML (DOM manipulacija kot jQuery)

**Postopek:**

1. Periodično pošiljanje HTTP zahtevkov na izbrane strani.
2. Parsanje HTML strukture in ekstrakcija relevantnih podatkov.
3. Čiščenje in normalizacija podatkov
4. Shranjevanje v podatkovno bazo MongoDB
5. Izpostavitev podatkov preko REST API-ja frontend aplikaciji.

**Primer:**

- ARSO: iz strukturiranih tabel ali JSON endpointov pridobimo vremenske napovedi

---

## 4. Rezultati obdelave

**Indeks pripravljenosti**  
Ocena, ali je uporabnik sposoben varno doseči pot (tudi glede višinske razlike poti).

**Vremenska opozorila**  
Samodejna obvestila ob poslabšanju vremena glede na GPS lokacijo z uporabo .alert().

**Vizualizacija**

- prikaz poti na OpenStreetMaps  
- barvne oznake težavnosti in nevarnosti  
- grafi utrujenosti  

---

## 5. Razdelitev dela

| Član | Vloga | Ključne odgovornosti |
|------|------|----------------------|
|  Žiga Pešti | Web scraping | razvoj scraperjev ARSO, ekstrakcija podatkov |
| Anže Žunec  | Backend | API, baza podatkov, integracija |
| Anja Grudnik| Frontend| UI, zemljevidi, grafi |

---

## 6. Uporaba in zagon scraperja

---BACKEND---

cd C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\backend

node server.js

----;

---FRONTEND---

cd "C:\Users\Ziga\Desktop\Projektna-naloga---Analize-masivnih-podatkov-za-aplikacije-v-realnem-svetu\razvoj-aplikacij-za-internet\Frontend\Hribovc\frontend\hribovc-website"

npm install

npm install leaflet react-leaflet

npm run dev

----;

## 7. ORV 2FA face login

To register your face:

python .\detect-face.py register ziga
A camera window opens. Look at the camera and press SPACE several times until it captures enough samples. Press q to quit.

Then test login:

python .\detect-face.py login ziga
Again, look at the camera and press SPACE to verify. It will print LOGIN DOVOLJEN or LOGIN ZAVRNJEN.

To process existing raw images:

python .\detect-face.py preprocess
