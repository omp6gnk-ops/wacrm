'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Plus,
  Trash2,
  MessageSquare,
  AlertCircle,
  Paperclip,
  Film,
  FileText,
  Music,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { uploadAccountMedia, MEDIA_MAX_BYTES_BY_KIND } from '@/lib/storage/upload-media';

interface CannedResponse {
  id: string;
  shortcut: string;
  message_text: string;
  media_url?: string | null;
  media_type?: string | null;
  position: number;
  created_at: string;
}

interface FormMessage {
  messageText: string;
  mediaType: 'image' | 'video' | 'document' | 'audio' | 'none';
  mediaUrl: string;
}

interface GroupedResponse {
  shortcut: string;
  messages: Array<{
    id: string;
    message_text: string;
    media_url?: string | null;
    media_type?: string | null;
    position: number;
    created_at: string;
  }>;
}

export function CannedPanel() {
  const { accountId, canEditSettings, user } = useAuth();
  const supabase = createClient();

  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states for creating a new canned response
  const [shortcut, setShortcut] = useState('');
  const [messagesList, setMessagesList] = useState<FormMessage[]>([
    { messageText: '', mediaType: 'none', mediaUrl: '' }
  ]);

  // Media attachment upload states
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  async function handleMediaUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const msg = messagesList[index];
    if (msg.mediaType === 'none') {
      toast.error('Please select a media type first');
      return;
    }

    const maxBytes = MEDIA_MAX_BYTES_BY_KIND[msg.mediaType];
    if (file.size > maxBytes) {
      toast.error(`File is too large. Max size for ${msg.mediaType} is ${maxBytes / (1024 * 1024)}MB`);
      return;
    }

    setUploadingIndex(index);
    try {
      const { publicUrl } = await uploadAccountMedia('chat-media', file);
      const newList = [...messagesList];
      newList[index].mediaUrl = publicUrl;
      setMessagesList(newList);
      toast.success('Media uploaded successfully');
    } catch (err: any) {
      console.error('Media upload failed:', err);
      toast.error(err.message || 'Failed to upload media');
    } finally {
      setUploadingIndex(null);
    }
  }

  async function loadResponses() {
    if (!accountId) return;
    try {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('id, shortcut, message_text, media_url, media_type, position, created_at')
        .eq('account_id', accountId)
        .order('shortcut')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setResponses((data as CannedResponse[]) ?? []);
    } catch (err: any) {
      console.error('Failed to load canned responses:', err);
      toast.error('Failed to load quick replies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadResponses();
  }, [accountId]);

  // Group responses by shortcut command
  const groupedResponses = useMemo(() => {
    const groups: Record<string, GroupedResponse['messages']> = {};
    for (const res of responses) {
      const sh = res.shortcut.toLowerCase();
      if (!groups[sh]) {
        groups[sh] = [];
      }
      groups[sh].push({
        id: res.id,
        message_text: res.message_text,
        media_url: res.media_url,
        media_type: res.media_type,
        position: res.position ?? 0,
        created_at: res.created_at,
      });
    }

    // Sort messages in each shortcut group by position, then created_at
    for (const sh of Object.keys(groups)) {
      groups[sh].sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }

    // Convert to array sorted by shortcut alphabetically
    return Object.entries(groups).map(([sh, messages]) => ({
      shortcut: sh,
      messages,
    })).sort((a, b) => a.shortcut.localeCompare(b.shortcut));
  }, [responses]);

  async function handleAddResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!shortcut.trim()) {
      toast.error('Please enter a shortcut command');
      return;
    }

    // Validate that there is at least one message with either text or media
    const validMessages = messagesList.filter(m => m.messageText.trim() || (m.mediaType !== 'none' && m.mediaUrl));
    if (validMessages.length === 0) {
      toast.error('Please configure at least one valid message (with text or uploaded media)');
      return;
    }

    // Clean up shortcut
    let cleanShortcut = shortcut.trim().replace(/^\//, '').toLowerCase();
    if (!/^[a-z0-9-_]+$/.test(cleanShortcut)) {
      toast.error('Shortcut must contain only letters, numbers, dashes, or underscores (no spaces)');
      return;
    }

    // Check if shortcut exists
    const shortcutExists = groupedResponses.some(g => g.shortcut.toLowerCase() === cleanShortcut.toLowerCase());
    if (shortcutExists) {
      toast.error(`Shortcut /${cleanShortcut} already exists. Delete the existing one first.`);
      return;
    }

    if (!accountId || !user) return;

    setSubmitting(true);
    try {
      // Insert all valid messages sequentially to maintain order and positions
      for (let i = 0; i < validMessages.length; i++) {
        const msg = validMessages[i];
        const { error } = await supabase
          .from('canned_responses')
          .insert({
            account_id: accountId,
            created_by: user.id,
            shortcut: cleanShortcut,
            message_text: msg.messageText.trim(),
            media_url: msg.mediaType !== 'none' ? msg.mediaUrl : null,
            media_type: msg.mediaType !== 'none' ? msg.mediaType : null,
            position: i,
          });

        if (error) throw error;
      }

      toast.success(`Quick reply /${cleanShortcut} created successfully`);
      setShortcut('');
      setMessagesList([{ messageText: '', mediaType: 'none', mediaUrl: '' }]);
      await loadResponses();
    } catch (err: any) {
      console.error('Failed to create canned response:', err);
      toast.error('Failed to create quick reply');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteResponse(shortcutName: string) {
    if (!confirm(`Are you sure you want to delete the /${shortcutName} quick reply and all its messages?`)) return;

    try {
      const { error } = await supabase
        .from('canned_responses')
        .delete()
        .eq('account_id', accountId)
        .eq('shortcut', shortcutName);

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
            <form onSubmit={handleAddResponse} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="canned-shortcut" className="text-xs font-semibold">Shortcut Command</Label>
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

              {/* Messages Stack */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Reply Messages</Label>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {messagesList.map((msg, index) => (
                    <div key={index} className="space-y-3 p-3 rounded-lg border border-border bg-muted/10 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-primary">Message #{index + 1}</span>
                        {messagesList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setMessagesList(messagesList.filter((_, i) => i !== index))}
                            className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-0.5"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-[10px]">Text Content</Label>
                        <Textarea
                          placeholder="Type message text..."
                          value={msg.messageText}
                          onChange={(e) => {
                            const newList = [...messagesList];
                            newList[index].messageText = e.target.value;
                            setMessagesList(newList);
                          }}
                          className="bg-muted/50 border-border text-xs min-h-[60px] resize-y"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px]">Media Attachment (Optional)</Label>
                        <select
                          value={msg.mediaType}
                          onChange={(e) => {
                            const newList = [...messagesList];
                            newList[index].mediaType = e.target.value as any;
                            newList[index].mediaUrl = '';
                            setMessagesList(newList);
                          }}
                          className="w-full rounded-md border border-input bg-muted/50 px-2 py-1 text-xs outline-none text-foreground"
                        >
                          <option value="none">No Attachment</option>
                          <option value="image">Photo</option>
                          <option value="video">Video</option>
                          <option value="document">PDF / Document</option>
                          <option value="audio">Audio</option>
                        </select>
                      </div>

                      {msg.mediaType !== 'none' && (
                        <div className="space-y-2 rounded-lg border border-border p-2 bg-muted/10">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-medium text-muted-foreground capitalize">{msg.mediaType} File</span>
                            {msg.mediaUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newList = [...messagesList];
                                  newList[index].mediaUrl = '';
                                  setMessagesList(newList);
                                }}
                                className="text-red-400 hover:text-red-300 flex items-center gap-0.5"
                              >
                                <X className="h-2.5 w-2.5" /> Remove
                              </button>
                            )}
                          </div>
                          {msg.mediaUrl ? (
                            <div className="mt-1 space-y-1.5">
                              <p className="text-[10px] text-emerald-400 font-medium truncate">✓ Attached</p>
                              {msg.mediaType === 'image' && (
                                <img src={msg.mediaUrl} alt="Preview" className="max-h-16 max-w-full rounded border border-border object-contain" />
                              )}
                              {msg.mediaType !== 'image' && (
                                <p className="text-[9px] text-muted-foreground truncate">{msg.mediaUrl}</p>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1">
                              <input
                                type="file"
                                id={`canned-media-file-${index}`}
                                accept={
                                  msg.mediaType === 'image' ? 'image/*' :
                                  msg.mediaType === 'video' ? 'video/*' :
                                  msg.mediaType === 'audio' ? 'audio/*' :
                                  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                }
                                onChange={(e) => void handleMediaUpload(index, e)}
                                disabled={uploadingIndex !== null}
                                className="hidden"
                              />
                              <Label
                                htmlFor={`canned-media-file-${index}`}
                                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[10px] text-muted-foreground hover:bg-muted cursor-pointer"
                              >
                                {uploadingIndex === index ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Paperclip className="h-3 w-3" />
                                    Choose File
                                  </>
                                )}
                              </Label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMessagesList([...messagesList, { messageText: '', mediaType: 'none', mediaUrl: '' }])}
                  className="w-full text-xs border-dashed border-border"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Message Block
                </Button>
              </div>

              <Button
                type="submit"
                disabled={submitting || uploadingIndex !== null}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
                Save Canned Reply
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

            {groupedResponses.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No quick replies defined yet.</p>
            ) : (
              <div className="grid gap-4">
                {groupedResponses.map((group) => (
                  <div key={group.shortcut} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 relative group">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary font-mono">
                        /{group.shortcut}
                      </span>
                      {canEditSettings && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteResponse(group.shortcut)}
                          className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      {group.messages.map((msg, index) => (
                        <div key={msg.id} className="text-xs space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/30">
                          <div className="flex items-center justify-between border-b border-border/10 pb-1">
                            <span className="text-[10px] text-primary font-bold">Message #{index + 1}</span>
                            {msg.media_type && (
                              <span className="inline-flex items-center gap-1 rounded bg-secondary/60 px-1.5 py-0.5 text-[9px] font-medium text-secondary-foreground capitalize">
                                {msg.media_type === 'image' && <ImageIcon className="h-2.5 w-2.5" />}
                                {msg.media_type === 'video' && <Film className="h-2.5 w-2.5" />}
                                {msg.media_type === 'document' && <FileText className="h-2.5 w-2.5" />}
                                {msg.media_type === 'audio' && <Music className="h-2.5 w-2.5" />}
                                {msg.media_type}
                              </span>
                            )}
                          </div>
                          {msg.message_text && (
                            <p className="text-foreground whitespace-pre-line break-words">{msg.message_text}</p>
                          )}
                          {msg.media_url && (
                            <div className="text-[10px] text-muted-foreground truncate pt-1 flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              <a href={msg.media_url} target="_blank" rel="noreferrer" className="underline hover:text-primary truncate">
                                {msg.media_url.split('/').pop()}
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
