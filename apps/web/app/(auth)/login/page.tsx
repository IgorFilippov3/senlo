import { getConfig } from "@/lib/config";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const { allowRegistration, github } = getConfig();
  return <LoginForm allowRegistration={allowRegistration} githubEnabled={github !== null} />;
}
