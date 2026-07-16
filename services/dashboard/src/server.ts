import { getServiceHealth } from "../../../packages/service-runtime/src/health";
import {
  createJsonServiceServer,
  methodNotAllowed,
  notFound,
  ok,
  requireContext,
  requireInternalRequest,
} from "../../../packages/service-runtime/src/http";
import { createDashboardDomain } from "./domain";

const domain = createDashboardDomain();
console.log("Starting dashboard service v2...");

createJsonServiceServer({
  serviceName: "tikto-dashboard",
  defaultPort: 4400,
  async route({ request, pathname, segments, method }) {
    if (method === "GET" && pathname === "/health") {
      const health = await getServiceHealth({
        serviceName: "tikto-dashboard",
        dependencies: [
          {
            service: "tasks",
            env: "TIKTO_TASKS_API_URL",
          },
          {
            service: "calendar",
            env: "TIKTO_CALENDAR_API_URL",
          },
        ],
      });
      return ok(health, health.ok ? 200 : 503);
    }

    requireInternalRequest(request);
    const context = requireContext(request);

    if (segments.length === 1 && segments[0] === "dashboard") {
      if (method === "GET") {
        return ok(await domain.getDashboardData(context));
      }

      methodNotAllowed();
    }

    notFound();
  },
});
