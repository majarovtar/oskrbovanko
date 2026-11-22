import type { ClinicalDataset, Severity } from "./models";

export const DEMO_GUARDIAN_ID = "demo-guardian";
export const DEMO_DOCTOR_ID = "demo-doctor";
const start = "2026-11-16T00:00:00+01:00";
const timestamp = (day: number, time: string) => `2026-11-${day}T${time}:00+01:00`;
const after = (at: string, seconds: number) => new Date(Date.parse(at) + seconds * 1000).toISOString();

type Exchange = {
  ai: string; patient: string;
  symptom?: { key: string; name: string; description: string; score?: number };
};
type Session = {
  id: string; patientId: "p1" | "p2"; day: number; time: string;
  exchanges: Exchange[]; summary: string; wellbeing: string[]; questions?: string[];
  readings?: { pulse: number; spo2: number }; attempts?: number; missed?: boolean;
};

// Each session is its own fictional conversation, not a reusable question template.
const sessions: Session[] = [
  { id: "m16", patientId: "p1", day: 16, time: "10:00", summary: "Marija poroča o blagem nelagodju v desnem očesu po posegu. Kapljice je uporabila po navodilih.", wellbeing: ["Počiva doma"], readings: { pulse: 72, spo2: 97 }, exchanges: [
    { ai: "Dober dan, Marija. Kako ste preživeli prvo jutro doma?", patient: "Počivam. Desno oko me malo boli, na lestvici od 0 do 10 bi rekla 3.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Blaga bolečina v desnem očesu", score: 3 } },
    { ai: "Ste danes že uporabili predpisane kapljice?", patient: "Da, po navodilih iz ambulante." },
  ] },
  { id: "m17", patientId: "p1", day: 17, time: "10:01", summary: "Marija poroča o blažji bolečini kot ob prejšnjem pogovoru. Ponoči se je večkrat zbudila.", wellbeing: ["Prekinjen spanec"], readings: { pulse: 71, spo2: 97 }, exchanges: [
    { ai: "Marija, kaj je danes drugače kot ob zadnjem pogovoru?", patient: "Oko me manj boli. Na lestvici od 0 do 10 je danes 2.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Manj bolečin kot ob prejšnjem pogovoru", score: 2 } },
    { ai: "Kako ste spali?", patient: "Večkrat sem se zbudila, danes sem malo utrujena.", symptom: { key: "fatigue", name: "Utrujenost", description: "Utrujenost po prekinjenem spancu" } },
    { ai: "Kaj ste počeli po zajtrku?", patient: "Sedela sem na terasi in počivala." },
  ] },
  { id: "c1", patientId: "p1", day: 18, time: "10:00", summary: "Marija se na štiri poskuse klica ni odzvala. Za ta dan ni pogovora ali meritev.", wellbeing: [], attempts: 4, missed: true, exchanges: [] },
  { id: "c2", patientId: "p1", day: 19, time: "11:04", summary: "Marija je odgovorila na tretji poskus. Poroča o blagi bolečini in pozabljenih jutranjih kapljicah.", wellbeing: ["Mirna"], readings: { pulse: 70, spo2: 97 }, attempts: 3, exchanges: [
    { ai: "Včeraj vas nismo priklicali. Kako se počutite danes?", patient: "Včeraj sem bila pri hčerki. Danes sem v redu." },
    { ai: "Kaj čutite v desnem očesu?", patient: "Le malo boli, na lestvici od 0 do 10 je 2.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Blaga bolečina", score: 2 } },
    { ai: "Kako je šlo z jutranjimi kapljicami?", patient: "Danes zjutraj sem jih pozabila." },
  ] },
  { id: "c3", patientId: "p1", day: 20, time: "10:01", summary: "Marija poroča o blagi bolečini, uporabi kapljic in kratkem sprehodu. Zanima jo, kdaj lahko spet vozi.", wellbeing: ["Opravila kratek sprehod"], questions: ["Kdaj lahko spet vozim?"], readings: { pulse: 74, spo2: 96 }, exchanges: [
    { ai: "Kako je danes z desnim očesom?", patient: "Še malo boli, na lestvici od 0 do 10 bi rekla 2.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Blaga bolečina", score: 2 } },
    { ai: "Ste kapljice danes uporabili?", patient: "Da, zjutraj po navodilih." },
    { ai: "Kako ste preživeli dopoldne?", patient: "Šla sem na kratek sprehod." },
    { ai: "Imate vprašanje za zdravnika?", patient: "Kdaj lahko spet vozim?" },
  ] },
  { id: "c4", patientId: "p1", day: 21, time: "10:02", summary: "Marija poroča o izrazitejši bolečini v desnem očesu (7/10), slabosti in slabem spancu. Demo meritev SpO₂ je 89 %, utrip 104 utr/min. Simulirani opozorili čakata na pregled.", wellbeing: ["Slabo spala", "Zaskrbljena"], questions: ["Ali naj pridem danes v ambulanto?"], readings: { pulse: 104, spo2: 89 }, exchanges: [
    { ai: "Marija, kako se počutite danes?", patient: "Ne preveč dobro. Oko me bolj boli kot včeraj." },
    { ai: "Kako močna je bolečina na lestvici od 0 do 10?", patient: "Bolečina v desnem očesu je 7 na lestvici od 0 do 10.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Močnejša bolečina kot ob prejšnjem pogovoru", score: 7 } },
    { ai: "Ste ob tem opazili še kaj?", patient: "Malo mi je slabo, nisem pa bruhala.", symptom: { key: "nausea", name: "Slabost", description: "Slabost brez poročanja o bruhanju" } },
    { ai: "Kako ste ponoči spali?", patient: "Slabo sem spala in sem zaskrbljena." },
    { ai: "Kaj želite vprašati ambulanto?", patient: "Ali naj pridem danes v ambulanto?" },
  ] },
  { id: "f16", patientId: "p2", day: 16, time: "09:30", summary: "Franc poroča o blagi bolečini v levem očesu in počitku doma.", wellbeing: ["Počiva doma"], readings: { pulse: 69, spo2: 98 }, exchanges: [
    { ai: "Franc, kako poteka okrevanje doma?", patient: "Levo oko malo boli, na lestvici od 0 do 10 je 2.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Blaga bolečina v levem očesu", score: 2 } },
    { ai: "Vam kdo pomaga pri kapljicah?", patient: "Mojca mi pomaga, kadar jo potrebujem." },
  ] },
  { id: "f17", patientId: "p2", day: 17, time: "09:31", summary: "Franc poroča o manjši bolečini in občasnem solzenju levega očesa.", wellbeing: ["Dobro razpoložen"], readings: { pulse: 68, spo2: 98 }, exchanges: [
    { ai: "Je danes v očesu drugačen občutek?", patient: "Manj boli, na lestvici od 0 do 10 je 1.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Manj bolečin", score: 1 } },
    { ai: "Ste opazili še kaj v levem očesu?", patient: "Občasno se mi solzi.", symptom: { key: "tearing", name: "Solzenje", description: "Občasno solzenje" } },
    { ai: "Kdaj ste opazili solzenje?", patient: "Zjutraj, ko sem odprl okno." },
  ] },
  { id: "f18", patientId: "p2", day: 18, time: "09:30", summary: "Franc poroča, da ga levo oko ne boli. Obiskali so ga vnuki.", wellbeing: ["Vesel obiska vnukov"], readings: { pulse: 67, spo2: 98 }, exchanges: [
    { ai: "Franc, kako je z bolečino danes?", patient: "Danes me ne boli, na lestvici od 0 do 10 je 0.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Izrecno poroča, da bolečine ni", score: 0 } },
    { ai: "Kako se sicer počutite?", patient: "Dobro, vnuki so bili pri meni." },
  ] },
  { id: "f19", patientId: "p2", day: 19, time: "09:30", summary: "Franc se ni odzval na dva poskusa klica. Pogovor in meritve niso na voljo.", wellbeing: [], missed: true, attempts: 2, exchanges: [] },
  { id: "f20", patientId: "p2", day: 20, time: "09:32", summary: "Franc je včeraj obiskal sorodnike. Danes poroča o blagi rdečini brez izcedka. Bolečina ni bila ocenjena.", wellbeing: ["Mirno jutro"], readings: { pulse: 68, spo2: 98 }, exchanges: [
    { ai: "Včeraj vas nismo dosegli. Kako ste?", patient: "Bil sem pri sorodnikih, danes sem doma." },
    { ai: "Ste v očesu opazili kaj novega?", patient: "Levo oko je malo rdeče, izcedka ni.", symptom: { key: "redness", name: "Rdečina očesa", description: "Blaga rdečina brez izcedka" } },
    { ai: "Kdaj ste opazili rdečino?", patient: "Danes zjutraj." },
  ] },
  { id: "c5", patientId: "p2", day: 21, time: "09:31", summary: "Franc se počuti dobro. Poroča o nespremenjeni blagi rdečini levega očesa brez izcedka in brez bolečine.", wellbeing: ["Zgovoren", "Veseli se obiska vnukov"], readings: { pulse: 68, spo2: 98 }, exchanges: [
    { ai: "Franc, kako se danes počutite?", patient: "Dobro, popoldne pridejo vnuki." },
    { ai: "Kaj je drugače pri včerajšnji rdečini?", patient: "Še vedno je malo rdeče, enako kot včeraj. Izcedka ni.", symptom: { key: "redness", name: "Rdečina očesa", description: "Nespremenjena blaga rdečina" } },
    { ai: "Je prisotna tudi bolečina?", patient: "Ne boli, na lestvici od 0 do 10 je 0.", symptom: { key: "eye_pain", name: "Bolečina v očesu", description: "Izrecno poroča, da bolečine ni", score: 0 } },
  ] },
];

