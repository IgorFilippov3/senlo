import { NotFoundScreen } from "@senlo/features";
import { auth } from "apps/web/auth";
import { renderLink } from "apps/web/components/link";

/** Every `notFound()` and unknown URL. Outside the app shell, so a recipient's bad link gets it too. */
export default async function NotFound() {
  const session = await auth();
  const back = session?.user
    ? { href: "/home", label: "Back to workspaces" }
    : { href: "/", label: "Back to Senlo" };

  return <NotFoundScreen fullScreen back={back} renderLink={renderLink} />;
}
