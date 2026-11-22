# Oskrbovanko 💚

**Skrb se nadaljuje tudi doma.**

Oskrbovanko povezuje paciente, svojce in zdravstveno osebje tudi po odpustu iz bolnišnice. Z rednimi **telefonskimi pogovori v slovenščini**, merjenjem življenjskih znakov in preglednim spletnim portalom pomaga spremljati okrevanje doma ter pravočasno opozoriti na morebitne zaplete.

Rešitev je namenjena predvsem **starejšim pacientom po operaciji sive mrene oziroma drugih očesnih posegih**. Ker mnogi niso vešči uporabe pametnih telefonov, lahko svoje počutje sporočijo kar med običajnim telefonskim klicem — **brez nameščanja aplikacije**.

## Kako deluje?

1. **Zdravnik sproži klic.** Prek spletnega portala izbere pacienta in sproži telefonski pogovor.
2. **Glasovna asistentka preveri počutje.** Pacienta v počasni, razumljivi slovenščini vodi skozi vnaprej pripravljena vprašanja o okrevanju, bolečinah in morebitnih težavah. Odgovori se pretvorijo v besedilo.
3. **Pacient opravi meritev.** Preprosta senzorska naprava z **ESP32 in MAX30102** izmeri srčni utrip in nasičenost krvi s kisikom (**SpO₂**). Barvna LED-lučka pomaga pokazati potek oziroma uspešnost meritve.
4. **Podatki se združijo.** Odgovori in meritve se povežejo s pacientom in klicem ter se prikažejo v spletnem portalu.
5. **Ob opozorilnih znakih sistem ukrepa.** Pravila preverijo izbrane odgovore in vitalne znake. Ob kritični oceni sistem obvesti zdravnika po e-pošti ter telefonsko opozori povezane skrbnike.

## Za paciente, skrbnike in zdravnike

| Uporabnik | Kaj mu Oskrbovanko omogoča? |
| --- | --- |
| **Pacient** | Spremljanje okrevanja prek običajnega telefona, brez zahtevne aplikacije; preprost spletni pogled na informacije o klicih. |
| **Skrbnik ali svojec** | Pregled počutja povezanega pacienta, meritev, zgodovine pogovorov in pomembnih opozoril. Skrbnik je lahko družinski član ali patronažna sestra. |
| **Zdravnik** | Pregled pacientov, njihovih odgovorov, prepisov (ob soglasju), meritev in opozoril na enem mestu ter možnost sprožitve klica. |

Oskrbovanko želi zmanjšati potrebo po rutinskih preverjanjih po telefonu, zdravstvenemu osebju olajšati pregled nad okrevanjem in svojcem dati več informacij, ne da bi moral pacient obvladati novo tehnologijo.

## Podatki in opozorila

Za telefonske pogovore sistem uporablja **Twilio** (klici in prepoznavanje govora), za slovensko govorno sintezo pa **Azure**. Strežnik **FastAPI** shrani vprašanja, prepoznane odgovore, oznake tveganja in meritve v **Supabase PostgreSQL**. Prepis pogovora se hrani ob pacientovem soglasju.

Senzorska naprava prek **HTTPS** pošlje srčni utrip in SpO₂, meritve pa se povežejo z ustreznim pacientom oziroma klicem. Oceno kritičnosti določajo **pravila v programski kodi**, ki upoštevajo odgovore in izmerjene vrednosti, ne samostojna presoja jezikovnega modela. Ob zaznanem kritičnem stanju se sprožijo obvestila zdravniku in skrbniku.

Prikazani podatki so namenjeni podpori spremljanju okrevanja. **Oskrbovanko ne nadomešča zdravniške obravnave ali nujne medicinske pomoči.**

## Nadaljnji razvoj

V prihodnje želimo omogočiti bolj naraven, prilagodljiv pogovor: vprašanja bi nastajala tudi na podlagi preverjenih slovenskih zdravstvenih virov in pacientovih izvidov, **pred uporabo pa bi jih pregledal strokovnjak**. Načrtujemo še dodatne meritve (npr. temperaturo in krvni tlak) ter možnost, da pacient prek povezave na telefonu **označi mesto bolečine na telesu** ali pošlje fotografijo rane. Trenutno je rešitev namenjena samo pacientom po operaciji sive mrene, vendar bi v prihodnje rešitev posplošili na širše področje operacij. Te funkcionalnosti so načrtovane nadgradnje, ne del trenutno opisanega osnovnega poteka.

## Testni računi

| Vloga | E-pošta | Geslo |
| --- | --- | --- |
| Zdravnik | `dr@example.com` | `pass` |
| Skrbnik | `mojca.hrovat@example.com` | `Mojca123!` |
| Pacient | `angelca.hrovat@example.com` | `Angelca123!` |

*Računi so namenjeni izključno izoliranemu testnemu okolju in morajo obstajati v povezani podatkovni bazi. Gesel ne uporabljajte v produkciji.*

