'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, MessageSquare, AlertCircle } from 'lucide-react';

interface CannedResponse {
  id: string;
  shortcut: string;
  message_text: string;
  created_at: string;
}

export function CannedPanel() {
  const { accountId, canEditSettings, user } = useAuth();
  const supabase = createClient();

  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states for creating a new canned response
  const [shortcut, setShortcut] = useState('');
  const [messageText, setMessageText] = useState('');

  async function loadResponses() {
    if (!accountId) return;
    try {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('id, shortcut, message_text, created_at')
        .eq('account_id', accountId)
        .order('shortcut');
      
      if (error) throw error;
      setResponses(data ?? []);
    } catch (err: any) {
      console.error('Failed to load canned responses:', err);
      toast.error('Failed to load quick replies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResponses();
  }, [accountId]);

  async function handleAddResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!shortcut.trim() || !messageText.trim()) {
      toast.error('Please fill in both shortcut and reply message');
      return;
    }

    // Clean up shortcut: remove leading slash if entered, force alphanumeric/dashes
    let cleanShortcut = shortcut.trim().replace(/^\//, '').toLowerCase();
    if (!/^[a-z0-9-_]+$/.test(cleanShortcut)) {
      toast.error('Shortcut must contain only letters, numbers, dashes, or underscores (no spaces)');
      return;
    }

    // Check if duplicate shortcut
    if (responses.some((r) => r.shortcut === cleanShortcut)) {
      toast.error('A quick reply with this shortcut already exists');
      return;
    }

    if (!accountId || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('canned_responses')
        .insert({
          account_id: accountId,
          created_by: user.id,
          shortcut: cleanShortcut,
          message_text: messageText.trim()
        });

      if (error) throw error;

      toast.success(`Quick reply /${cleanShortcut} created successfully`);
      setShortcut('');
      setMessageText('');
      await loadResponses();
    } catch (err: any) {
      console.error('Failed to create canned response:', err);
      toast.error('Failed to create quick reply');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteResponse(id: string, shortcutName: string) {
    if (!confirm(`Are you sure you want to delete the /${shortcutName} quick reply?`)) return;

    try {
      const { error } = await supabase
        .from('canned_responses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Deleted /${shortcutName}`);
      await loadResponses();
    } catch (err: any) {
      console.error('Failed to delete response:', err);
      toast.error('Failed to delete quick reply');
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Quick Replies (Canned Responses)</h2>
        <p className="text-sm text-muted-foreground">
          Define shortcuts to quickly type pre-written replies in the inbox by typing <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-mono text-[11px]">/</kbd> followed by the shortcut.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Create Form (Admin Only) */}
        {canEditSettings ? (
          <Card className="p-5 h-fit lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">New Quick Reply</h3>
            <form onSubmit={handleAddResponse} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="canned-shortcut" className="text-xs">Shortcut Command</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">/</span>
                  <Input
                    id="canned-shortcut"
                    placeholder="welcome"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    className="bg-muted/50 border-border text-sm pl-6"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Alphanumeric & dashes only. E.g., `welcome` will trigger with `/welcome`.
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="canned-message" className="text-xs">Reply Message</Label>
                <Textarea
                  id="canned-message"
                  placeholder="Hello! Welcome to GNK Edusolution. How can I help you today?"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="bg-muted/50 border-border text-sm min-h-[100px] resize-y"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Add Quick Reply
              </Button>
            </form>
          </Card>
        ) : (
          <Card className="p-5 lg:col-span-1 bg-muted/20 border-dashed border-border flex flex-col items-center justify-center text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Only administrators can add or edit quick replies.</p>
          </Card>
        )}

        {/* Quick Replies Roster */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Available Commands</h3>
            </div>

            {responses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No quick replies defined yet.</p>
            ) : (
              <div className="grid gap-3">
                {responses.map((res) => (
                  <div key={res.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-all group">
                    <div className="min-w-0 space-y-1.5">
                      <span className="inline-flex items-center rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary font-mono leading-none">
                        /{res.shortcut}
                      </span>
                      <p className="text-xs text-foreground leading-relaxed break-words whitespace-pre-line pr-2">
                        {res.message_text}
                      </p>
                    </div>
                    {canEditSettings && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResponse(res.id, res.shortcut)}
                        className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-7 w-7 shrink-0 transition-all opacity-80 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
