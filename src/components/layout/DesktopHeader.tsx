import React, { useState, useRef, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Home, Search, Settings, Bell, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useTradeInbox } from "@/hooks/useTradeInbox";
import { useReminders } from "@/hooks/useReminders";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { LiveSearchResults } from "@/components/search/LiveSearchResults";

interface DesktopHeaderProps {
  onSearchClick?: () => void;
}

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/journal": "Portfolio",
  "/analytics": "Analytics",
  "/watchlist": "Watchlists",
  "/playbook": "Playbook",
  "/market": "Market",
  "/pricing": "Pricing",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/billing": "Billing",
  "/admin": "Admin",
  "/alerts": "Alerts",
  "/trade-inbox": "Trade Inbox",
};

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({ onSearchClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { updateAvailable, triggerUpdate } = useAppUpdate();
  
  // Get live counts from trade inbox, reminders, and notification history
  const { counts: inboxCounts } = useTradeInbox();
  const { groupedReminders } = useReminders();
  const { unreadCount: unreadAlertsCount } = useNotificationHistory();
  
  // Calculate total pending count including unread alerts
  const pendingInboxCount = inboxCounts.pending + inboxCounts.needs_review;
  const pendingTaskCount = groupedReminders?.triggered?.length || 0;
  const totalPendingCount = pendingInboxCount + pendingTaskCount + unreadAlertsCount;
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const currentPath = location.pathname;
  const pageLabel = routeLabels[currentPath] || "Page";

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (path: string) => {
    setShowResults(false);
    setSearchQuery("");
    navigate(path);
  };

  const getUserInitials = () => {
    if (profile?.display_name) {
      return profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return "TC";
  };

  return (
    <header className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-white/5">
      {/* Left side - Breadcrumb & Title */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            <Home className="h-3.5 w-3.5" />
          </Link>
          <span>/</span>
          <span>{pageLabel}</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">{pageLabel}</h1>
      </div>

      {/* Right side - Search, User, Actions */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div ref={searchRef} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) {
                setShowResults(true);
              }
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setShowResults(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowResults(false);
                setSearchQuery("");
              }
            }}
            className="pl-9 pr-4 w-56 bg-muted/50 border-white/5 rounded-xl"
          />
          {showResults && searchQuery.length >= 2 && (
            <LiveSearchResults
              query={searchQuery}
              onSelect={handleSelect}
              onClose={() => setShowResults(false)}
            />
          )}
        </div>

        {/* User Avatar & Name */}
        <Link to="/settings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="text-sm font-medium text-muted-foreground">
            {profile?.display_name || "Trader"}
          </span>
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
        </Link>

        {/* Update Available */}
        {updateAvailable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-primary hover:text-primary/80 relative"
                onClick={triggerUpdate}
              >
                <RefreshCw className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Update available - click to reload</TooltipContent>
          </Tooltip>
        )}

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link to="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>

        {/* Notifications */}
        <NotificationDropdown>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
          >
            <Bell className="h-4 w-4" />
            {totalPendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-loss text-white text-[10px] font-bold flex items-center justify-center shadow-lg ring-2 ring-background">
                {totalPendingCount > 99 ? "99+" : totalPendingCount}
              </span>
            )}
          </Button>
        </NotificationDropdown>
      </div>
    </header>
  );
};

export default DesktopHeader;
