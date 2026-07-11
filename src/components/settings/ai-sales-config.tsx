'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, CheckCircle2, Trash2, Eye, EyeOff, ShieldCheck, PlayCircle, Settings, HelpCircle, UserCheck, Tag, Info, Database, ShoppingBag, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SettingsPanelHead } from './settings-panel-head';
import { AiKnowledgeCard } from './ai-knowledge';
import { AI_PROVIDER_DEFAULT_MODEL } from '@/lib/ai/defaults';
import type { AiProvider, CollectField } from '@/lib/ai/types';
import type { Tag as DbTag, ConversationCustomStatus } from '@/types';

const MASKED_KEY = '••••••••••••••••';

const KEY_PLACEHOLDER: Record<AiProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
};

export function AiSalesConfig() {
  const { accountId, accountRole } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Connection config
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [model, setModel] = useState(AI_PROVIDER_DEFAULT_MODEL.openai);
  const [apiKey, setApiKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [embeddingsKey, setEmbeddingsKey] = useState('');
  const [embeddingsKeyEdited, setEmbeddingsKeyEdited] = useState(false);
  const [hasStoredEmbeddingsKey, setHasStoredEmbeddingsKey] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(false);
  
  // Triggers & limits
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [maxPerConversation, setMaxPerConversation] = useState(15);
  const [aiTakeoverMinutes, setAiTakeoverMinutes] = useState(5);
  const [aiReplyLimitResetMinutes, setAiReplyLimitResetMinutes] = useState(240);
  const [coexistWithAutomations, setCoexistWithAutomations] = useState(true);
  const [triggerOnButtonReply, setTriggerOnButtonReply] = useState(true);

  // Sales Mode
  const [salesModeEnabled, setSalesModeEnabled] = useState(false);
  const [salesSystemPrompt, setSalesSystemPrompt] = useState('');
  const [collectFields, setCollectFields] = useState<CollectField[]>([]);
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');

  // Razorpay
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [razorpayKeySecretEdited, setRazorpayKeySecretEdited] = useState(false);
  const [hasStoredRazorpayKeySecret, setHasStoredRazorpayKeySecret] = useState(false);
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState('');

  // Agent Scope Restrictions
  const [restrictToAgentIds, setRestrictToAgentIds] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<{user_id: string; full_name: string; account_role: string}[]>([]);

  // Storage Settings
  const [storageProvider, setStorageProvider] = useState<'supabase' | 'cloudinary' | 'mega' | 'google_drive'>('supabase');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState('');
  const [cloudinaryApiSecretEdited, setCloudinaryApiSecretEdited] = useState(false);
  const [hasStoredCloudinaryApiSecret, setHasStoredCloudinaryApiSecret] = useState(false);

  // Products Catalog
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductFileUrl, setNewProductFileUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    const total = Math.ceil(products.length / itemsPerPage);
    if (currentPage > total && total > 0) {
      setCurrentPage(total);
    }
  }, [products.length, currentPage]);

  // Auto-Categorization
  const [autoCategorizeEnabled, setAutoCategorizeEnabled] = useState(false);
  const [categorizeAfterReplies, setCategorizeAfterReplies] = useState(3);
  const [interestedTagId, setInterestedTagId] = useState<string | null>(null);
  const [notInterestedTagId, setNotInterestedTagId] = useState<string | null>(null);
  const [interestedStatusId, setInterestedStatusId] = useState<string | null>(null);
  const [notInterestedStatusId, setNotInterestedStatusId] = useState<string | null>(null);

  // Account tags, custom fields, and lead statuses lists
  const [accountTags, setAccountTags] = useState<any[]>([]);
  const [accountCustomFields, setAccountCustomFields] = useState<any[]>([]);
  const [accountStatuses, setAccountStatuses] = useState<any[]>([]);

  const loadedAccountIdRef = useRef<string | null>(null);

  // Fetch team members for agent restriction checkboxes
  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/account/members');
      if (res.ok) {
        const data = await res.json();
        setTeamMembers((data.members ?? []).filter((m: any) => m.account_role !== 'viewer'));
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  }, []);

  // Fetch account reference tables (tags, custom fields, lead statuses)
  const fetchReferenceData = useCallback(async () => {
    if (!accountId) return;
    try {
      // 1. Fetch tags
      const { data: tags } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('account_id', accountId)
        .order('name');
      setAccountTags(tags || []);

      // 2. Fetch custom fields
      const { data: fields } = await supabase
        .from('custom_fields')
        .select('id, field_name')
        .eq('account_id', accountId)
        .order('field_name');
      setAccountCustomFields(fields || []);

      // 3. Fetch custom statuses
      const { data: statuses } = await supabase
        .from('conversation_custom_statuses')
        .select('id, name, color')
        .eq('account_id', accountId)
        .order('name');
      setAccountStatuses(statuses || []);
    } catch (err) {
      console.error('Failed to load settings metadata:', err);
    }
  }, [accountId, supabase]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to load AI configuration');
        return;
      }
      if (data.configured) {
        setConfigured(true);
        setProvider(data.provider);
        setModel(data.model);
        setSystemPrompt(data.system_prompt ?? '');
        setIsActive(data.is_active);
        
        // Triggers
        setAutoReplyEnabled(data.auto_reply_enabled);
        setMaxPerConversation(data.auto_reply_max_per_conversation ?? 15);
        setAiTakeoverMinutes(data.ai_takeover_minutes ?? 5);
        setAiReplyLimitResetMinutes(data.ai_reply_limit_reset_minutes ?? 240);
        setCoexistWithAutomations(data.coexist_with_automations !== false);
        setTriggerOnButtonReply(data.trigger_on_button_reply !== false);

        // Sales Mode
        setSalesModeEnabled(data.sales_mode_enabled === true);
        setSalesSystemPrompt(data.sales_system_prompt ?? '');
        setCollectFields(data.collect_fields || []);
        setPaymentQrUrl(data.payment_qr_url ?? '');
        setPaymentInstructions(data.payment_instructions ?? '');

        // Auto-Categorization
        setAutoCategorizeEnabled(data.auto_categorize_enabled === true);
        setCategorizeAfterReplies(data.categorize_after_replies ?? 3);
        setInterestedTagId(data.interested_tag_id || null);
        setNotInterestedTagId(data.not_interested_tag_id || null);
        setInterestedStatusId(data.interested_status_id || null);
        setNotInterestedStatusId(data.not_interested_status_id || null);

        // Razorpay
        setRazorpayEnabled(data.razorpay_enabled === true);
        setRazorpayKeyId(data.razorpay_key_id ?? '');
        setHasStoredRazorpayKeySecret(Boolean(data.has_razorpay_key_secret));
        setRazorpayKeySecret(data.has_razorpay_key_secret ? MASKED_KEY : '');
        setRazorpayKeySecretEdited(false);
        setRazorpayWebhookSecret(data.razorpay_webhook_secret ?? '');

        // Agent restriction
        setRestrictToAgentIds(Array.isArray(data.restrict_to_agent_ids) ? data.restrict_to_agent_ids : []);

        // Storage provider
        setStorageProvider(data.storage_provider ?? 'supabase');
        setCloudinaryCloudName(data.cloudinary_cloud_name ?? '');
        setCloudinaryApiKey(data.cloudinary_api_key ?? '');
        setHasStoredCloudinaryApiSecret(Boolean(data.has_cloudinary_api_secret));
        setCloudinaryApiSecret(data.has_cloudinary_api_secret ? MASKED_KEY : '');
        setCloudinaryApiSecretEdited(false);

        setHasStoredKey(Boolean(data.has_key));
        setApiKey(data.has_key ? MASKED_KEY : '');
        setKeyEdited(false);
        setHasStoredEmbeddingsKey(Boolean(data.has_embeddings_key));
        setEmbeddingsKey(data.has_embeddings_key ? MASKED_KEY : '');
        setEmbeddingsKeyEdited(false);
      }
    } catch {
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  // Products loader
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/ai/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const handleAddProduct = async () => {
    if (!newProductName.trim()) {
      toast.error('Product name is required');
      return;
    }
    const price = Number(newProductPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Invalid price');
      return;
    }
    if (!newProductFileUrl.trim()) {
      toast.error('File link or upload is required');
      return;
    }

    try {
      const res = await fetch('/api/ai/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName.trim(),
          price,
          file_url: newProductFileUrl.trim(),
        })
      });
      if (res.ok) {
        toast.success('Product added successfully!');
        setNewProductName('');
        setNewProductPrice('');
        setNewProductFileUrl('');
        void fetchProducts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add product');
      }
    } catch {
      toast.error('Failed to add product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/ai/products?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Product deleted.');
        void fetchProducts();
      } else {
        toast.error('Failed to delete product');
      }
    } catch {
      toast.error('Failed to delete product');
    }
  };

  const handleBulkCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text !== 'string') return;

      try {
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          toast.error('CSV file is empty');
          return;
        }

        // Clean headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
        
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('title') || h === 'product');
        const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h === 'cost' || h === 'amount');
        const linkIdx = headers.findIndex(h => h.includes('link') || h.includes('url') || h.includes('file'));

        if (nameIdx === -1 || priceIdx === -1 || linkIdx === -1) {
          toast.error('CSV must contain column headers for "name", "price", and "link" (file URL)');
          return;
        }

        const parsedProducts: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Parse line handling quotes
          const values = [];
          let current = '';
          let inQuotes = false;
          for (let charIdx = 0; charIdx < line.length; charIdx++) {
            const char = line[charIdx];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim().replace(/^["']|["']$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^["']|["']$/g, ''));

          if (values.length <= Math.max(nameIdx, priceIdx, linkIdx)) continue;

          const name = values[nameIdx].trim();
          const priceStr = values[priceIdx].replace(/[^\d.]/g, ''); // Strip currency symbols
          const price = Number(priceStr);
          const file_url = values[linkIdx].trim();

          if (name && !isNaN(price) && file_url) {
            parsedProducts.push({ name, price, file_url });
          }
        }

        if (parsedProducts.length === 0) {
          toast.error('No valid products found in CSV');
          return;
        }

        const res = await fetch('/api/ai/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedProducts)
        });

        if (res.ok) {
          toast.success(`Successfully imported ${parsedProducts.length} products!`);
          setCurrentPage(1);
          void fetchProducts();
        } else {
          const errData = await res.json();
          toast.error(errData.error || 'Failed to import products');
        }

      } catch (err: any) {
        toast.error('Error reading CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      if (storageProvider === 'supabase') {
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { data, error } = await supabase.storage
          .from('product-delivery-files')
          .upload(`public/${fileName}`, file, {
            cacheControl: '3600',
            upsert: true
          });
        if (error) throw error;
        
        const { data: publicUrlData } = supabase.storage
          .from('product-delivery-files')
          .getPublicUrl(`public/${fileName}`);
        
        setNewProductFileUrl(publicUrlData.publicUrl);
        toast.success('File uploaded to Supabase Storage!');
      } else if (storageProvider === 'cloudinary') {
        const sigRes = await fetch('/api/ai/products/cloudinary-sign');
        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || 'Failed to get Cloudinary signature');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', sigData.api_key);
        formData.append('timestamp', sigData.timestamp.toString());
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/auto/upload`, {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Cloudinary upload failed');

        setNewProductFileUrl(uploadData.secure_url || uploadData.url);
        toast.success('File uploaded to Cloudinary!');
      }
    } catch (err: any) {
      console.error('File upload failed:', err);
      toast.error(`File upload failed: ${err.message || 'Check storage configurations'}`);
    } finally {
      setUploadingFile(false);
    }
  };

  // Load team members and products on mount
  useEffect(() => {
    fetchTeamMembers();
    void fetchProducts();
  }, [fetchTeamMembers, fetchProducts]);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchConfig();
    void fetchReferenceData();
  }, [accountId, fetchConfig, fetchReferenceData]);

  const handleProviderChange = (next: AiProvider) => {
    setProvider(next);
    const isDefaultModel =
      model === AI_PROVIDER_DEFAULT_MODEL.openai ||
      model === AI_PROVIDER_DEFAULT_MODEL.anthropic ||
      model.trim() === '';
    if (isDefaultModel) setModel(AI_PROVIDER_DEFAULT_MODEL[next]);
  };

  const keyPayload = () => (keyEdited ? apiKey.trim() : undefined);
  const embeddingsKeyPayload = () =>
    embeddingsKeyEdited ? embeddingsKey.trim() || null : undefined;

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          api_key: keyPayload(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Connection verified successfully!');
      } else {
        toast.error(data.error ?? 'Invalid API key or model.');
      }
    } catch {
      toast.error('API key verification failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          api_key: keyPayload(),
          embeddings_api_key: embeddingsKeyPayload(),
          system_prompt: systemPrompt.trim() || null,
          is_active: isActive,
          auto_reply_enabled: autoReplyEnabled,
          auto_reply_max_per_conversation: maxPerConversation,
          ai_takeover_minutes: aiTakeoverMinutes,
          ai_reply_limit_reset_minutes: aiReplyLimitResetMinutes,
          coexist_with_automations: coexistWithAutomations,
          trigger_on_button_reply: triggerOnButtonReply,
          sales_mode_enabled: salesModeEnabled,
          sales_system_prompt: salesSystemPrompt.trim() || null,
          collect_fields: collectFields,
          auto_categorize_enabled: autoCategorizeEnabled,
          categorize_after_replies: categorizeAfterReplies,
          interested_tag_id: interestedTagId,
          not_interested_tag_id: notInterestedTagId,
          interested_status_id: interestedStatusId,
          not_interested_status_id: notInterestedStatusId,
          payment_qr_url: paymentQrUrl.trim() || null,
          payment_instructions: paymentInstructions.trim() || null,
          restrict_to_agent_ids: restrictToAgentIds,
          razorpay_enabled: razorpayEnabled,
          razorpay_key_id: razorpayKeyId.trim() || null,
          razorpay_key_secret: razorpayKeySecretEdited ? (razorpayKeySecret.trim() || null) : undefined,
          razorpay_webhook_secret: razorpayWebhookSecret.trim() || null,
          storage_provider: storageProvider,
          cloudinary_cloud_name: cloudinaryCloudName.trim() || null,
          cloudinary_api_key: cloudinaryApiKey.trim() || null,
          cloudinary_api_secret: cloudinaryApiSecretEdited ? (cloudinaryApiSecret.trim() || null) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('AI Sales Agent config saved!');
        setConfigured(true);
        setKeyEdited(false);
        setEmbeddingsKeyEdited(false);
        if (apiKey) setHasStoredKey(true);
        if (embeddingsKey) setHasStoredEmbeddingsKey(true);
      } else {
        toast.error(data.error ?? 'Failed to save configuration.');
      }
    } catch {
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to disable and delete the AI agent configuration?')) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/ai/config', { method: 'DELETE' });
      if (res.ok) {
        toast.success('AI Agent configuration removed.');
        setConfigured(false);
        setApiKey('');
        setEmbeddingsKey('');
        setSystemPrompt('');
        setIsActive(false);
        setAutoReplyEnabled(false);
        setSalesModeEnabled(false);
        setSalesSystemPrompt('');
        setCollectFields([]);
        setPaymentQrUrl('');
        setPaymentInstructions('');
        setRazorpayEnabled(false);
        setRazorpayKeyId('');
        setRazorpayKeySecret('');
        setRazorpayWebhookSecret('');
        setRestrictToAgentIds([]);
        setStorageProvider('supabase');
        setCloudinaryCloudName('');
        setCloudinaryApiKey('');
        setCloudinaryApiSecret('');
        setCloudinaryApiSecretEdited(false);
        setHasStoredCloudinaryApiSecret(false);
        setHasStoredKey(false);
        setHasStoredEmbeddingsKey(false);
      } else {
        toast.error('Failed to remove configuration.');
      }
    } catch {
      toast.error('An error occurred during removal.');
    } finally {
      setRemoving(false);
    }
  };

  const handleToggleCollectField = (fieldKey: string, required: boolean = false) => {
    const exists = collectFields.some((f) => f.field === fieldKey);
    if (exists) {
      setCollectFields(collectFields.filter((f) => f.field !== fieldKey));
    } else {
      setCollectFields([...collectFields, { field: fieldKey, required }]);
    }
  };

  const handleToggleRequiredField = (fieldKey: string) => {
    setCollectFields(
      collectFields.map((f) => (f.field === fieldKey ? { ...f, required: !f.required } : f))
    );
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const disabled = !canEdit || saving || testing || removing;

  return (
    <div className="space-y-6">
      <SettingsPanelHead
        title="AI Sales Agent"
        description="Configure your autonomous AI Sales Agent to reply, qualify leads, and close deals via WhatsApp."
      />

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="connection" className="rounded-lg py-2 font-medium">Connection</TabsTrigger>
          <TabsTrigger value="triggers" className="rounded-lg py-2 font-medium">Triggers & Limits</TabsTrigger>
          <TabsTrigger value="sales" className="rounded-lg py-2 font-medium">Sales Agent</TabsTrigger>
          <TabsTrigger value="categorization" className="rounded-lg py-2 font-medium">Categorization</TabsTrigger>
          <TabsTrigger value="kb" className="rounded-lg py-2 font-medium">Knowledge Base</TabsTrigger>
        </TabsList>

        {/* TAB 1: CONNECTION */}
        <TabsContent value="connection" className="mt-4 space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                LLM Provider Connection
              </CardTitle>
              <CardDescription>
                Bring your own key to connect directly to your chosen AI model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="provider">AI Provider</Label>
                <Select
                  disabled={disabled}
                  value={provider}
                  onValueChange={(val) => handleProviderChange(val as AiProvider)}
                >
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="model">Model ID</Label>
                <Input
                  id="model"
                  disabled={disabled}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gpt-4o-mini"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="apiKey" className="flex items-center justify-between">
                  <span>API Key</span>
                  {hasStoredKey && !keyEdited && (
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Key Stored
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="apiKey"
                    type={showKey ? 'text' : 'password'}
                    disabled={disabled}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyEdited(true);
                    }}
                    placeholder={KEY_PLACEHOLDER[provider]}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-2 pt-2">
                <Label htmlFor="embeddingsKey" className="flex items-center justify-between">
                  <span>OpenAI Embeddings Key (Optional)</span>
                  {hasStoredEmbeddingsKey && !embeddingsKeyEdited && (
                    <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Key Stored
                    </span>
                  )}
                </Label>
                <Input
                  id="embeddingsKey"
                  type="password"
                  disabled={disabled}
                  value={embeddingsKey}
                  onChange={(e) => {
                    setEmbeddingsKey(e.target.value);
                    setEmbeddingsKeyEdited(true);
                  }}
                  placeholder="sk-..."
                />
                <p className="text-[11px] text-muted-foreground">
                  Required only if you use Anthropic chat but want semantic knowledge search (OpenAI text-embedding-3-small).
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled || !apiKey}
                  onClick={handleTest}
                  className="flex items-center gap-1.5"
                >
                  {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: TRIGGERS & LIMITS */}
        <TabsContent value="triggers" className="mt-4 space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" />
                Activation Triggers & Limits
              </CardTitle>
              <CardDescription>
                Define when the AI steps in and control its response limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base font-semibold">Enable AI Assistant Master Switch</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Enables the AI engine for manual drafting in the inbox composer.
                  </p>
                </div>
                <Switch
                  disabled={disabled}
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base font-semibold">Auto-Reply to Inbound Messages</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Let the AI reply automatically to customers when eligible.
                  </p>
                </div>
                <Switch
                  disabled={disabled}
                  checked={autoReplyEnabled}
                  onCheckedChange={setAutoReplyEnabled}
                />
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base font-semibold">Work alongside Automations</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Allow AI to reply even if active Message/Keyword automations exist for the workspace.
                  </p>
                </div>
                <Switch
                  disabled={disabled || !autoReplyEnabled}
                  checked={coexistWithAutomations}
                  onCheckedChange={setCoexistWithAutomations}
                />
              </div>

              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base font-semibold">Trigger on Campaign Button Tap</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Allow AI to take over when a customer clicks a quick-reply button from a campaign broadcast.
                  </p>
                </div>
                <Switch
                  disabled={disabled || !autoReplyEnabled}
                  checked={triggerOnButtonReply}
                  onCheckedChange={setTriggerOnButtonReply}
                />
              </div>

              <div className="grid gap-2 border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="takeover" className="font-semibold">Human Agent Takeover Delay</Label>
                  <span className="text-sm font-medium bg-secondary px-2.5 py-0.5 rounded-full text-secondary-foreground">{aiTakeoverMinutes} minutes</span>
                </div>
                <input
                  id="takeover"
                  type="range"
                  min="0"
                  max="60"
                  disabled={disabled || !autoReplyEnabled}
                  value={aiTakeoverMinutes}
                  onChange={(e) => setAiTakeoverMinutes(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary"
                />
                <p className="text-[11px] text-muted-foreground">
                  If a human agent replied before, AI will wait this long for a human response before taking over. Set to 0 for instant AI reply on all messages.
                </p>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maxReplies" className="font-semibold">Max Auto-Replies per Conversation</Label>
                  <span className="text-sm font-medium bg-secondary px-2.5 py-0.5 rounded-full text-secondary-foreground">{maxPerConversation} replies</span>
                </div>
                <input
                  id="maxReplies"
                  type="range"
                  min="1"
                  max="50"
                  disabled={disabled || !autoReplyEnabled}
                  value={maxPerConversation}
                  onChange={(e) => setMaxPerConversation(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary"
                />
                <p className="text-[11px] text-muted-foreground">
                  The AI agent will stand down after this many responses until a human agent replies to reset the limit.
                </p>
              </div>

              <div className="grid gap-2 pt-2 border-t border-border/40 mt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="replyLimitReset" className="font-semibold">Auto-Reset Reply Limit Cooldown</Label>
                  <span className="text-sm font-semibold bg-secondary px-2.5 py-0.5 rounded-full text-secondary-foreground text-brand-500">
                    {aiReplyLimitResetMinutes >= 60 
                      ? `${Math.floor(aiReplyLimitResetMinutes / 60)}h ${aiReplyLimitResetMinutes % 60}m` 
                      : `${aiReplyLimitResetMinutes} minutes`}
                  </span>
                </div>
                <input
                  id="replyLimitReset"
                  type="range"
                  min="5"
                  max="1440"
                  step="5"
                  disabled={disabled || !autoReplyEnabled}
                  value={aiReplyLimitResetMinutes}
                  onChange={(e) => setAiReplyLimitResetMinutes(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary"
                />
                <p className="text-[11px] text-muted-foreground">
                  If the conversation is inactive for this long, the reply limit counter resets back to 0. (Set to 240m for 4 hours, or 1440m for 24 hours).
                </p>
              </div>

              {/* AGENT SCOPE RESTRICTION */}
              <div className="grid gap-2 pt-4 border-t border-border/40 mt-4">
                <Label className="font-semibold text-base">Restrict AI to Specific Assigned Agents</Label>
                <p className="text-[12px] text-muted-foreground pb-2">
                  Select which agents' chats the main AI should respond to. If none are selected, AI responds to all eligible chats.
                </p>
                <div className="grid grid-cols-2 gap-2 border border-border/60 rounded-xl p-3 bg-muted/20 max-h-[200px] overflow-y-auto">
                  {/* Unassigned chats option */}
                  <div className="flex items-center gap-2 p-1.5">
                    <Checkbox
                      id="restrict-unassigned"
                      disabled={disabled}
                      checked={restrictToAgentIds.includes('unassigned')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRestrictToAgentIds([...restrictToAgentIds, 'unassigned']);
                        } else {
                          setRestrictToAgentIds(restrictToAgentIds.filter(id => id !== 'unassigned'));
                        }
                      }}
                    />
                    <Label htmlFor="restrict-unassigned" className="text-sm font-medium cursor-pointer">Unassigned Chats</Label>
                  </div>
                  {teamMembers.map((member) => (
                    <div key={member.user_id} className="flex items-center gap-2 p-1.5">
                      <Checkbox
                        id={`restrict-${member.user_id}`}
                        disabled={disabled}
                        checked={restrictToAgentIds.includes(member.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setRestrictToAgentIds([...restrictToAgentIds, member.user_id]);
                          } else {
                            setRestrictToAgentIds(restrictToAgentIds.filter(id => id !== member.user_id));
                          }
                        }}
                      />
                      <Label htmlFor={`restrict-${member.user_id}`} className="text-sm font-medium cursor-pointer">
                        {member.full_name}
                        <span className="text-[10px] text-muted-foreground ml-1 capitalize">({member.account_role})</span>
                      </Label>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground col-span-2">Loading team members...</p>
                  )}
                </div>
                {restrictToAgentIds.length > 0 && (
                  <p className="text-[11px] text-primary font-medium">
                    ✓ AI will only reply to chats assigned to {restrictToAgentIds.length} selected option(s).
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: SALES AGENT */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Sales Agent Configuration
              </CardTitle>
              <CardDescription>
                Enable Sales Mode, configure data to collect, and payment detail messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base font-semibold">Enable Sales Mode</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Configures the LLM to actively pitch products, qualify interest, collect details, and send payment information.
                  </p>
                </div>
                <Switch
                  disabled={disabled}
                  checked={salesModeEnabled}
                  onCheckedChange={setSalesModeEnabled}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="systemPrompt">General System Prompt & Tone</Label>
                <Textarea
                  id="systemPrompt"
                  disabled={disabled}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Provide context about your company, tone guidelines, and details."
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="salesSystemPrompt">Specific Sales Pitch / Script (Optional)</Label>
                <Textarea
                  id="salesSystemPrompt"
                  disabled={disabled || !salesModeEnabled}
                  value={salesSystemPrompt}
                  onChange={(e) => setSalesSystemPrompt(e.target.value)}
                  placeholder="Instruct the AI on key sales objectives, target questions to ask, and standard responses."
                  className="min-h-[100px]"
                />
              </div>

              {/* FIELDS TO COLLECT */}
              <div className="grid gap-2 border-t border-border/40 pt-4">
                <Label className="font-semibold flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                  Customer Information to Collect
                </Label>
                <p className="text-[12px] text-muted-foreground pb-2">
                  The AI agent will gently ask for these details in conversation and automatically populate custom fields in the CRM.
                </p>

                <div className="grid grid-cols-2 gap-3 max-h-[180px] overflow-y-auto border border-border/60 rounded-xl p-3 bg-muted/20">
                  {/* Standard fields */}
                  {['name', 'email', 'company'].map((fieldKey) => {
                    const isChecked = collectFields.some((f) => f.field === fieldKey);
                    const isRequired = collectFields.find((f) => f.field === fieldKey)?.required === true;
                    return (
                      <div key={fieldKey} className="flex items-center justify-between border-b border-border/20 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`field-${fieldKey}`}
                            disabled={disabled || !salesModeEnabled}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleCollectField(fieldKey)}
                          />
                          <Label htmlFor={`field-${fieldKey}`} className="cursor-pointer capitalize text-[13px]">{fieldKey}</Label>
                        </div>
                        {isChecked && (
                          <div className="flex items-center gap-1">
                            <Checkbox
                              id={`req-${fieldKey}`}
                              disabled={disabled || !salesModeEnabled}
                              checked={isRequired}
                              onCheckedChange={() => handleToggleRequiredField(fieldKey)}
                            />
                            <Label htmlFor={`req-${fieldKey}`} className="text-[11px] text-muted-foreground cursor-pointer">Required</Label>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom fields loaded from database */}
                  {accountCustomFields.map((field) => {
                    const fieldKey = `custom:${field.id}`;
                    const isChecked = collectFields.some((f) => f.field === fieldKey);
                    const isRequired = collectFields.find((f) => f.field === fieldKey)?.required === true;
                    return (
                      <div key={field.id} className="flex items-center justify-between border-b border-border/20 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 max-w-[65%] truncate">
                          <Checkbox
                            id={`field-${field.id}`}
                            disabled={disabled || !salesModeEnabled}
                            checked={isChecked}
                            onCheckedChange={() => handleToggleCollectField(fieldKey)}
                          />
                          <Label htmlFor={`field-${field.id}`} className="cursor-pointer truncate text-[13px]" title={field.field_name}>{field.field_name}</Label>
                        </div>
                        {isChecked && (
                          <div className="flex items-center gap-1">
                            <Checkbox
                              id={`req-${field.id}`}
                              disabled={disabled || !salesModeEnabled}
                              checked={isRequired}
                              onCheckedChange={() => handleToggleRequiredField(fieldKey)}
                            />
                            <Label htmlFor={`req-${field.id}`} className="text-[11px] text-muted-foreground cursor-pointer">Required</Label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PAYMENT SECTION */}
              <div className="grid gap-4 border-t border-border/40 pt-4">
                <Label className="font-semibold text-base flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Payment Collection
                </Label>

                {/* RAZORPAY TOGGLE */}
                <div className="flex items-center justify-between border border-border/40 rounded-xl p-3 bg-muted/10">
                  <div className="space-y-0.5 pr-4">
                    <Label className="font-semibold">Enable Razorpay Dynamic Payment Links</Label>
                    <p className="text-[11px] text-muted-foreground">
                      AI will generate unique Razorpay checkout links and deliver digital files automatically after payment.
                    </p>
                  </div>
                  <Switch
                    disabled={disabled || !salesModeEnabled}
                    checked={razorpayEnabled}
                    onCheckedChange={setRazorpayEnabled}
                  />
                </div>

                {razorpayEnabled && (
                  <div className="grid gap-3 border border-primary/20 rounded-xl p-4 bg-primary/5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid gap-1.5">
                      <Label htmlFor="razorpayKeyId">Razorpay Key ID</Label>
                      <Input
                        id="razorpayKeyId"
                        disabled={disabled}
                        value={razorpayKeyId}
                        onChange={(e) => setRazorpayKeyId(e.target.value)}
                        placeholder="rzp_live_..."
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="razorpayKeySecret">Razorpay Key Secret</Label>
                      <Input
                        id="razorpayKeySecret"
                        type="password"
                        disabled={disabled}
                        value={razorpayKeySecret}
                        onChange={(e) => { setRazorpayKeySecret(e.target.value); setRazorpayKeySecretEdited(true); }}
                        onFocus={() => { if (!razorpayKeySecretEdited && hasStoredRazorpayKeySecret) { setRazorpayKeySecret(''); setRazorpayKeySecretEdited(true); } }}
                        placeholder={hasStoredRazorpayKeySecret ? MASKED_KEY : 'Enter your Razorpay Key Secret'}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="razorpayWebhookSecret">Webhook Secret</Label>
                      <Input
                        id="razorpayWebhookSecret"
                        disabled={disabled}
                        value={razorpayWebhookSecret}
                        onChange={(e) => setRazorpayWebhookSecret(e.target.value)}
                        placeholder="whsec_..."
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Set this in your Razorpay Dashboard → Webhooks → Add Webhook. URL: <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/razorpay</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* STATIC QR FALLBACK (shown when Razorpay is OFF) */}
                {!razorpayEnabled && (
                  <div className="grid gap-3 animate-in fade-in duration-200">
                    <div className="grid gap-2">
                      <Label htmlFor="paymentQrUrl">UPI / Payment QR Image Link</Label>
                      <Input
                        id="paymentQrUrl"
                        disabled={disabled || !salesModeEnabled}
                        value={paymentQrUrl}
                        onChange={(e) => setPaymentQrUrl(e.target.value)}
                        placeholder="https://yourdomain.com/static/upi_qr.png"
                      />
                      {paymentQrUrl && (
                        <div className="mt-1 border border-border/80 rounded-xl p-2 max-w-[120px] bg-muted/40">
                          <img src={paymentQrUrl} alt="QR Code Preview" className="h-24 w-24 object-contain mx-auto" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        </div>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="paymentInstructions">Payment Instructions Text</Label>
                      <Textarea
                        id="paymentInstructions"
                        disabled={disabled || !salesModeEnabled}
                        value={paymentInstructions}
                        onChange={(e) => setPaymentInstructions(e.target.value)}
                        placeholder="e.g. Please transfer ₹999 to UPI ID: store@upi and reply with a screenshot."
                        className="min-h-[70px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* STORAGE CONFIGURATION CARD */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Product File Storage Provider
              </CardTitle>
              <CardDescription>
                Select which cloud storage service to use for hosting and uploading your digital goods.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="storageProvider">Active Storage Provider</Label>
                <select
                  id="storageProvider"
                  disabled={disabled}
                  value={storageProvider}
                  onChange={(e) => setStorageProvider(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="supabase">Supabase Storage (Built-in Public Bucket)</option>
                  <option value="cloudinary">Cloudinary Media Cloud</option>
                  <option value="mega">Mega.nz (Paste share links only)</option>
                  <option value="google_drive">Google Drive (Paste share links only)</option>
                </select>
              </div>

              {storageProvider === 'cloudinary' && (
                <div className="grid gap-3 border border-primary/20 rounded-xl p-4 bg-primary/5 animate-in fade-in duration-200">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cloudinaryCloudName">Cloudinary Cloud Name</Label>
                    <Input
                      id="cloudinaryCloudName"
                      disabled={disabled}
                      value={cloudinaryCloudName}
                      onChange={(e) => setCloudinaryCloudName(e.target.value)}
                      placeholder="e.g. gnk-edu-cloud"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cloudinaryApiKey">Cloudinary API Key</Label>
                    <Input
                      id="cloudinaryApiKey"
                      disabled={disabled}
                      value={cloudinaryApiKey}
                      onChange={(e) => setCloudinaryApiKey(e.target.value)}
                      placeholder="Enter API Key"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cloudinaryApiSecret">Cloudinary API Secret</Label>
                    <Input
                      id="cloudinaryApiSecret"
                      type="password"
                      disabled={disabled}
                      value={cloudinaryApiSecret}
                      onChange={(e) => { setCloudinaryApiSecret(e.target.value); setCloudinaryApiSecretEdited(true); }}
                      onFocus={() => { if (!cloudinaryApiSecretEdited && hasStoredCloudinaryApiSecret) { setCloudinaryApiSecret(''); setCloudinaryApiSecretEdited(true); } }}
                      placeholder={hasStoredCloudinaryApiSecret ? MASKED_KEY : 'Enter Cloudinary API Secret'}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PRODUCTS CATALOG MANAGEMENT CARD */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Products & Files Catalog
              </CardTitle>
              <CardDescription>
                Manage your digital products, pricing, and files. The AI Sales Agent will automatically suggest these items to buyers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add Product Form */}
              <div className="border border-border/80 rounded-xl p-4 bg-muted/20 grid gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">Add New Product</h4>
                  <div>
                    <label className="h-8 px-3 flex items-center justify-center rounded-md text-xs font-semibold cursor-pointer border shadow-sm bg-background hover:bg-muted text-foreground gap-1.5 transition-colors">
                      <Upload className="h-3.5 w-3.5 text-primary" />
                      Bulk Import CSV
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={disabled || uploadingFile}
                        onChange={handleBulkCsvUpload}
                      />
                    </label>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="newProdName">Product Name</Label>
                    <Input
                      id="newProdName"
                      disabled={disabled}
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="e.g. Physics Class 12 Notes"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="newProdPrice">Price (₹ INR)</Label>
                    <Input
                      id="newProdPrice"
                      type="number"
                      disabled={disabled}
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      placeholder="e.g. 99"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Product File Delivery Link</Label>
                  
                  {['supabase', 'cloudinary'].includes(storageProvider) ? (
                    <div className="flex items-center gap-3">
                      <Input
                        disabled={true}
                        value={newProductFileUrl}
                        placeholder="Upload a file using the button on the right..."
                        className="flex-1"
                      />
                      <label className={`h-10 px-4 flex items-center justify-center rounded-md text-sm font-semibold cursor-pointer border shadow-sm transition-colors ${
                        uploadingFile ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}>
                        {uploadingFile ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Uploading...
                          </>
                        ) : (
                          <>Upload File</>
                        )}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploadingFile || disabled}
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  ) : (
                    <Input
                      disabled={disabled}
                      value={newProductFileUrl}
                      onChange={(e) => setNewProductFileUrl(e.target.value)}
                      placeholder={storageProvider === 'google_drive' ? 'Paste Google Drive share URL...' : 'Paste Mega.nz share URL...'}
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {['supabase', 'cloudinary'].includes(storageProvider) 
                      ? 'Upload file to deliver direct attachments on WhatsApp.' 
                      : 'Copy the share link from Google Drive / Mega and paste it here.'}
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={handleAddProduct}
                    disabled={disabled || uploadingFile || !newProductName.trim() || !newProductPrice.trim() || !newProductFileUrl.trim()}
                  >
                    Add Product
                  </Button>
                </div>
              </div>

              {/* Products Table */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-foreground">Active Catalog</h4>
                {loadingProducts ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">Loading products list...</div>
                ) : products.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border/80 rounded-xl text-sm text-muted-foreground">
                    No products added to the catalog yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="border border-border/40 rounded-xl overflow-hidden shadow-sm bg-background">
                      <table className="min-w-full divide-y divide-border/20 text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Product Name</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-24">Price</th>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">File URL</th>
                            <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase w-16">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 bg-background">
                          {paginatedProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-muted/10">
                              <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                              <td className="px-4 py-3 font-semibold text-primary">₹{p.price}</td>
                              <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate text-xs">
                                <a href={p.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-primary">
                                  {p.file_url}
                                </a>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDeleteProduct(p.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-2 text-xs">
                        <div className="text-muted-foreground">
                          Showing {Math.min((currentPage - 1) * itemsPerPage + 1, products.length)}-{Math.min(currentPage * itemsPerPage, products.length)} of {products.length} products
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          >
                            Previous
                          </Button>
                          <div className="px-2 font-medium text-foreground">
                            Page {currentPage} of {totalPages}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: AUTO-CATEGORIZATION */}
        <TabsContent value="categorization" className="mt-4 space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Lead Status & Tag Mapping
              </CardTitle>
              <CardDescription>
                Instruct the AI to tag contacts and update lead status dynamically based on conversation interest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-base font-semibold">Enable Dynamic Auto-Categorization</Label>
                  <p className="text-[13px] text-muted-foreground">
                    Evaluate conversations after a few turns to categorize and tag the customer automatically.
                  </p>
                </div>
                <Switch
                  disabled={disabled}
                  checked={autoCategorizeEnabled}
                  onCheckedChange={setAutoCategorizeEnabled}
                />
              </div>

              <div className="grid gap-2 border-b border-border/40 pb-4">
                <Label htmlFor="categorizeAfter">Assess Interest After N AI Replies</Label>
                <Input
                  id="categorizeAfter"
                  type="number"
                  disabled={disabled || !autoCategorizeEnabled}
                  value={categorizeAfterReplies}
                  min={1}
                  max={20}
                  onChange={(e) => setCategorizeAfterReplies(Number(e.target.value))}
                  className="w-32"
                />
                <p className="text-[11px] text-muted-foreground">
                  The AI runs the interest analysis LLM call after this number of responses to decide tags and status.
                </p>
              </div>

              {/* INTERESTED TARGETS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="interestedTag">Interested Customer Tag</Label>
                  <Select
                    disabled={disabled || !autoCategorizeEnabled}
                    value={interestedTagId || 'none'}
                    onValueChange={(val) => setInterestedTagId(val === 'none' ? null : val)}
                  >
                    <SelectTrigger id="interestedTag">
                      <SelectValue placeholder="Select Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accountTags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="interestedStatus">Interested Lead Status</Label>
                  <Select
                    disabled={disabled || !autoCategorizeEnabled}
                    value={interestedStatusId || 'none'}
                    onValueChange={(val) => setInterestedStatusId(val === 'none' ? null : val)}
                  >
                    <SelectTrigger id="interestedStatus">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accountStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* NOT INTERESTED TARGETS */}
              <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="notInterestedTag">Not Interested Customer Tag</Label>
                  <Select
                    disabled={disabled || !autoCategorizeEnabled}
                    value={notInterestedTagId || 'none'}
                    onValueChange={(val) => setNotInterestedTagId(val === 'none' ? null : val)}
                  >
                    <SelectTrigger id="notInterestedTag">
                      <SelectValue placeholder="Select Tag" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accountTags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notInterestedStatus">Not Interested Lead Status</Label>
                  <Select
                    disabled={disabled || !autoCategorizeEnabled}
                    value={notInterestedStatusId || 'none'}
                    onValueChange={(val) => setNotInterestedStatusId(val === 'none' ? null : val)}
                  >
                    <SelectTrigger id="notInterestedStatus">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {accountStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: KNOWLEDGE BASE */}
        <TabsContent value="kb" className="mt-4 space-y-4">
          <AiKnowledgeCard
            accountId={accountId}
            canEdit={canEdit}
            hasEmbeddingsKey={
              embeddingsKeyEdited
                ? embeddingsKey.trim().length > 0
                : hasStoredEmbeddingsKey
            }
          />
        </TabsContent>
      </Tabs>

      {/* SAVE & DELETE PANEL */}
      <div className="flex items-center justify-between pt-4 border-t border-border/65">
        {configured ? (
          <Button
            type="button"
            variant="destructive"
            disabled={disabled}
            onClick={handleRemove}
            className="flex items-center gap-1.5"
          >
            {removing && <Loader2 className="h-4 w-4 animate-spin" />}
            Disable & Remove AI Agent
          </Button>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Info className="h-4 w-4" /> AI sales agent is not configured yet.
          </div>
        )}

        <Button
          type="button"
          disabled={disabled || (keyEdited && !apiKey.trim())}
          onClick={handleSave}
          className="flex items-center gap-1.5 shadow-sm px-6 rounded-lg"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
