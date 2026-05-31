# Načrt podatkovnega modela

## Opis

Aplikacija Hribovc uporablja MongoDB podatkovno bazo za shranjevanje uporabnikov, vremenskih podatkov, planinskih poti in analiz tveganja.

Podatkovni model vključuje samo podatke, ki jih aplikacija trenutno pridobiva, ali podatke, ki jih lahko backend izračuna iz že pridobljenih podatkov.

Projekt uporablja native MongoDB driver, zato so podatkovni modeli definirani kot MongoDB kolekcije in dokumentne strukture, ne kot Mongoose sheme.

---

# 1. Kolekcija `users`

## Namen

Kolekcija `users` hrani podatke o registriranih uporabnikih.

Ti podatki se uporabljajo za:

- registracijo uporabnika,
- prijavo uporabnika,
- prikaz uporabniškega profila,
- izračun BMI,
- izračun stopnje pripravljenosti,
- analizo primernosti planinske poti za uporabnika.

## Vir podatkov

Podatki za uporabnika pridejo iz registracijskega obrazca.

Obrazec pošlje:

```js
{
  ime: String,
  email: String,
  password: String,
  starost: Number,
  visina: Number,
  teza: Number
}
```

Iz teh podatkov lahko backend dodatno izračuna:

```js
{
  bmi: Number,
  fitnessLevel: String
}
```

## Končna struktura dokumenta

```js
{
  _id: ObjectId,

  ime: String,
  email: String,
  passwordHash: String,

  starost: Number,
  visina: Number,
  teza: Number,

  bmi: Number,
  fitnessLevel: String,

  createdAt: Date,
  updatedAt: Date
}
```

## Izračun BMI

```js
bmi = teza / ((visina / 100) ** 2)
```

## Izračun fitnessLevel

```txt
Če starost ali BMI nista znana:
fitnessLevel = unknown

Če je uporabnik starejši od 60 let ali ima BMI 32 ali več:
fitnessLevel = low

Če je uporabnik starejši od 45 let ali ima BMI 28 ali več:
fitnessLevel = medium

V ostalih primerih:
fitnessLevel = high
```


---

# 2. Kolekcija `weather`

## Namen

Kolekcija `weather` hrani vremenske podatke, pridobljene iz ARSO XML virov.

Podatki se uporabljajo za:

- prikaz vremenskih razmer,
- prikaz razmer po višinskih območjih,
- izračun vremenskega tveganja,
- analizo primernosti poti.

## Vir podatkov

Weather scraper pridobi podatke za tri višinska območja:

```txt
dolina
sredogorje
visokogorje
```

Za vsako območje scraper pridobi:

```js
{
  id: String,
  altitude: String,
  location: String,
  temp: String,
  feelsLike: String,
  wind: String,
  windDir: String,
  risk: String,
  riskLabel: String,
  humidity: Number,
  pressure: String,
  visibility: String,
  descTitle: String,
  descSub: String,
  updatedAt: String
}
```

Iz teh podatkov lahko backend dodatno izračuna:

```js
{
  tempValue: Number,
  windValue: Number,
  pressureValue: Number,
  safetyScore: Number,
  overall: {
    risk: String,
    label: String,
    score: Number
  },
  source: String,
  scrapedAt: Date
}
```

## Končna struktura dokumenta

```js
{
  _id: ObjectId,

  stations: [
    {
      id: String,
      altitude: String,
      location: String,

      temp: String,
      tempValue: Number,

      feelsLike: String,

      wind: String,
      windValue: Number,
      windDir: String,

      humidity: Number,

      pressure: String,
      pressureValue: Number,

      visibility: String,

      risk: String,
      riskLabel: String,
      safetyScore: Number,

      descTitle: String,
      descSub: String,

      updatedAt: String
    }
  ],

  overall: {
    risk: String,
    label: String,
    score: Number
  },

  source: String,
  scrapedAt: Date
}
```


## Izračun tempValue

```js
tempValue = parseFloat(temp)
```

Primer:

```txt
"8°C" -> 8
"-4°C" -> -4
```

## Izračun windValue

```js
windValue = parseFloat(wind)
```

Primer:

```txt
"42 km/h" -> 42
```

## Izračun pressureValue

```js
pressureValue = parseFloat(pressure)
```

Primer:

```txt
"750 hPa" -> 750
```

## Izračun safetyScore

```txt
Če risk = low:
safetyScore = 90

Če risk = medium:
safetyScore = 60

Če risk = high:
safetyScore = 30

Če risk = extreme:
safetyScore = 10

Če risk ni znan:
safetyScore = 50
```

## Izračun overall

```txt
Če ima katerakoli postaja risk = extreme:
overall.risk = extreme
overall.label = Zelo nevarno
overall.score = 10

Če ima katerakoli postaja risk = high:
overall.risk = high
overall.label = Nevarno
overall.score = 30

Če ima katerakoli postaja risk = medium:
overall.risk = medium
overall.label = Previdno
overall.score = 60

Če imajo vse postaje risk = low:
overall.risk = low
overall.label = Varno
overall.score = 90
```

---

# 3. Kolekcija `trails`

