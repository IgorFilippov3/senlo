"use client";

import { ApiDocsView, type ApiDocsViewProps } from "@senlo/features/api-docs";
import { renderLink } from "apps/web/components/link";

export function ApiDocs(props: Omit<ApiDocsViewProps, "renderLink">) {
  return <ApiDocsView {...props} renderLink={renderLink} />;
}
