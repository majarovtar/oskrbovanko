import { createFileRoute, redirect } from "@tanstack/react-router";

// Skrbnik ima vse na eni strani; stare povezave preusmerimo tja.
export const Route = createFileRoute("/skrbnik/kontakti")({
  beforeLoad: () => {
    throw redirect({ to: "/skrbnik" });
  },
});