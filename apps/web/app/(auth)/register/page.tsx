import { notFound } from "next/navigation";
import { PASSWORD_MIN_LENGTH } from "@senlo/core/server";
import { getConfig } from "@/lib/config";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  const { allowRegistration, github } = getConfig();
  // Closed registration is a 404, decided per request from the runtime
  // config rather than frozen into the build.
  if (!allowRegistration) notFound();
  return <RegisterForm passwordMinLength={PASSWORD_MIN_LENGTH} githubEnabled={github !== null} />;
}
