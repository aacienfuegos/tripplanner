// Dos usuarios PENDING para que los flujos 1 y 5 no dependan del orden.
export const PENDING_GUARD = {
  id: "e2e-pendiente-guard",
  name: "E2E Pendiente Guard",
  email: "e2e-pendiente-guard@example.test",
} as const;

export const PENDING_APPROVE = {
  id: "e2e-pendiente-aprobar",
  name: "E2E Pendiente Aprobar",
  email: "e2e-pendiente-aprobar@example.test",
} as const;
