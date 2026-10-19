import { SidebarWrapper } from "apps/web/components/sidebar/sidebar-wrapper";
import { QueryProvider } from "apps/web/providers";
import { DialogProvider } from "apps/web/providers/dialogs";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <QueryProvider>
      <SidebarWrapper>{children}</SidebarWrapper>
      <DialogProvider />
    </QueryProvider>
  );
}
