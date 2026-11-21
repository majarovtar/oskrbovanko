import { Link } from "react-router-dom";

import { ErrorPage } from "../components/ErrorPage";
import { usePatients } from "../hooks/usePatients";
import styles from "./HomePage.module.css";

export function HomePage() {
  const { patients, error, loading } = usePatients();

  return (
    <div>
      <h1>CareCall</h1>
      <p className={styles.tagline}>Daily check-ins for patients after discharge</p>

      <h2>Patients</h2>
      {loading && <p>Loading...</p>}
      {error && <ErrorPage message={error.message} />}
      {patients && patients.length === 0 && <p>No patients yet</p>}
      {patients && patients.length > 0 && (
        <ul className={styles.patientList}>
          {patients.map((patient) => (
            <li className={styles.patientItem} key={patient.id}>
              <Link to={`/patients/${patient.id}`}>{patient.name}</Link>
              <span className={styles.callTime}>{patient.call_time}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
