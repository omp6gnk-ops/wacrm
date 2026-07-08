'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2, Milestone } from 'lucide-react';

interface CustomStatus {
  id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#10b981', // Emerald/Green
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#f59e0b', // Amber/Yellow
  '#8b5cf6', // Purple
  '#6b7280', // Gray
  '#ec4899', // Pink
];

export function LeadStatusesSettings() {
  const { accountId } = useAuth();
  const supabase = createClient();

  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  async function loadStatuses() {
    if (!accountId) return;
    try {
      const { data, error } = await supabase
        .from('conversation_custom_statuses')
        .select('id, name, color')
        .eq('account_id', accountId)
        .order('name');
      
      if (error) throw error;
      setStatuses(data ?? []);
    } catch (err: any) {
      console.error('Failed to load custom statuses:', err);
      toast.error('Failed to load lead statuses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatuses();
  }, [accountId]);

  async function handleAddStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Status name is required');
      return;
    }
    if (statuses.some((s) => s.name.toLowerCase() === name.trim().toLowerCase())) {
      toast.error('A status with this name already exists');
      return;
    }
    if (!accountId) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('conversation_custom_statuses')
        .insert({
          account_id: accountId,
          name: name.trim(),
          color: selectedColor
        });

      if (error) throw error;

      toast.success(`Status "${name.trim()}" created`);
      setName('');
      await loadStatuses();
    } catch (err: any) {
      console.error('Failed to create status:', err);
      toast.error('Failed to create status');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteStatus(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete the "${name}" status? Contacts with this status will be reset.`)) return;

    try {
      const { error } = await supabase
        .from('conversation_custom_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`Deleted status "${name}"`);
      await loadStatuses();
    } catch (err: any) {
      console.error('Failed to delete status:', err);
      toast.error('Failed to delete status');
    }
  }

  if (loading) {
    return null; // Let the main tags/fields loaders handle the spinner
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Milestone className="h-5 w-5 text-primary" />
          Lead Statuses (Stages)
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Define custom stages (e.g. Interested, Follow-up, Closed) with colors that agents can assign to active chat conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Form */}
        <form onSubmit={handleAddStatus} className="flex flex-col sm:flex-row items-end gap-3 bg-muted/20 border border-border p-3.5 rounded-lg">
          <div className="flex-1 space-y-1 w-full">
            <Label htmlFor="status-name" className="text-xs">Status Name</Label>
            <Input
              id="status-name"
              placeholder="e.g. Interested"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted border-border text-sm"
            />
          </div>

          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Color Badge</Label>
            <div className="flex flex-wrap items-center gap-2 h-9">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    selectedColor === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 w-full sm:w-auto shrink-0"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add Status
          </Button>
        </form>

        {/* Existing Statuses List */}
        {statuses.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No custom lead statuses defined yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2.5 pt-2">
            {statuses.map((status) => (
              <span
                key={status.id}
                className="inline-flex items-center gap-2 rounded-full border border-border pl-3 pr-1.5 py-1 text-xs font-semibold text-foreground bg-muted/30"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
                <button
                  type="button"
                  onClick={() => handleDeleteStatus(status.id, status.name)}
                  className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10 p-0.5 rounded transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
