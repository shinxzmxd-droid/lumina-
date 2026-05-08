import { createFileRoute } from "@tanstack/react-router";
import { Route as AuthRoute } from "./auth";

// Render the auth page directly at "/" to avoid an extra HTTP redirect on first load.
// Authenticated users are forwarded to /dashboard from inside the auth component.
export const Route = createFileRoute("/")({
  component: AuthRoute.options.component!,
});