/** Builds a fresh deterministic fixture: no random IDs, runtime clock, network, or mutable singleton. */
export function createDemoDataset(): ClinicalDataset {
  const data: ClinicalDataset = {
    patients: [
      { id: "p1", name: "Marija Novak", phone: "+386 41 234 567", clinicalContext: "Okrevanje po operaciji sive mrene · desno oko", clinicContact: "Petra Kos, medicinska sestra", recordingConsent: true, provenance: "fictional_demo" },
      { id: "p2", name: "Franc Kranjc", phone: "+386 31 555 120", clinicalContext: "Okrevanje po operaciji sive mrene · levo oko", clinicContact: "Petra Kos, medicinska sestra", recordingConsent: false, provenance: "fictional_demo" },
    ],
    relationships: [
      { id: "rel-m-doctor", patientId: "p1", userId: DEMO_DOCTOR_ID, role: "doctor", contactName: "dr. Janez Horvat", validFrom: start, validUntil: null },
      { id: "rel-f-doctor", patientId: "p2", userId: DEMO_DOCTOR_ID, role: "doctor", contactName: "dr. Janez Horvat", validFrom: start, validUntil: null },
      { id: "rel-m-guardian", patientId: "p1", userId: DEMO_GUARDIAN_ID, role: "guardian", contactName: "Ana Novak (hčerka)", validFrom: start, validUntil: null },
      { id: "rel-f-guardian", patientId: "p2", userId: DEMO_GUARDIAN_ID, role: "guardian", contactName: "Mojca Zupan (patronažna sestra)", validFrom: start, validUntil: null },
      { id: "rel-m-self", patientId: "p1", userId: "demo-marija", role: "patient", contactName: "Marija Novak", validFrom: start, validUntil: null },
      { id: "rel-f-self", patientId: "p2", userId: "demo-franc", role: "patient", contactName: "Franc Kranjc", validFrom: start, validUntil: null },
    ],
    plans: ["p1", "p2"].map((patientId) => ({
      id: `plan-${patientId}`, patientId, clinicianUserId: DEMO_DOCTOR_ID, startsAt: start, endsAt: null,
      goals: ["Spremljanje bolnikovih poročil o okrevanju", "Upoštevanje individualnih navodil ambulante"],
      schedule: { localTime: patientId === "p1" ? "10:00" : "09:30", timeZone: "Europe/Ljubljana", frequency: "daily" },
      availableMeasurements: ["pulse", "spo2"],
      // Fictional clinician-configured criteria for this demo, not universal medical limits.
      safetyCriteria: [
        { id: `rule-${patientId}-spo2`, metric: "spo2", operator: "lt", threshold: 92, unit: "%", severity: "critical" },
        { id: `rule-${patientId}-pain`, metric: "eye_pain", operator: "gte", threshold: 7, unit: "0–10", severity: "critical" },
      ],
    })),
    calls: [], attempts: [], turns: [], summaries: [], observations: [], measurements: [], alerts: [], notifications: [], notes: [], reviews: [],
  };
  for (const session of sessions) {
    const scheduledAt = timestamp(session.day, session.patientId === "p1" ? "10:00" : "09:30");
    const startedAt = timestamp(session.day, session.time);
    const exchanges = [...session.exchanges];
    if (session.readings) exchanges.push({ ai: "Prosimo, preberite vrednosti z merilnika.", patient: `Merilnik kaže utrip ${session.readings.pulse} utr/min in kisik ${session.readings.spo2} %.` });
    if (!session.missed) exchanges.push({ ai: "Hvala za pogovor. Nasvidenje.", patient: "Hvala, nasvidenje." });
    const duration = exchanges.length * 35;
    const endedAt = after(startedAt, duration);
    data.calls.push({ id: session.id, patientId: session.patientId, planId: `plan-${session.patientId}`, scheduledAt, startedAt: session.missed ? null : startedAt, endedAt: session.missed ? null : endedAt, status: session.missed ? "missed" : "completed", recording: null, provenance: "fictional_demo" });
    const attemptCount = session.attempts ?? 1;
    for (let n = 0; n < attemptCount; n++) {
      const attemptedAt = session.missed ? after(scheduledAt, n * 1800) : after(startedAt, -(attemptCount - n - 1) * 1800);
      const answered = !session.missed && n === attemptCount - 1;
      data.attempts.push({ id: `${session.id}-attempt-${n}`, callId: session.id, attemptedAt, endedAt: answered ? endedAt : after(attemptedAt, 45), outcome: answered ? "answered" : "no_answer" });
    }
    exchanges.forEach((exchange, i) => {
      const aiId = `${session.id}-turn-${i * 2}`;
      const patientId = `${session.id}-turn-${i * 2 + 1}`;
      const observedAt = after(startedAt, i * 35 + 15);
      data.turns.push({ id: aiId, callId: session.id, sequence: i * 2, speaker: "ai", occurredAt: after(startedAt, i * 35), text: exchange.ai }, { id: patientId, callId: session.id, sequence: i * 2 + 1, speaker: "patient", occurredAt: observedAt, text: exchange.patient });
      if (exchange.symptom) data.observations.push({
        id: `${session.id}-obs-${exchange.symptom.key}`, patientId: session.patientId, callId: session.id, sourceTurnId: patientId,
        symptomKey: exchange.symptom.key, displayName: exchange.symptom.name, observedAt, originalStatement: exchange.patient,
        qualitativeDescription: exchange.symptom.description,
        reportedSeverity: exchange.symptom.score === undefined ? null : { value: exchange.symptom.score, scale: { min: 0, max: 10, label: "Bolnikova lestvica bolečine 0–10" }, source: "patient_reported" },
        extractedAt: endedAt, extraction: "demo_script",
      });
      if (session.readings && exchange.ai === "Prosimo, preberite vrednosti z merilnika.") {
        for (const [metric, value, name, unit] of [["pulse", session.readings.pulse, "Srčni utrip", "utr/min"], ["spo2", session.readings.spo2, "SpO₂", "%"]] as const) data.measurements.push({ id: `${session.id}-${metric}`, patientId: session.patientId, callId: session.id, sourceTurnId: patientId, metric, displayName: name, value, unit, measuredAt: observedAt, source: "demo_device" });
      }
    });
    if (session.missed) continue;
    data.summaries.push({ id: `${session.id}-summary`, callId: session.id, createdAt: endedAt, text: session.summary, concerns: data.observations.filter((o) => o.callId === session.id).map((o) => o.qualitativeDescription), wellbeing: [...session.wellbeing], patientQuestions: [...(session.questions ?? [])], sourceTurnIds: data.turns.filter((t) => t.callId === session.id && t.speaker === "patient").map((t) => t.id), generatedBy: "demo_script", reviewStatus: session.id === "c4" ? "pending" : "reviewed" });
    if (session.id !== "c4") data.reviews.push({ id: `${session.id}-review`, patientId: session.patientId, callId: session.id, alertId: null, reviewerUserId: DEMO_DOCTOR_ID, reviewedAt: after(endedAt, 3600), status: "reviewed" });
  }
  // Explicit scenario alerts preserve their evidence and configured criterion, not LLM inference.
  for (const [suffix, measurementId, observationId, reason] of [
    ["spo2", "c4-spo2", null, "Demo SpO₂ 89 % je pod individualno demo mejo 92 %."],
    ["pain", null, "c4-obs-eye_pain", "Bolnica poroča o bolečini 7/10; dosežena je individualna demo meja 7/10."],
  ] as const) data.alerts.push({ id: `alert-c4-${suffix}`, patientId: "p1", callId: "c4", createdAt: after(timestamp(21, "10:02"), 250), severity: "critical" as Severity, criterionId: `rule-p1-${suffix}`, measurementId, observationId, reason, reviewStatus: "pending", resolutionStatus: "open", resolvedAt: null });
  for (const alert of data.alerts) {
    for (const recipientUserId of [DEMO_GUARDIAN_ID, DEMO_DOCTOR_ID]) {
      for (const channel of ["in_app", "email", "sms"] as const) data.notifications.push({ id: `${alert.id}-${recipientUserId}-${channel}`, patientId: alert.patientId, callId: alert.callId, alertId: alert.id, recipientUserId, channel, createdAt: alert.createdAt, deliveryStatus: "delivered", deliveredAt: after(alert.createdAt, 10), readAt: null, provenance: "fictional_demo" });
    }
  }
  data.notes.push({ id: "note-c3", patientId: "p1", callId: "c3", authorUserId: DEMO_DOCTOR_ID, createdAt: after(timestamp(20, "10:01"), 4000), text: "Demo: vprašanje o vožnji je zabeleženo za naslednji pogovor z ambulanto.", followUpStatus: "requested" });
  return data;
}
