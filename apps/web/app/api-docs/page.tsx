import { openApiSpec } from "@senlo/core/server";
import { auth } from "apps/web/auth";
import { ApiReference } from "./api-reference";

export default async function ApiDocsPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <ApiReference
      spec={openApiSpec}
      backHref={isLoggedIn ? "/home" : "/"}
      backLabel={isLoggedIn ? "Back to Workspace" : "Back to Senlo"}
    />
  );
}