## Namen

Kolekcija `trails` hrani podatke o planinskih poteh.

Podatki se uporabljajo za:

- prikaz seznama poti,
- prikaz osnovnih informacij o poti,
- filtriranje poti po regiji,
- filtriranje poti po težavnosti,
- analizo primernosti poti za uporabnika.

## Vir podatkov

Trail scraper pridobi podatke o planinskih poteh.

Za vsako pot scraper pridobi:

```js
{
  name: String,
  url: String,
  region: String,
  mountain: String,
  duration: String,
  difficulty: String,
  elevation: String,
  distance: String,
  scrapedAt: Date
}
```

Iz teh podatkov lahko backend dodatno izračuna:

```js
{
  difficultyScore: Number,
  elevationM: Number,
  distanceKm: Number,
  source: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Končna struktura dokumenta

```js
{
  _id: ObjectId,

  name: String,
  url: String,

  region: String,
  mountain: String,

  duration: String,

  difficulty: String,
  difficultyScore: Number,

  elevation: String,
  elevationM: Number,

  distance: String,
  distanceKm: Number,

  source: String,

  scrapedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```


## Izračun elevationM

```js
elevationM = parseInt(elevation.replace(/[^\d]/g, ''), 10)
```

Primer:

```txt
"1500 m" -> 1500
"1500" -> 1500
```

## Izračun distanceKm

```js
distanceKm = parseFloat(distance.replace(',', '.'))
```

Primer:

```txt
"12 km" -> 12
"12,5" -> 12.5
"12.5" -> 12.5
```

---

# 4. Kolekcija `riskAnalyses`

## Namen

Kolekcija `riskAnalyses` hrani rezultate analize tveganja za posameznega uporabnika in izbrano planinsko pot.

Analiza poveže:

- podatke o uporabniku,
- podatke o poti,
- zadnje vremenske podatke.

Rezultat analize je priporočilo, ali je pot primerna za uporabnika.

## Vir podatkov

Analiza uporablja podatke iz obstoječih kolekcij:

```txt
users
weather
trails
```

Iz uporabnika se uporabijo:

```js
{
  starost: Number,
  bmi: Number,
  fitnessLevel: String
}
```

Iz poti se uporabijo:

```js
{
  name: String,
  difficulty: String,
  difficultyScore: Number,
  elevationM: Number,
  distanceKm: Number
}
```

Iz vremena se uporabijo:

```js
{
  overall: {
    risk: String,
    label: String,
    score: Number
  }
}
```

Backend lahko iz teh podatkov izračuna:

```js
{
  finalScore: Number,
  recommendation: String,
  reason: String
}
```



## Izračun finalScore

```txt
Backend izračuna finalScore iz:
- uporabnikove pripravljenosti,
- težavnosti poti,
- vremenskega tveganja.

Višji finalScore pomeni bolj primerno pot.
Nižji finalScore pomeni večje tveganje.
```

## Izračun recommendation

```txt
Če je finalScore manjši od 35:
recommendation = ODSVETOVANO

Če je finalScore med 35 in 64:
recommendation = PREVIDNO

Če je finalScore 65 ali več:
recommendation = PRIPOROČENO
```
---

# 5. Povezave med kolekcijami

```txt
users
  └── riskAnalyses
        ├── trails
        └── weather
```

## Razlaga povezav

```txt
En uporabnik ima lahko več analiz tveganja.

Ena analiza tveganja se nanaša na enega uporabnika.

Ena analiza tveganja se nanaša na eno planinsko pot.

Ena analiza tveganja uporablja en vremenski zapis.

Ena planinska pot se lahko uporabi v več analizah.

En vremenski zapis se lahko uporabi v več analizah.

Vremenski podatki se shranjujejo kot zgodovina zajemov, zato se analiza veže na vremenski zapis, ki je bil uporabljen v času izračuna.
```

---

# 6. MongoDB indexi

## Kolekcija `users`

```js
{
  email: 1
}
```

Index na `email` je unikaten.

```txt
Prepreči registracijo več uporabnikov z istim email naslovom.
Omogoča hitrejše iskanje uporabnika pri prijavi.
```

## Kolekcija `weather`

```js
{
  scrapedAt: -1
}
```

```txt
Omogoča hitro pridobivanje zadnjega vremenskega zapisa.
```

## Kolekcija `trails`

```js
{
  url: 1
}
```

Index na `url` je unikaten.


```txt
Prepreči podvajanje poti pri večkratnem zagonu scraperja.
```

```js
{
  region: 1
}
```


```txt
Omogoča filtriranje poti po regiji.
```

```js
{
  difficulty: 1
}
```


```txt
Omogoča filtriranje poti po težavnosti.
```

## Kolekcija `riskAnalyses`

```js
{
  userId: 1
}
```

```txt
Omogoča pridobivanje analiz za posameznega uporabnika.
```

```js
{
  trailId: 1
}
```


```txt
Omogoča pridobivanje analiz za posamezno pot.
```

```js
{
  createdAt: -1
}
```


```txt
Omogoča sortiranje analiz po času izvedbe.
```

---

# 7. Tok podatkov v aplikaciji

## Potek za uporabnika

```txt
Registracijski obrazec
  -> backend prejme ime, email, geslo, starost, višino in težo
  -> backend izračuna BMI in fitnessLevel
  -> backend shrani uporabnika v kolekcijo users
```

## Potek za vreme

```txt
ARSO XML podatki
  -> weather scraper
  -> backend normalizira vremenske podatke
  -> backend izračuna numeric vrednosti in overall risk
  -> backend shrani dokument v kolekcijo weather
  -> frontend pridobi zadnje vreme prek API-ja
```

## Potek za planinske poti

```txt
Podatki o planinskih poteh
  -> trail scraper
  -> backend normalizira podatke o poti
  -> backend izračuna difficultyScore, elevationM in distanceKm
  -> backend shrani pot v kolekcijo trails
  -> frontend pridobi poti prek API-ja
```

## Potek za analizo tveganja

```txt
Uporabnik izbere pot
  -> backend pridobi uporabnika
  -> backend pridobi izbrano pot
  -> backend pridobi zadnje vremenske podatke
  -> backend izračuna finalScore
  -> backend določi recommendation
  -> backend shrani analizo v riskAnalyses
  -> frontend prikaže priporočilo
```

---
# 8. Backend endpoint za vizualizacijo podatkov

Za potrebe spletnega vmesnika za vizualizacijo podatkov je dodan backend endpoint:

```txt
GET /visualization-data
```

## Namen

Endpoint pripravi podatke iz MongoDB baze v obliki, ki jo lahko frontend uporabi za grafe, statistične kartice ali dashboard.

Endpoint ne shranjuje novih podatkov, ampak bere obstoječe podatke iz baze in jih agregira.

Uporablja se za prikaz:

- osnovnih statistik baze,
- števila poti po regijah,
- števila poti po težavnosti,
- analiz tveganja po priporočilih,
- analiz tveganja po tipu,
- zadnjih vremenskih podatkov,
- zadnjih senzorskih podatkov, če obstajajo.

## Request

```txt
GET http://localhost:3000/visualization-data
```

## Podatki, ki jih endpoint uporablja

Endpoint bere podatke iz kolekcij:

```txt
users
weather
trails
riskAnalyses
mobileSensorReadings
```

## Struktura responsa

```js
{
  stats: {
    usersCount: Number,
    weatherCount: Number,
    trailsCount: Number,
    riskAnalysesCount: Number,
    sensorReadingsCount: Number,
    lastWeatherScrape: Date
  },

  trailsByRegion: [
    {
      region: String,
      count: Number
    }
  ],

  trailsByDifficulty: [
    {
      difficulty: String,
      count: Number
    }
  ],

  riskAnalysesByRecommendation: [
    {
      recommendation: String,
      count: Number
    }
  ],

  riskAnalysesByType: [
    {
      type: String,
      count: Number
    }
  ],

  latestWeatherRisk: [
    {
      risk: String,
      riskLabel: String,
      count: Number
    }
  ],

  latestWeather: Object,

  latestSensorReadings: Array
}
```

## Primer responsa

```json
{
  "stats": {
    "usersCount": 1,
    "weatherCount": 5,
    "trailsCount": 50,
    "riskAnalysesCount": 20,
    "sensorReadingsCount": 10,
    "lastWeatherScrape": "2026-05-31T20:00:00.000Z"
  },
  "trailsByRegion": [
    {
      "region": "Julijske Alpe",
      "count": 20
    }
  ],
  "trailsByDifficulty": [
    {
      "difficulty": "zahtevna",
      "count": 12
    }
  ],
  "riskAnalysesByRecommendation": [
    {
      "recommendation": "PREVIDNO",
      "count": 8
    }
  ],
  "riskAnalysesByType": [
    {
      "type": "trailRisk",
      "count": 20
    }
  ],
  "latestWeatherRisk": [
    {
      "risk": "medium",
      "riskLabel": "Previdno",
      "count": 2
    }
  ],
  "latestWeather": {},
  "latestSensorReadings": []
}
```

## Razlaga

Endpoint `/visualization-data` je namenjen predvsem frontendu.

Namesto da frontend sam računa podatke za grafe, backend pripravi agregirane podatke direktno iz MongoDB baze.

Primeri uporabe na frontendu:

```txt
trailsByRegion
  -> graf poti po regijah

trailsByDifficulty
  -> graf poti po težavnosti

riskAnalysesByRecommendation
  -> graf priporočil PRIPOROČENO / PREVIDNO / ODSVETOVANO

latestWeatherRisk
  -> prikaz trenutnega vremenskega tveganja

stats
  -> statistične kartice na dashboardu
```

---

# 9. Povezava z zahtevami za vizualizacijo


## Backend podpora

Backend za to zahtevo pripravi endpoint:

```txt
GET /visualization-data
```

Ta endpoint omogoča branje in agregacijo podatkov iz MongoDB baze.

Frontend lahko te podatke uporabi za:

- prikaz statistik,
- prikaz grafov,
- prikaz vremenskih tveganj,
- prikaz analiz tveganja,
- prikaz senzorskih podatkov.

