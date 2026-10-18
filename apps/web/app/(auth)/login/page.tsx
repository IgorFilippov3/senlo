import { getConfig } from "apps/web/lib/config";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <LoginForm allowRegistration={getConfig().allowRegistration} />;
}
