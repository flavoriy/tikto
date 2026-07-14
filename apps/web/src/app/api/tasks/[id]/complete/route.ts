import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

type TaskCompleteRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: TaskCompleteRouteContext) {
  const { id } = await context.params;
  return proxyTiktoApiRequest(request, `/tasks/${encodeURIComponent(id)}/complete`);
}