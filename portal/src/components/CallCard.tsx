import { useState } from "react";

import type { Call } from "../api/patients";
import { CallDetails } from "./CallDetails";
import styles from "./CallCard.module.css";

export interface CallCardProps {
  call: Call;
}

function formatStartedAt(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

export function CallCard({ call }: CallCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isCritical = call.severity === "critical";

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span>{formatStartedAt(call.started_at)}</span>
        <span className={`${styles.badge} ${isCritical ? styles.badgeCritical : styles.badgeNormal}`}>
          {isCritical ? "Critical" : "Normal"}
        </span>
      </div>

      {isCritical && call.severity_reasons.length > 0 && (
        <ul className={styles.reasons}>
          {call.severity_reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      <div className={styles.vitals}>
        {call.vitals ? (
          <>
            <span>Pulse {call.vitals.pulse} bpm</span>
            {" · "}
            <span>SpO2 {call.vitals.spo2} %</span>
          </>
        ) : (
          <span>No vitals yet</span>
        )}
      </div>

      <button className={styles.toggle} onClick={() => setShowDetails((value) => !value)}>
        {showDetails ? "Hide details" : "Show details"}
      </button>

      {showDetails && <CallDetails call={call} />}
    </div>
  );
}
