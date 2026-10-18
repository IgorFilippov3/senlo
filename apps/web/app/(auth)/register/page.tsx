import { notFound } from "next/navigation";
import { getConfig } from "apps/web/lib/config";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  // Closed registration is a 404, decided per request from the runtime
  // config rather than frozen into the build.
  if (!getConfig().allowRegistration) {
    notFound();
  }
  return <RegisterForm />;
}
