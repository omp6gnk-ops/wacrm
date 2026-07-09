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

  // Media attachment states
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document' | 'audio' | 'none'>('none');
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (mediaType === 'none') {
      toast.error('Please select a media type first');
      return;
    }

    const maxBytes = MEDIA_MAX_BYTES_BY_KIND[mediaType];
    if (file.size > maxBytes) {
      toast.error(`File is too large. Max size for ${mediaType} is ${maxBytes / (1024 * 1024)}MB`);
      return;
    }

    setUploadingMedia(true);
    try {
      const { publicUrl } = await uploadAccountMedia('chat-media', file);
      setMediaUrl(publicUrl);
      toast.success('Media uploaded successfully');
    } catch (err: any) {
      console.error('Media upload failed:', err);
      toast.error(err.message || 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  }

  async function loadResponses() {
    if (!accountId) return;
    try {
      const { data, error } = await supabase
        .from('canned_responses')
        .select('id, shortcut, message_text, media_url, media_type, created_at')
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
          message_text: messageText.trim(),
          media_url: mediaType !== 'none' ? mediaUrl : null,
          media_type: mediaType !== 'none' ? mediaType : null,
        });

      if (error) throw error;

      toast.success(`Quick reply /${cleanShortcut} created successfully`);
      setShortcut('');
      setMessageText('');
      setMediaType('none');
      setMediaUrl('');
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

              <div className="space-y-1.5">
                <Label htmlFor="canned-media-type" className="text-xs">Media Attachment (Optional)</Label>
                <select
                  id="canned-media-type"
                  value={mediaType}
                  onChange={(e) => {
                    setMediaType(e.target.value as any);
                    setMediaUrl('');
                  }}
                  className="w-full rounded-md border border-input bg-muted/50 px-3 py-1.5 text-sm outline-none text-foreground"
                >
                  <option value="none">No Attachment</option>
                  <option value="image">Photo</option>
                  <option value="video">Video</option>
                  <option value="document">PDF / Document</option>
                  <option value="audio">Audio</option>
                </select>
              </div>

              {mediaType !== 'none' && (
                <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground capitalize">{mediaType} Upload</span>
                    {mediaUrl && (
                      <button
                        type="button"
                        onClick={() => setMediaUrl('')}
                        className="text-red-400 hover:text-red-300 flex items-center gap-0.5"
                      >
                        <X className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                  {mediaUrl ? (
                    <div className="mt-1 space-y-1.5">
                      <p className="text-[11px] text-emerald-400 font-medium truncate">✓ Media Attached</p>
                      {mediaType === 'image' && (
                        <img src={mediaUrl} alt="Preview" className="max-h-20 max-w-full rounded border border-border object-contain" />
                      )}
                      {mediaType !== 'image' && (
                        <p className="text-[10px] text-muted-foreground truncate">{mediaUrl}</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1">
                      <input
                        type="file"
                        id="canned-media-file"
                        accept={
                          mediaType === 'image' ? 'image/*' :
                          mediaType === 'video' ? 'video/*' :
                          mediaType === 'audio' ? 'audio/*' :
                          'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                        }
                        onChange={handleMediaUpload}
                        disabled={uploadingMedia}
                        className="hidden"
                      />
                      <Label
                        htmlFor="canned-media-file"
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
                      >
                        {uploadingMedia ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Paperclip className="h-3.5 w-3.5" />
                            Choose {mediaType === 'image' ? 'Photo' : mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Audio' : 'Document'}
                          </>
                        )}
                      </Label>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || uploadingMedia}
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
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary font-mono leading-none">
                          /{res.shortcut}
                        </span>
                        {res.media_type && (
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground capitalize">
                            {res.media_type === 'image' && <ImageIcon className="h-2.5 w-2.5" />}
                            {res.media_type === 'video' && <Film className="h-2.5 w-2.5" />}
                            {res.media_type === 'document' && <FileText className="h-2.5 w-2.5" />}
                            {res.media_type === 'audio' && <Music className="h-2.5 w-2.5" />}
                            {res.media_type}
                          </span>
                        )}
                      </div>
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
