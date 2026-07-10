'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  Sparkles, 
  Loader2, 
  User, 
  Settings2, 
  Check, 
  MessageSquare,
  AlertCircle,
  HelpCircle,
  Undo2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface AccountMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  account_role: 'admin' | 'agent' | 'viewer';
}

interface AiAgentConfig {
  id?: string;
  agent_id: string;
  system_prompt: string;
  max_replies: number;
  is_active: boolean;
  updated_at?: string;
}

export function AiAgentAssistants() {
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [configs, setConfigs] = useState<AiAgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Form states for the editing assistant config
  const [isActive, setIsActive] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [maxReplies, setMaxReplies] = useState(3);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, configsRes] = await Promise.all([
        fetch('/api/account/members'),
        fetch('/api/ai/agent-configs')
      ]);

      if (membersRes.ok && configsRes.ok) {
        const membersData = await membersRes.json();
        const configsData = await configsRes.json();
        setMembers(membersData.members ?? []);
        setConfigs(configsData.configs ?? []);
      } else {
        toast.error('Failed to load team profiles or AI configs');
      }
    } catch (err) {
      console.error('[ai assistants load] failed:', err);
      toast.error('Connection error while fetching team details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditAgent = (agentId: string) => {
    const existing = configs.find(c => c.agent_id === agentId);
    setSelectedAgentId(agentId);
    if (existing) {
      setIsActive(existing.is_active);
      setSystemPrompt(existing.system_prompt);
      setMaxReplies(existing.max_replies);
    } else {
      setIsActive(false);
      setSystemPrompt(
        `You are a helpful assistant for this customer conversation.\n` +
        `Greet the customer politely and let them know that I am currently away but will reply shortly.\n` +
        `Ask how you can assist them in the meantime, and gather basic details.`
      );
      setMaxReplies(3);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedAgentId) return;

    if (isActive && !systemPrompt.trim()) {
      toast.error('Greeting Prompt cannot be empty when Assistant AI is active.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/ai/agent-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          system_prompt: systemPrompt.trim(),
          max_replies: maxReplies,
          is_active: isActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Agent Assistant AI saved successfully.');
        
        // Refresh local config cache
        const updatedConfig = data.config as AiAgentConfig;
        setConfigs(prev => {
          const idx = prev.findIndex(c => c.agent_id === selectedAgentId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updatedConfig;
            return next;
          } else {
            return [...prev, updatedConfig];
          }
        });
        setSelectedAgentId(null);
      } else {
        toast.error(data.error || 'Failed to save configuration');
      }
    } catch {
      toast.error('Connection error while saving config');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async (agentId: string) => {
    if (!confirm('Are you sure you want to disable and delete this agent\'s Assistant AI?')) return;

    try {
      const res = await fetch(`/api/ai/agent-configs?agent_id=${agentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Agent Assistant AI disabled and removed.');
        setConfigs(prev => prev.filter(c => c.agent_id !== agentId));
        if (selectedAgentId === agentId) {
          setSelectedAgentId(null);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete configuration');
      }
    } catch {
      toast.error('Connection error while deleting config');
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60 shadow-sm flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground text-sm font-medium">Loading team assistants...</span>
      </Card>
    );
  }

  // Filter out viewers, assistants are only for admins/agents who handle chats
  const chatAgents = members.filter(m => m.account_role !== 'viewer');

  return (
    <div className="grid md:grid-cols-12 gap-5 items-start">
      {/* LEFT PANEL: Team members list */}
      <Card className="border-border/60 shadow-sm md:col-span-5 h-[calc(100vh-14rem)] overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Team Members
          </CardTitle>
          <CardDescription>
            Configure lightweight greeting and FAQ assistants for individual chat agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          {chatAgents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No agents or admins found in this account.
            </div>
          ) : (
            <div className="space-y-2">
              {chatAgents.map((member) => {
                const config = configs.find(c => c.agent_id === member.user_id);
                const isConfigured = !!config;
                const isConfigActive = config?.is_active === true;
                const isSelected = selectedAgentId === member.user_id;

                return (
                  <div
                    key={member.user_id}
                    onClick={() => handleEditAgent(member.user_id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected 
                        ? 'border-primary/80 bg-primary/5 ring-1 ring-primary/40' 
                        : 'border-border/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border/80 shadow-sm">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/5 text-primary font-semibold text-xs">
                          {member.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {member.full_name}
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-muted-foreground/30 capitalize text-muted-foreground">
                            {member.account_role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {isConfigured ? (
                            isConfigActive ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border-0 text-[10px] h-4">
                                Assistant Active
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border-0 text-[10px] h-4">
                                Disabled
                              </Badge>
                            )
                          ) : (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <HelpCircle className="h-3 w-3" /> No Assistant
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-muted-foreground/10 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditAgent(member.user_id);
                      }}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT PANEL: Editing configuration */}
      <div className="md:col-span-7">
        {selectedAgentId ? (
          (() => {
            const member = members.find(m => m.user_id === selectedAgentId)!;
            const hasExisting = configs.some(c => c.agent_id === selectedAgentId);

            return (
              <Card className="border-border/60 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Configure Assistant: {member.full_name}
                    </CardTitle>
                    {hasExisting && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 px-2.5"
                        onClick={() => handleDeleteConfig(selectedAgentId)}
                      >
                        Delete Config
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    Set up lightweight FAQ and greeting behavior when chats are assigned to {member.full_name}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* ENABLE TOGGLE */}
                  <div className="flex items-center justify-between border-b border-border/20 pb-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Enable Assistant bot</Label>
                      <p className="text-[12px] text-muted-foreground">
                        Turn on initial automatic greetings and answers for {member.full_name}.
                      </p>
                    </div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>

                  {/* PROMPT EDITOR */}
                  <div className="space-y-1.5">
                    <Label htmlFor="assistantPrompt" className="text-sm font-semibold">
                      Assistant Greeting & FAQ Instructions
                    </Label>
                    <p className="text-[11px] text-muted-foreground pb-1">
                      Explain who this agent is, what details they handle, and how the bot should greet customers before the agent takes over.
                    </p>
                    <Textarea
                      id="assistantPrompt"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="e.g. You are Ramesh's virtual assistant. Ramesh sells study materials. Politely greet the customer, ask for their course name, and tell them Ramesh will reply shortly."
                      className="min-h-[160px] font-sans text-sm focus:border-primary"
                    />
                  </div>

                  {/* MAX REPLIES SLIDER */}
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="maxReplies" className="text-sm font-semibold flex items-center gap-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        Max Auto-Replies Cap
                      </Label>
                      <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
                        {maxReplies} {maxReplies === 1 ? 'reply' : 'replies'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground pb-1">
                      Limit replies to prevent endless loops. After this cap, the bot stands down so {member.full_name} can reply manually.
                    </p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        id="maxReplies"
                        min="1"
                        max="10"
                        value={maxReplies}
                        onChange={(e) => setMaxReplies(Number(e.target.value))}
                        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>

                  {/* ACTIONS BUTTONS */}
                  <div className="flex justify-end gap-3.5 border-t border-border/20 pt-4 mt-6">
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedAgentId(null)}
                      className="h-9 px-4 text-muted-foreground hover:bg-muted"
                    >
                      <Undo2 className="h-4 w-4 mr-1.5" /> Cancel
                    </Button>
                    <Button
                      onClick={handleSaveConfig}
                      disabled={saving}
                      className="h-9 px-5 font-semibold"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1.5" /> Save Configuration
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })()
        ) : (
          <Card className="border-border/60 shadow-sm border-dashed p-12 text-center h-[calc(100vh-14rem)] flex flex-col justify-center items-center">
            <div className="h-12 w-12 rounded-full bg-primary/5 text-primary flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">Select an Agent</h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Click on any team member on the left panel to configure or manage their dedicated Assistant AI bot.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
