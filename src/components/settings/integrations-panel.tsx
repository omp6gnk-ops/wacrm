'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Share2, Globe, FileSpreadsheet, Loader2, Save, ExternalLink, HelpCircle } from 'lucide-react';

interface IntegrationConfig {
  webhook_url: string | null;
  webhook_payload_template: string | null;
  sheet_spreadsheet_id: string | null;
  sheet_name: string | null;
  sheet_client_email: string | null;
  sheet_private_key: string | null;
}

export function IntegrationsPanel() {
  const { accountId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'webhook' | 'sheets'>('webhook');

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookPayloadTemplate, setWebhookPayloadTemplate] = useState('');
  const [sheetSpreadsheetId, setSheetSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [sheetClientEmail, setSheetClientEmail] = useState('');
  const [sheetPrivateKey, setSheetPrivateKey] = useState('');

  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);

  useEffect(() => {
    if (!accountId) return;

    async function loadConfig() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('integration_configs')
          .select('*')
          .eq('account_id', accountId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setWebhookUrl(data.webhook_url || '');
          setWebhookPayloadTemplate(data.webhook_payload_template || '');
          setSheetSpreadsheetId(data.sheet_spreadsheet_id || '');
          setSheetName(data.sheet_name || 'Sheet1');
          setSheetClientEmail(data.sheet_client_email || '');
          setSheetPrivateKey(data.sheet_private_key || '');
          
          // Default tab focus based on what is configured
          if (!data.webhook_url && data.sheet_spreadsheet_id) {
            setActiveTab('sheets');
          }
        }
      } catch (err) {
        console.error('Failed to load integration configs:', err);
        toast.error('Failed to load integration settings');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [accountId]);

  async function handleSave() {
    if (!accountId) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const payload = {
        webhook_url: webhookUrl.trim() || null,
        webhook_payload_template: webhookPayloadTemplate.trim() || null,
        sheet_spreadsheet_id: sheetSpreadsheetId.trim() || null,
        sheet_name: sheetName.trim() || 'Sheet1',
        sheet_client_email: sheetClientEmail.trim() || null,
        sheet_private_key: sheetPrivateKey.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('integration_configs')
        .update(payload)
        .eq('account_id', accountId);

      if (error) throw error;
      toast.success('Integration settings saved successfully');
    } catch (err) {
      console.error('Failed to save integrations:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save integration settings');
    } finally {
      setSaving(false);
    }
  }

  const appsScriptCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Append rows: Name, Phone, Remark, Date
    sheet.appendRow([
      data.name || "N/A",
      " " + (data.phone || "N/A"), // prefix space to prevent scientific notation in sheets
      data.remark || "N/A",
      new Date().toLocaleString()
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Integrations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your GNK CRM with third-party webhooks or export data directly into Google Sheets.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 max-w-md">
        <button
          onClick={() => setActiveTab('webhook')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'webhook'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          Webhook Integration
        </button>
        <button
          onClick={() => setActiveTab('sheets')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            activeTab === 'sheets'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Google Sheets (Direct)
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-5 space-y-4">
        {activeTab === 'webhook' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              <span>Configure Custom Webhook URL</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Trigger a payload to Zapier, Make.com, Pabbly, or any custom endpoint when you click "Send to Sheet" in the chat thread.
            </p>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Webhook URL</label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hook.make.com/your-unique-webhook-id"
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-foreground">Custom JSON Payload Template & Sheets Column Order (Optional)</label>
                <button
                  type="button"
                  onClick={() => setWebhookPayloadTemplate(
                    JSON.stringify({
                      name: "{{name}}",
                      phone: "{{phone}}",
                      remark: "{{remark}}",
                      agent_name: "{{agent_name}}",
                      exported_at: "{{exported_at}}"
                    }, null, 2)
                  )}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Load Default Template
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">
                This JSON template controls both the payload sent to the Webhook and the order of column values appended to Google Sheets (e.g. key-values in order: Column A, Column B, etc.).
              </p>
              <textarea
                value={webhookPayloadTemplate}
                onChange={(e) => setWebhookPayloadTemplate(e.target.value)}
                placeholder='{\n  "lead_name": "{{name}}",\n  "mobile": "{{phone}}",\n  "note": "{{remark}}",\n  "source": "WhatsApp"\n}'
                className="w-full h-36 rounded-lg border border-border bg-muted p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
              />
              <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-muted-foreground">Available variables:</span>
                {['{{name}}', '{{phone}}', '{{remark}}', '{{agent_name}}', '{{exported_at}}'].map((v) => (
                  <code
                    key={v}
                    onClick={() => setWebhookPayloadTemplate(prev => prev + v)}
                    className="cursor-pointer bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono text-primary-foreground border border-border hover:bg-border transition-colors"
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>

            {/* Apps Script Webhook Guide Button */}
            <div className="border-t border-border/50 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAppsScriptGuide(!showAppsScriptGuide)}
                className="flex items-center gap-1.5 text-xs border-border"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Want a FREE Google Sheet Webhook? See guide
              </Button>

              {showAppsScriptGuide && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-xs text-foreground">
                  <p className="font-semibold">How to setup a free Google Sheet Webhook in 1 minute:</p>
                  <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground">
                    <li>Open your Google Sheet, click on <strong>Extensions &gt; Apps Script</strong>.</li>
                    <li>Delete any code there and paste this exact script:</li>
                  </ol>
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto text-[10px] text-foreground border border-border">
                    {appsScriptCode}
                  </pre>
                  <ol className="list-decimal pl-4 space-y-1.5 text-muted-foreground" start={3}>
                    <li>Click <strong>Deploy &gt; New deployment</strong>.</li>
                    <li>Select type as <strong>Web app</strong>.</li>
                    <li>Execute as <strong>"Me"</strong> and set access to <strong>"Anyone"</strong> (this allows the CRM to send data).</li>
                    <li>Click Deploy, copy the <strong>Web App URL</strong> and paste it in the Webhook URL input field above!</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <span>Google Sheets Direct Integration (Google Cloud Service Account)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide credentials from your Google Cloud Console Service Account to write directly to your spreadsheet. Make sure you share the spreadsheet with your service account's client email!
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Spreadsheet ID</label>
                <Input
                  value={sheetSpreadsheetId}
                  onChange={(e) => setSheetSpreadsheetId(e.target.value)}
                  placeholder="e.g. 1a2b3c4d5e6f7g8h9i..."
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Found in your spreadsheet URL: docs.google.com/spreadsheets/d/<strong>[SPREADSHEET_ID]</strong>/edit
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">Sheet Name</label>
                <Input
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="e.g. Sheet1"
                  className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Service Account Client Email</label>
              <Input
                value={sheetClientEmail}
                onChange={(e) => setSheetClientEmail(e.target.value)}
                placeholder="your-service-account@your-project-id.iam.gserviceaccount.com"
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Service Account Private Key</label>
              <textarea
                value={sheetPrivateKey}
                onChange={(e) => setSheetPrivateKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
                className="w-full h-28 rounded-lg border border-border bg-muted p-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Make sure to copy the entire key including "-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----".
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
