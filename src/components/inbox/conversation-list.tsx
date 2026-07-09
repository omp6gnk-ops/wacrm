"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import { cn } from "@/lib/utils";
import type { Conversation, Tag } from "@/types";
import { Search, ChevronDown, X, UserCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
  currentUserId?: string | null;
  accountRole?: string | null;
  showExpiredOnly?: boolean;
}

type InboxFilter = "all" | "unread" | "new_inbound" | "reply_to_agent";

type AssignmentFilter = 'all_chats' | 'my_chats' | 'unassigned';

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  currentUserId,
  accountRole,
  showExpiredOnly = false,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [loading, setLoading] = useState(true);
  
  const isAgentRole = accountRole === 'agent' || accountRole === 'viewer';
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>(
    isAgentRole ? 'my_chats' : 'all_chats'
  );
  // Contact-based filters (issue #272). Tags use OR logic (a conversation
  // matches if its contact carries any selected tag), consistent with
  // Broadcast audience filtering. Company is an exact match on the field.
  const [tags, setTags] = useState<Tag[]>([]);
  const [customStatuses, setCustomStatuses] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Teammates / Agents list and active filter state
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // see comment in message-composer.tsx.
  const loadCallbackRef = useRef(onConversationsLoaded);
  useEffect(() => {
    loadCallbackRef.current = onConversationsLoaded;
  });

  const fetchConversations = useCallback(async () => {
    const supabase = createClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("conversations")
      .select(CONVERSATION_SELECT);

    if (showExpiredOnly) {
      query = query.lte("last_customer_message_at", twentyFourHoursAgo);
    } else {
      query = query.or(`last_customer_message_at.gt.${twentyFourHoursAgo},last_customer_message_at.is.null`);
    }

    if (assignmentFilter === 'my_chats' && currentUserId) {
      query = query.eq('assigned_agent_id', currentUserId);
    } else if (assignmentFilter === 'unassigned') {
      query = query.is('assigned_agent_id', null);
    } else if (selectedAgentId !== null) {
      query = query.eq('assigned_agent_id', selectedAgentId);
    }

    const { data, error } = await query
      .order("last_message_at", { ascending: false })
      .limit(250);

    if (error) {
      console.error("[conversation-list] fetch error:", error);
    } else {
      loadCallbackRef.current?.(normalizeConversations(data ?? []));
    }
    setLoading(false);
  }, [showExpiredOnly, assignmentFilter, currentUserId, selectedAgentId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await fetchConversations();
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken, fetchConversations]);

  // Tag definitions for the filter picker — loaded once so labels/colours
  // stay stable regardless of which conversations happen to be loaded.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    (async () => {
      const { data } = await supabase.from("conversation_custom_statuses").select("id, name, color").order("name");
      if (!cancelled && data) setCustomStatuses(data);
    })();
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name").order("full_name");
      if (!cancelled && data) setProfiles(data);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Company options are derived from the loaded conversations — there's no
  // separate companies table, and only companies with a live conversation
  // are worth offering as an inbox filter.
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      const co = c.contact?.company?.trim();
      if (co) set.add(co);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const filtered = useMemo(() => {
    let result = conversations;

    // Filter by session expiry
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    result = result.filter((c) => {
      if (showExpiredOnly) {
        if (!c.last_customer_message_at) return false;
        return new Date(c.last_customer_message_at).getTime() <= twentyFourHoursAgo;
      } else {
        if (!c.last_customer_message_at) return true;
        return new Date(c.last_customer_message_at).getTime() > twentyFourHoursAgo;
      }
    });

    if (assignmentFilter === 'my_chats' && currentUserId) {
      result = result.filter((c) => c.assigned_agent_id === currentUserId);
    } else if (assignmentFilter === 'unassigned') {
      result = result.filter((c) => !c.assigned_agent_id);
    } else if (selectedAgentId !== null) {
      result = result.filter((c) => c.assigned_agent_id === selectedAgentId);
    }

    if (filter === "unread") {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter === "new_inbound") {
      result = result.filter((c) => c.unread_count > 0 && !c.has_agent_replied);
    } else if (filter === "reply_to_agent") {
      result = result.filter((c) => c.unread_count > 0 && c.has_agent_replied);
    }

    if (selectedStatusId !== null) {
      result = result.filter((c) => c.custom_status_id === selectedStatusId);
    }

    // Contact-based filters (tags via OR logic, exact company match).
    if (selectedTagIds.length > 0 || selectedCompany !== null) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    // Sort by last_message_at descending so the most recent chats are always at the top
    result = [...result].sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [conversations, assignmentFilter, currentUserId, filter, search, selectedTagIds, selectedCompany, showExpiredOnly, selectedAgentId, selectedStatusId]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  }, []);

  const hasContactFilters = selectedTagIds.length > 0 || selectedCompany !== null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const filterOptions: { label: string; value: InboxFilter; color?: string }[] = useMemo(() => [
    { label: "All Chats", value: "all" },
    { label: "Unread (All)", value: "unread" },
    { label: "New Inbound (First Msg)", value: "new_inbound" },
    { label: "Reply to Agent (Returning)", value: "reply_to_agent" },
  ], []);

  const activeFilter = filterOptions.find((o) => o.value === filter);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-80">
      {/* Search + Filter */}
      <div className="space-y-2 border-b border-border p-3">
        {/* Assignment filter tabs */}
        <div className="flex rounded-lg bg-muted p-0.5 mb-2">
          {[
            { label: 'All Chats', value: 'all_chats' as AssignmentFilter },
            { label: 'My Chats', value: 'my_chats' as AssignmentFilter },
            { label: 'Unassigned', value: 'unassigned' as AssignmentFilter },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setAssignmentFilter(tab.value)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-all',
                assignmentFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="border-border bg-muted pl-9 text-sm text-foreground placeholder-muted-foreground focus:border-primary/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                {activeFilter?.label ?? "All"}
                <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-border bg-popover"
            >
              {filterOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "text-sm",
                    filter === opt.value
                      ? "text-primary"
                      : "text-popover-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {opt.color && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    {opt.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {customStatuses.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                  selectedStatusId !== null
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {selectedStatusId
                  ? (customStatuses.find((s) => s.id === selectedStatusId)?.name ?? "Lead Status")
                  : "Lead Status"}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 w-56 border-border bg-popover overflow-y-auto"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedStatusId(null)}
                  className={cn(
                    "text-sm font-medium",
                    selectedStatusId === null ? "text-primary" : "text-popover-foreground"
                  )}
                >
                  All Statuses
                </DropdownMenuItem>
                {customStatuses.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setSelectedStatusId(s.id)}
                    className={cn(
                      "text-sm",
                      selectedStatusId === s.id ? "text-primary" : "text-popover-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Assignee Filter Dropdown */}
          {profiles.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                  selectedAgentId !== null
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {selectedAgentId
                  ? (profiles.find((p) => p.user_id === selectedAgentId)?.full_name ?? "Assigned")
                  : "Assignee"}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 w-56 border-border bg-popover overflow-y-auto"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedAgentId(null)}
                  className={cn(
                    "text-sm font-medium",
                    selectedAgentId === null ? "text-primary" : "text-popover-foreground"
                  )}
                >
                  All Assignees
                </DropdownMenuItem>
                {profiles.map((p) => (
                  <DropdownMenuItem
                    key={p.user_id}
                    onClick={() => setSelectedAgentId(p.user_id)}
                    className={cn(
                      "text-sm",
                      selectedAgentId === p.user_id ? "text-primary" : "text-popover-foreground"
                    )}
                  >
                    {p.full_name ?? "Unknown Teammate"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {companies.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex max-w-40 items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                  selectedCompany
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="truncate">{selectedCompany ?? "Company"}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 w-56 border-border bg-popover"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedCompany(null)}
                  className={cn(
                    "text-sm",
                    selectedCompany === null
                      ? "text-primary"
                      : "text-popover-foreground"
                  )}
                >
                  All companies
                </DropdownMenuItem>
                {companies.map((co) => (
                  <DropdownMenuItem
                    key={co}
                    onClick={() => setSelectedCompany(co)}
                    className={cn(
                      "text-sm",
                      selectedCompany === co
                        ? "text-primary"
                        : "text-popover-foreground"
                    )}
                  >
                    <span className="truncate">{co}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {hasContactFilters && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/70"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag?.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="max-w-24 truncate">{tag?.name ?? "Tag"}</span>
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selectedCompany && (
              <button
                onClick={() => setSelectedCompany(null)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/70"
              >
                <span className="max-w-24 truncate">{selectedCompany}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={clearContactFilters}
              className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                customStatuses={customStatuses}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  customStatuses: { id: string; name: string; color: string }[];
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  customStatuses,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
      })
    : "";

  const leadStatus = customStatuses.find((s) => s.id === conversation.custom_status_id);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
        isActive && "border-l-2 border-primary bg-muted/70"
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground flex items-center gap-1.5 min-w-0">
            <span className="truncate">{displayName}</span>
            {leadStatus && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none border"
                style={{
                  backgroundColor: `${leadStatus.color}15`,
                  color: leadStatus.color,
                  borderColor: `${leadStatus.color}30`,
                }}
              >
                {leadStatus.name}
              </span>
            )}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {conversation.last_message_text || "No messages yet"}
          </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {conversation.unread_count > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {conversation.unread_count}
                </span>
              )}
            </div>
        </div>
      </div>
    </button>
  );
}
