import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

export async function PATCH(request: Request) {
  return proxyTiktoApiRequest(request, "/profile");
}