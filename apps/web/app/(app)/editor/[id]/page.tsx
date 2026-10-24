import { loadEditorPage, type EditorPageProps } from "@senlo/next";
import { EditorScreen } from "@senlo/next/editor";
import { senloAction } from "@/lib/actions";
import { host } from "@/lib/host";

export default async function EditorPage(props: EditorPageProps) {
  return <EditorScreen call={senloAction} {...await loadEditorPage(host, props)} />;
}
