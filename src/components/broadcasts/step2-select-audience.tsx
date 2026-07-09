'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomField, Tag } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Users,
  Tags,
  Filter,
  Upload,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
} from 'lucide-react';
import { parseContactCsv, parseCsvLine } from '@/lib/contacts/parse-contact-csv';

type AudienceType = 'all' | 'tags' | 'manual' | 'custom_field' | 'csv';
type CustomFieldOperator = 'is' | 'is_not' | 'contains';

interface CustomFieldFilter {
  fieldId: string;
  operator: CustomFieldOperator;
  value: string;
}

interface AudienceConfig {
  type: AudienceType;
  tagIds?: string[];
  customField?: CustomFieldFilter;
  csvContacts?: { phone: string; name?: string }[];
  excludeTagIds?: string[];
}

interface Step2Props {
  audience: AudienceConfig;
  onUpdate: (audience: AudienceConfig) => void;
  onNext: () => void;
  onBack: () => void;
}

const audienceOptions: {
  type: AudienceType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    type: 'all',
    label: 'All Contacts',
    description: 'Send to every contact in your database',
    icon: Users,
  },
  {
    type: 'manual',
    label: 'Copy & Paste',
    description: 'Type or copy-paste phone numbers manually',
    icon: FileText,
  },
  {
    type: 'custom_field',
    label: 'Custom Field',
    description: 'Filter by a custom field value',
    icon: Filter,
  },
  {
    type: 'csv',
    label: 'Upload CSV',
    description: 'Upload a list of phone numbers',
    icon: Upload,
  },
];

const OPERATOR_OPTIONS: { value: CustomFieldOperator; label: string }[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
];

