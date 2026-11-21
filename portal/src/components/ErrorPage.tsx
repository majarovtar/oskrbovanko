import styles from "./ErrorPage.module.css";

export interface ErrorPageProps {
  message: string;
}

export function ErrorPage({ message }: ErrorPageProps) {
  return <p className={styles.error}>{message}</p>;
}
