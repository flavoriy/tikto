import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

type EventRouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: EventRouteContext) {
  const { id } = await context.params;
  return proxyTiktoApiRequest(request, `/events/${encodeURIComponent(id)}`);
}

export async function DELETE(request: Request, context: EventRouteContext) {
  const { id } = await context.params;
  return proxyTiktoApiRequest(request, `/events/${encodeURIComponent(id)}`);
}