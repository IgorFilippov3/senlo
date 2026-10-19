import { getConfig } from "apps/web/lib/config";
import { LoginForm } from "apps/web/components/auth/login-form";

export default function LoginPage() {
  const { allowRegistration, github } = getConfig();
  return <LoginForm allowRegistration={allowRegistration} githubEnabled={github !== null} />;
}