export function Step2SelectAudience({
  audience,
  onUpdate,
  onNext,
  onBack,
}: Step2Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const getPastedString = useCallback((contacts: { phone: string; name?: string; variables?: Record<string, string> }[]) => {
    return contacts
      .map((c) => {
        const vars = c.variables || {};
        const keys = Object.keys(vars).sort((a, b) => {
          const an = Number(a.replace(/\D/g, ''));
          const bn = Number(b.replace(/\D/g, ''));
          if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
          return a.localeCompare(b);
        });
        if (keys.length > 0) {
          return keys.map(k => vars[k]).join(', ');
        }
        return c.name ? `${c.phone}, ${c.name}` : c.phone;
      })
      .join('\n');
  }, []);

  const [pastedText, setPastedText] = useState(() =>
    getPastedString(audience.csvContacts ?? [])
  );

  useEffect(() => {
    if (audience.type === 'manual') {
      const current = getPastedString(audience.csvContacts ?? []);
      if (current !== pastedText) {
        setPastedText(current);
      }
    }
  }, [audience.csvContacts, audience.type, getPastedString, pastedText]);

  // Tags are used both by the primary "Filter by Tags" audience type
  // AND by the exclude-list below — so always load once on mount.
  useEffect(() => {
    async function fetchTags() {
      setLoadingTags(true);
      try {
        const supabase = createClient();
        const { data } = await supabase.from('tags').select('*').order('name');
        setTags(data ?? []);
      } finally {
        setLoadingTags(false);
      }
    }
    fetchTags();
  }, []);

  // Lazy-load custom fields only when that audience type is active.
  useEffect(() => {
    if (audience.type !== 'custom_field') return;
    async function fetchFields() {
      setLoadingFields(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('custom_fields')
          .select('*')
          .order('field_name');
        setCustomFields(data ?? []);
      } finally {
        setLoadingFields(false);
      }
    }
    fetchFields();
  }, [audience.type]);

  const fetchEstimatedCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const supabase = createClient();

      // Base query — produces the superset before exclude is applied.
      let baseIds: Set<string> | null = null; // null means "all contacts"

      if (audience.type === 'all') {
        // Handled below — full-table count adjusted by excludes.
      } else if (
        audience.type === 'custom_field' &&
        audience.customField?.fieldId &&
        audience.customField.value
      ) {
        const { fieldId, operator, value } = audience.customField;
        let q = supabase
          .from('contact_custom_values')
          .select('contact_id')
          .eq('custom_field_id', fieldId);
        if (operator === 'is') q = q.eq('value', value);
        else if (operator === 'is_not') q = q.neq('value', value);
        else q = q.ilike('value', `%${value}%`);
        const { data } = await q;
        baseIds = new Set((data ?? []).map((r) => r.contact_id));
      } else if (
        (audience.type === 'csv' || audience.type === 'manual') &&
        audience.csvContacts &&
        audience.csvContacts.length > 0
      ) {
        setEstimatedCount(audience.csvContacts.length);
        return;
      } else {
        // Partially-configured audience — wait for the user to finish.
        setEstimatedCount(null);
        return;
      }

      // Apply exclude tags
      let excludeSet: Set<string> | null = null;
      if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
        const { data: excludeRows } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', audience.excludeTagIds);
        excludeSet = new Set((excludeRows ?? []).map((r) => r.contact_id));
      }

      if (baseIds) {
        const effective = [...baseIds].filter(
          (id) => !excludeSet?.has(id),
        );
        setEstimatedCount(effective.length);
      } else {
        // "All" — fetch the total, then subtract exclude set if any.
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true });
        const total = count ?? 0;
        setEstimatedCount(excludeSet ? Math.max(0, total - excludeSet.size) : total);
      }
    } finally {
      setLoadingCount(false);
    }
  }, [
    audience.type,
    audience.tagIds,
    audience.customField,
    audience.csvContacts,
    audience.excludeTagIds,
  ]);

  useEffect(() => {
    fetchEstimatedCount();
  }, [fetchEstimatedCount]);

  function toggleTag(tagId: string) {
    const current = audience.tagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, tagIds: updated });
  }

  function toggleExcludeTag(tagId: string) {
    const current = audience.excludeTagIds ?? [];
    const updated = current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId];
    onUpdate({ ...audience, excludeTagIds: updated });
  }

  function updateCustomField(patch: Partial<CustomFieldFilter>) {
    const prev = audience.customField ?? {
      fieldId: '',
      operator: 'is' as CustomFieldOperator,
      value: '',
    };
    onUpdate({ ...audience, customField: { ...prev, ...patch } });
  }

  const isValid =
    audience.type === 'all' ||
    (audience.type === 'custom_field' &&
      !!audience.customField?.fieldId &&
      audience.customField.value.length > 0) ||
    ((audience.type === 'csv' || audience.type === 'manual') &&
      audience.csvContacts &&
      audience.csvContacts.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Select Audience</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose who will receive this broadcast.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {audienceOptions.map((option) => {
          const isSelected = audience.type === option.type;
          const Icon = option.icon;
          return (
            <button
              key={option.type}
              onClick={() =>
                onUpdate({
                  ...audience,
                  type: option.type,
                  tagIds: undefined,
                  customField:
                    option.type === 'custom_field'
                      ? audience.customField
                      : undefined,
                  csvContacts:
                    (option.type === 'csv' || option.type === 'manual')
                      ? audience.csvContacts
                      : undefined,
                })
              }
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-card/50 hover:border-border'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {audience.type === 'manual' && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 animate-in fade-in-50 duration-200">
          <p className="text-sm font-medium text-foreground">Copy & Paste Phone Numbers</p>
          <textarea
            rows={6}
            placeholder="Type or paste phone numbers here... (one per line or separated by commas)"
            value={pastedText}
            onChange={(e) => {
              const val = e.target.value;
              setPastedText(val);
              const lines = val.split('\n');
              const parsed = lines
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .map((line) => {
                  const parts = line.includes('\t') 
                    ? line.split('\t') 
                    : line.split(/[,;]/);
                  
                  const phone = parts[0]?.trim() || '';
                  const name = parts[1]?.trim() || undefined;

                  const rowVars: Record<string, string> = {};
                  parts.forEach((part, idx) => {
                    rowVars[`Column ${idx + 1}`] = part.trim();
                  });

                  return {
                    phone,
                    name,
                    variables: rowVars
                  };
                })
                .filter(c => c.phone.length > 0);

              onUpdate({
                ...audience,
                csvContacts: parsed,
              });
            }}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary font-mono leading-relaxed"
          />
          <p className="text-xs text-muted-foreground leading-normal">
            Aap ek baar mein multiple phone numbers paste kar sakte hain (separated by newlines, commas, or semicolons). Numbers automatically parse hokar select ho jayenge.
          </p>
        </div>
      )}

      {audience.type === 'custom_field' && (
        <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
          <p className="text-sm font-medium text-foreground">Custom Field Filter</p>
          {loadingFields ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : customFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No custom fields defined. Create one in Settings → Custom Fields.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
              <select
                value={audience.customField?.fieldId ?? ''}
                onChange={(e) => updateCustomField({ fieldId: e.target.value })}
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Select field…</option>
                {customFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.field_name}
                  </option>
                ))}
              </select>
              <select
                value={audience.customField?.operator ?? 'is'}
                onChange={(e) =>
                  updateCustomField({
                    operator: e.target.value as CustomFieldOperator,
                  })
                }
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {OPERATOR_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={audience.customField?.value ?? ''}
                onChange={(e) => updateCustomField({ value: e.target.value })}
                placeholder="Value"
                className="h-9 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
        </div>
      )}

      {audience.type === 'csv' && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 animate-in fade-in-50 duration-200">
          <p className="text-sm font-medium text-foreground">Upload CSV File</p>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 bg-muted/30 hover:bg-muted/50 transition-colors">
            <input
              type="file"
              accept=".csv"
              id="broadcast-csv-upload"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                try {
                  const text = await file.text();
                  const lines = text.trim().split(/\r?\n/);
                  if (lines.length < 2) {
                    alert("CSV is empty or missing content.");
                    return;
                  }

                  const headers = lines[0]
                    .split(',')
                    .map((h) => h.trim().toLowerCase().replace(/["']/g, ''));

                  const phoneIdx = headers.findIndex((h) => h === 'phone');
                  const activePhoneIdx = phoneIdx >= 0 ? phoneIdx : 0;
                  
                  const nameIdx = headers.findIndex((h) => h === 'name');
                  const activeNameIdx = nameIdx >= 0 ? nameIdx : -1;

                  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/["']/g, ''));

                  const parsed = [];
                  for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const values = parseCsvLine(line);
                    const phone = values[activePhoneIdx]?.replace(/["']/g, '').trim();
                    if (!phone) continue;

                    const name = activeNameIdx >= 0 && activeNameIdx < values.length
                      ? values[activeNameIdx]?.replace(/["']/g, '').trim()
                      : undefined;

                    const rowVars: Record<string, string> = {};
                    rawHeaders.forEach((header, idx) => {
                      if (idx < values.length) {
                        rowVars[header] = values[idx]?.replace(/["']/g, '').trim() || '';
                      }
                    });

                    parsed.push({
                      phone,
                      name: name || undefined,
                      variables: rowVars,
                    });
                  }

                  if (parsed.length === 0) {
                    alert("No valid contacts found in CSV.");
                    return;
                  }

                  onUpdate({
                    ...audience,
                    csvContacts: parsed,
                  });
                } catch (err) {
                  alert("Failed to parse CSV file.");
                }
              }}
            />
            <label htmlFor="broadcast-csv-upload" className="cursor-pointer flex flex-col items-center gap-2 w-full text-center">
              <Upload className="h-8 w-8 text-primary" />
              <span className="text-sm text-foreground font-medium">Click to upload CSV</span>
              <span className="text-xs text-muted-foreground font-mono">Header should include "phone" (optional: "name" or other custom columns)</span>
            </label>
          </div>

          {audience.csvContacts && audience.csvContacts.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground bg-muted/50 border border-border p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>
                  Successfully parsed <span className="font-semibold text-foreground">{audience.csvContacts.length}</span> contacts.
                </span>
              </div>
              <button
                type="button"
                onClick={() => onUpdate({ ...audience, csvContacts: undefined })}
                className="text-red-400 hover:text-red-300 font-medium"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* Exclude list — applies regardless of audience type */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <X className="h-4 w-4 text-red-400" />
          <p className="text-sm font-medium text-foreground">
            Exclude contacts with these tags
          </p>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const isExcluded = audience.excludeTagIds?.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleExcludeTag(tag.id)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    isExcluded
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : 'border-border bg-muted text-muted-foreground hover:border-border'
                  }`}
                >
                  <span
                    className="mr-1.5 h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Audience Summary */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Audience Summary</p>
        {loadingCount ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Calculating…</span>
          </div>
        ) : estimatedCount !== null ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              {estimatedCount.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">estimated recipients</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Select an audience type to see the estimate.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-border text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
