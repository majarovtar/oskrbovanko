import { apiGet } from "./client";

export interface Patient {
  id: string;
  name: string;
  phone_number: string;
  call_time: string;
  consent: boolean;
}

export type Flag = "low" | "medium" | "high" | null;

export interface Answer {
  question: { text: string };
  value: string | number | boolean | null;
  flag: Flag;
}

export interface Vitals {
  pulse: number;
  spo2: number;
  measured_at: string;
}

export type Severity = "normal" | "critical";

export interface Call {
  id: string;
  patient_id: string;
  started_at: string;
  answers: Answer[];
  closing_answer: string;
  transcript: string;
  emergency_heard: boolean;
  emergency_question: number | null;
  vitals: Vitals | null;
  severity: Severity;
  severity_reasons: string[];
}

export function fetchPatients(): Promise<Patient[]> {
  return apiGet<Patient[]>("/patients");
}

export function fetchPatient(id: string): Promise<Patient> {
  return apiGet<Patient>(`/patients/${id}`);
}

export function fetchPatientCalls(id: string): Promise<Call[]> {
  return apiGet<Call[]>(`/patients/${id}/calls`);
}
