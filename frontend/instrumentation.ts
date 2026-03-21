
import { registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "s8lls-frontend",
  });
}
