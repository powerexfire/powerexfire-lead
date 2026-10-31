import { useCallback } from "react";
import { Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PowerexNavbar } from "./PowerexNavbar";
import { AppSidebar } from "./AppSidebar";
import { WorkspaceProvider } from "./WorkspaceContext";

export function AppLayout({ session }: { session: Session }) {
  const handleSignOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed out securely.");
  }, []);

  return (
    <WorkspaceProvider session={session}>
      <SidebarProvider>
        <div className="industrial-shell flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <PowerexNavbar userEmail={session.user.email} onSignOut={handleSignOut} />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
