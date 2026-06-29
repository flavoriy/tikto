import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

type TaskReopenRouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: TaskReopenRouteContext) {
  const { id } = await context.params;
  return proxyTiktoApiRequest(request, `/tasks/${encodeURIComponent(id)}/reopen`);
}