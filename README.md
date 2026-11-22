# Oskrbovanko 💚

**Skrb se nadaljuje tudi doma.**

Oskrbovanko je digitalna rešitev, ki pomaga spremljati okrevanje pacientov po odpustu iz bolnišnice. Povezuje paciente, njihove svojce in zdravstveno osebje s pomočjo **telefonskih pogovorov v slovenščini**, **meritev življenjskih znakov** in **preglednih spletnih vmesnikov**.

Posebej je prilagojen starejšim, ki pri uporabi tehnologije potrebujejo čim manj zapletov. Pacient lahko o svojem počutju poroča kar prek običajnega telefonskega klica, brez nameščanja aplikacij. Rešitev je namenjena spremljanju okrevanja doma, trenutno predvsem po **očesnih posegih**.

## Kako deluje?

1. **Telefonski pogovor:** Glasovna asistentka pokliče pacienta in ga v slovenščini povpraša o počutju, bolečinah in morebitnih težavah.
2. **Zapis informacij:** Odgovori, prepis pogovora in zaznani opozorilni znaki se shranijo v pacientov zapis.
3. **Merjenje življenjskih znakov:** Arduino senzor meri **srčni utrip** in **nasičenost krvi s kisikom (SpO₂)**. Meritve se pošljejo v podatkovno bazo in prikažejo ob podatkih pacienta.
4. **Pregled okrevanja:** Zdravnik in skrbnik lahko v svojih spletnih pogledih spremljata razpoložljive podatke, zgodovino klicev in morebitna opozorila.

## Za koga je Oskrbovanko?

| Uporabnik              | Kaj mu omogoča?                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **Pacient**            | Preprost pregled informacij o klicih in možnost poročanja o počutju prek običajnega telefonskega klica. |
| **Skrbnik ali svojec** | Vpogled v okrevanje povezanega pacienta, njegove meritve, pogovore in opozorila.                        |
| **Zdravnik**           | Pregled pacientov, prepisov pogovorov, srčnega utripa, SpO₂ in pomembnih opozoril na enem mestu.        |

## Podatki, ki pomagajo pri spremljanju okrevanja

Oskrbovanko združuje **informacije, ki jih pacient poda med telefonskim pogovorom**, in **objektivne meritve Arduino senzorja**. Podatki se shranjujejo v **Supabase PostgreSQL**, aplikacija pa jih prikazuje glede na vlogo prijavljenega uporabnika.

Tako imajo zdravniki lažji pregled nad pacienti, svojci so bolje obveščeni, starejši pa lahko okrevajo v domačem okolju brez zahtevne uporabe tehnologije. Oskrbovanko je podpora spremljanju okrevanja in **ne nadomešča zdravniške obravnave ali nujne medicinske pomoči**.

## Testni računi

Spletno aplikacijo lahko preizkusite z naslednjimi testnimi računi:

| Vloga | E-pošta | Geslo |
| --- | --- | --- |
| Zdravnik | `dr@example.com` | `pass` |
| Skrbnik | `mojca.hrovat@example.com` | `Mojca123!` |
| Pacient | `angelca.hrovat@example.com` | `Angelca123!` |

*Računi so namenjeni izključno testnemu okolju in morajo obstajati v povezani podatkovni bazi.*

## Lokalni zagon

Za zagon potrebujete **Python**, **uv**, **Node.js/npm**, dostop do podatkovne baze in ustrezne okoljske spremenljivke v korenski datoteki `.env`. Datoteke `.env` ne dodajajte v Git.

**Backend:**

```bash
cd backend
uv run --env-file ../.env uvicorn app.main:app --reload --port 8000
```

**Frontend** (v drugem terminalu):

```bash
cd UI
npm install
npm run dev
```

Aplikacija: **http://localhost:8080**  
API dokumentacija: **http://localhost:8000/docs**

Za dejanske telefonske klice so potrebne tudi ustrezno konfigurirane telefonske in govorne storitve ter javno dosegljiv backend.

---

**Oskrbovanko — skrb se nadaljuje tudi doma.**


---

# Oskrbovanko 💚

**Care continues at home.**

Oskrbovanko is a digital solution that supports patients recovering after hospital discharge. It connects patients, their families, and healthcare professionals through **Slovenian-language phone calls**, **vital-sign measurements**, and **clear web dashboards**.

It is designed with older adults in mind, minimizing the need to learn new technology. Patients can report how they feel through a regular phone call, without installing an app. The solution supports recovery at home, currently with a particular focus on **recovery after eye surgery**.

## How it works

1. **Phone check-in:** A voice assistant calls the patient in Slovenian and asks about their well-being, pain, and possible symptoms.
2. **Information is recorded:** Responses, call transcripts, and identified warning signs are stored in the patient's record.
3. **Vital signs are measured:** An Arduino-based sensor measures **heart rate** and **blood oxygen saturation (SpO₂)**. Readings are sent to the database and displayed alongside the patient's information.
4. **Recovery stays visible:** Doctors and caregivers can review available measurements, call history, and alerts in their respective dashboards.

## Who is Oskrbovanko for?

| User | What they can do |
| --- | --- |
| **Patient** | View simple call information and report their well-being using an ordinary phone. |
| **Caregiver or family member** | Follow a linked patient's recovery through measurements, conversations, and alerts. |
| **Doctor** | See patient records, call transcripts, heart rate, SpO₂, and important alerts in one place. |

## Better information for recovery at home

Oskrbovanko combines **information reported during telephone conversations** with **objective measurements from the Arduino sensor**. Data is stored in **Supabase PostgreSQL** and displayed according to each signed-in user's role.

This gives clinicians a clearer overview of their patients, keeps families informed, and lets older adults recover in familiar surroundings without complicated technology. Oskrbovanko supports recovery monitoring but **does not replace medical care or emergency services**.

## Test accounts

The web application can be tested using these testing user accounts:

| Role | Email | Password |
| --- | --- | --- |
| Doctor | `dr@example.com` | `pass` |
| Caregiver | `mojca.hrovat@example.com` | `Mojca123!` |
| Patient | `angelca.hrovat@example.com` | `Angelca123!` |

*These accounts are intended for a test environment only and must exist in the connected database.*

## Run locally

You will need **Python**, **uv**, **Node.js/npm**, database access, and the required environment variables in a root-level `.env` file. Do not commit `.env` to Git.

**Backend:**

```bash
cd backend
uv run --env-file ../.env uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a second terminal):

```bash
cd UI
npm install
npm run dev
```

Application: **http://localhost:8080**  
API documentation: **http://localhost:8000/docs**

Real telephone calls also require configured telephony and voice services and a publicly reachable backend.

---

**Oskrbovanko — care continues at home.**
