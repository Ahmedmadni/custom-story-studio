import { createFileRoute } from "@tanstack/react-router";

import { UsersManager } from "@/features/admin/UsersManager";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: () => <UsersManager mode="roles" />,
});
