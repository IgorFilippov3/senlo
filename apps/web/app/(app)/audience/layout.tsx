"use client";

import { Tabs, TabsList, TabsTrigger } from "@senlo/ui";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";

interface AudienceLayoutProps {
  children: ReactNode;
}

export default function AudienceLayout({ children }: AudienceLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine active tab based on pathname
  const activeTab = pathname.split("/").pop() || "suppressions";

  const handleTabChange = (value: string) => {
    router.push(`/audience/${value}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="border-b border-zinc-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-8">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="border-none">
            <TabsList className="bg-transparent border-none -mb-px gap-6">
              <TabsTrigger 
                value="suppressions" 
                className="px-1 py-4 bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none shadow-none text-zinc-500 font-medium hover:text-zinc-900 transition-all"
              >
                Suppression List
              </TabsTrigger>
              <TabsTrigger 
                value="contacts" 
                disabled
                className="px-1 py-4 bg-transparent border-b-2 border-transparent rounded-none shadow-none text-zinc-400 font-medium cursor-not-allowed opacity-50"
              >
                Contacts (Soon)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
