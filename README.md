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

