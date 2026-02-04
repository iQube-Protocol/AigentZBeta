import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  FileText,
  BookOpen,
  Users,
  Shield,
  Settings,
  Newspaper,
  Image,
  Video,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react";

const menuItems = [
  {
    title: "Content",
    icon: Folder,
    items: [
      { title: "Articles", url: "/articles", icon: FileText },
      { title: "Comics", url: "/comics", icon: BookOpen },
      { title: "Media", url: "/media", icon: Image },
      { title: "Videos", url: "/videos", icon: Video },
    ],
  },
  {
    title: "Publishing",
    icon: Folder,
    items: [
      { title: "Editor", url: "/editor", icon: Newspaper },
      { title: "Syndication", url: "/syndication", icon: Users },
    ],
  },
  {
    title: "System",
    icon: Folder,
    items: [
      { title: "Verification", url: "/verify", icon: Shield },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Content: true,
    Publishing: true,
    System: false,
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isActive = (url: string) => location.pathname === url;
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
          <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-primary to-secondary" />
            {!isCollapsed && (
              <span className="text-sm font-semibold">The Qriptopian</span>
            )}
          </div>
        </div>

        {menuItems.map((group) => {
          const isGroupOpen = openGroups[group.title];
          const GroupIcon = isGroupOpen ? FolderOpen : Folder;

          return (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel
                className="cursor-pointer hover:bg-sidebar-accent rounded-md px-2 py-1.5 transition-colors"
                onClick={() => toggleGroup(group.title)}
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1">{group.title}</span>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          isGroupOpen ? "rotate-90" : ""
                        }`}
                      />
                    </>
                  )}
                </div>
              </SidebarGroupLabel>

              {isGroupOpen && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className="hover:bg-sidebar-accent rounded-md"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary"
                          >
                            <item.icon className="h-4 w-4" />
                            {!isCollapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
