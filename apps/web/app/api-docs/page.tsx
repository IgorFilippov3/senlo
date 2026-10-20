import { openApiSpec } from "@senlo/core/server";
import { auth } from "@/auth";
import { ApiDocs } from "@/components/api-docs/api-docs";

export default async function ApiDocsPage() {
  const session = await auth();
  const back = session?.user
    ? { href: "/home", label: "Back to Workspace" }
    : { href: "/", label: "Back to Senlo" };

  return <ApiDocs spec={openApiSpec} back={back} />;
}
