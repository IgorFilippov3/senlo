"use client";

import { ApiDocsView, type ApiDocsViewProps } from "@senlo/features/api-docs";
import { nextRenderLink as renderLink } from "@senlo/next/link";

export function ApiDocs(props: Omit<ApiDocsViewProps, "renderLink">) {
  return <ApiDocsView {...props} renderLink={renderLink} />;
}
