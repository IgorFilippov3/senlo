import { SidebarWrapper } from "@/components/sidebar/sidebar-wrapper";
import { QueryProvider } from "@/providers";
import { DialogProvider } from "@/providers/dialogs";

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
