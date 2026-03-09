
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "red_door-frontend",
  });
}
