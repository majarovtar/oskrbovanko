import type { Answer, Call } from "../api/patients";
import styles from "./CallDetails.module.css";

export interface CallDetailsProps {
  call: Call;
}

const FLAG_CLASS: Record<"low" | "medium" | "high", string> = {
  low: styles.flagLow,
  medium: styles.flagMedium,
  high: styles.flagHigh,
};

function formatValue(value: Answer["value"]): string {
  if (value === null) return "";
  return String(value);
}

export function CallDetails({ call }: CallDetailsProps) {
  return (
    <div className={styles.details}>
      {call.answers.map((answer, index) => (
        <div className={styles.answerRow} key={index}>
          <span>{answer.question.text}</span>
          <span>{formatValue(answer.value)}</span>
          {answer.flag && <span className={`${styles.flagBadge} ${FLAG_CLASS[answer.flag]}`}>{answer.flag}</span>}
        </div>
      ))}

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Anything else</span>
        <p>{call.closing_answer}</p>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Transcript</span>
        <p className={styles.transcript}>{call.transcript}</p>
      </div>
    </div>
  );
}
