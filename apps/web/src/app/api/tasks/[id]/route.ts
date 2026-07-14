import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

type TaskRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: TaskRouteContext) {
  const { id } = await context.params;
  return proxyTiktoApiRequest(request, `/tasks/${encodeURIComponent(id)}`);
}

export async function DELETE(request: Request, context: TaskRouteContext) {
  const { id } = await context.params;
  return proxyTiktoApiRequest(request, `/tasks/${encodeURIComponent(id)}`);
}