## Lokalni zagon

Potrebujete **Python**, **uv**, **Node.js/npm**, dostop do podatkovne baze in ustrezno nastavljeno korensko datoteko `.env`. Datoteke `.env` ne dodajajte v Git.

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

- Aplikacija: **http://localhost:8080**
- Dokumentacija API: **http://localhost:8000/docs**

Za dejanske telefonske klice potrebujete ustrezno konfigurirane zunanje govorne in telefonske storitve ter javno dosegljiv backend (npr. prek tunela). Med aktivnim klicem se izogibajte ponovnemu zagonu backenda.

---

**Oskrbovanko — skrb se nadaljuje tudi doma.**

---

# Oskrbovanko 💚

**Care continues at home.**

Oskrbovanko connects patients, families, and healthcare professionals after hospital discharge. Through **phone conversations in Slovenian**, vital-sign measurements, and easy-to-read web dashboards, it helps monitor recovery at home and identify potential complications early.

The solution is designed primarily for **older adults recovering from cataract surgery and other eye procedures**. Because many patients are not comfortable with smartphone apps, they can report how they feel during an ordinary telephone call — **without installing an app**.

## How it works

1. **The doctor starts a call.** A healthcare professional selects a patient and initiates a call from the web portal.
2. **A voice assistant checks on recovery.** Speaking slowly and clearly in Slovenian, it asks a predefined set of questions about well-being, pain, and possible symptoms. Spoken responses are converted to text.
3. **The patient takes a measurement.** A simple sensor device built with an **ESP32 and MAX30102** measures heart rate and blood oxygen saturation (**SpO₂**). An RGB LED provides feedback on the measurement process.
4. **The information comes together.** Answers and measurements are associated with the patient and call and made available through the portal.
5. **Important warning signs trigger action.** Rule-based checks assess selected responses and vital signs. If a call is classified as critical, the system emails the doctor and places an alert call to linked caregivers.

## For patients, caregivers, and doctors

| User | What Oskrbovanko offers |
| --- | --- |
| **Patient** | Recovery check-ins using a regular telephone, without a complicated app, plus a simple web view of call information. |
| **Caregiver or family member** | Access to a linked patient's status, measurements, call history, and relevant alerts. A caregiver may be a relative or community nurse. |
| **Doctor** | One place to review patients, their answers, call transcripts (with consent), measurements, and alerts — and to initiate check-in calls. |

Oskrbovanko aims to reduce routine follow-up calls, make recovery information easier for healthcare teams to review, and keep family members informed without putting additional technical demands on patients.

## Data and alerts

The calling workflow uses **Twilio** for telephone calls and speech recognition, and **Azure** for Slovenian speech synthesis. A **FastAPI** backend stores questions, recognized answers, risk flags, and measurements in **Supabase PostgreSQL**. Call transcripts are retained when the patient has given consent.

The sensor device sends heart-rate and SpO₂ measurements over **HTTPS**; readings are linked to the corresponding patient and, where applicable, the call. **Rules implemented in code**, rather than independent decisions made by a language model, assess severity using the recorded responses and measured values. Critical cases trigger notifications to the doctor and linked caregivers.

These records support recovery monitoring. **Oskrbovanko does not replace medical assessment or emergency care.**

## What's next

Future development will focus on more natural, adaptive conversations. Questions could draw on trusted Slovenian healthcare sources and patient records, **with a qualified professional reviewing them before use**. Other planned improvements include additional vital-sign measurements (such as temperature and blood pressure), a smartphone link for **marking pain on a body map**, and an option to upload a wound photo. Currently, the solution is designed exclusively for patients recovering from cataract surgery, but in the future, we plan to expand it to support recovery from a wider range of surgical procedures. These are future enhancements, not features claimed as part of the current core workflow.

## Test accounts

| Role | Email | Password |
| --- | --- | --- |
| Doctor | `dr@example.com` | `pass` |
| Caregiver | `mojca.hrovat@example.com` | `Mojca123!` |
| Patient | `angelca.hrovat@example.com` | `Angelca123!` |

*These accounts are for an isolated test environment only and must exist in the connected database. Do not reuse these passwords in production.*

## Run locally

You will need **Python**, **uv**, **Node.js/npm**, database access, and the required environment variables in a root-level `.env` file. Do not commit `.env` to Git.

**Backend:**

```bash
cd backend
uv run --env-file ../.env uvicorn app.main:app --reload --port 8000
```

**Frontend** (in another terminal):

```bash
cd UI
npm install
npm run dev
```

- App: **http://localhost:8080**
- API documentation: **http://localhost:8000/docs**

Real telephone calls additionally require configured external voice and telephony services and a publicly reachable backend (for example, through a tunnel). Avoid restarting the backend during an active call.

---

**Oskrbovanko — care continues at home.**
