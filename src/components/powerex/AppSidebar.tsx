import { NavLink, useLocation } from "react-router-dom";
import { Settings, Table2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Leads", url: "/leads", icon: Table2 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/70">
      <SidebarHeader className="border-b border-border/70 px-4 py-4">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Workspace</p>
        <p className="text-sm font-black text-foreground">Lead Command</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={item.title}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
