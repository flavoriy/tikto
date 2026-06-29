import { proxyTiktoApiRequest } from "@/lib/internal-services/proxy";

export async function GET(request: Request) {
  return proxyTiktoApiRequest(request, "/tasks");
}

export async function POST(request: Request) {
  return proxyTiktoApiRequest(request, "/tasks");
}