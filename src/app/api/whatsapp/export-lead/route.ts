import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { google } from 'googleapis';

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Resolve session
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    
    const user = session?.user;
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve profile and account
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const accountId = profile?.account_id;
    if (!accountId) {
      return NextResponse.json({ error: 'Profile not linked to account' }, { status: 400 });
    }

    const { contactId, conversationId, remark = '' } = await request.json();
    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
    }

    // Fetch contact details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('name, phone')
      .eq('id', contactId)
      .eq('account_id', accountId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Fetch user/agent profile name
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const agentName = userProfile?.full_name || user.email || 'Agent';

    // Fetch integration configurations
    const { data: config } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (!config || (!config.webhook_url && !config.sheet_spreadsheet_id)) {
      return NextResponse.json({
        error: 'No export integration configured. Please setup Webhooks or Google Sheets in Settings first.'
      }, { status: 400 });
    }

    // A. Parse and Compile the JSON Payload Template first
    let payload: Record<string, any>;

    if (config.webhook_payload_template) {
      try {
        let templateStr = config.webhook_payload_template;
        
        // Escape dynamic variables to prevent breaking JSON strings
        const escapeJsonString = (str: string) => {
          return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
        };

        templateStr = templateStr
          .replace(/\{\{name\}\}/g, escapeJsonString(contact.name || ''))
          .replace(/\{\{phone\}\}/g, escapeJsonString(contact.phone || ''))
          .replace(/\{\{remark\}\}/g, escapeJsonString(remark))
          .replace(/\{\{agent_name\}\}/g, escapeJsonString(agentName))
          .replace(/\{\{exported_at\}\}/g, escapeJsonString(new Date().toISOString()));

        payload = JSON.parse(templateStr);
      } catch (err) {
        return NextResponse.json({
          error: 'Invalid custom JSON payload template. Please verify the JSON syntax in Settings.'
        }, { status: 400 });
      }
    } else {
      payload = {
        name: contact.name || '',
        phone: contact.phone || '',
        remark,
        agent_name: agentName,
        exported_at: new Date().toISOString(),
      };
    }

    let webhookTriggered = false;
    let sheetAppended = false;
    const errors: string[] = [];

    // B. Trigger Webhook Export if configured
    if (config.webhook_url) {
      try {
        const res = await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          webhookTriggered = true;
        } else {
          const body = await res.text();
          errors.push(`Webhook returned status ${res.status}: ${body}`);
        }
      } catch (err) {
        errors.push(`Webhook fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // C. Trigger Direct Google Sheet Export (Service Account) if configured
    if (config.sheet_spreadsheet_id && config.sheet_client_email && config.sheet_private_key) {
      try {
        const privateKey = config.sheet_private_key.replace(/\\n/g, '\n');
        
        const auth = new google.auth.JWT({
          email: config.sheet_client_email,
          key: privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Map payload values to sheet row. If it's the customer phone, prefix space to avoid scientific format.
        const rowValues = Object.values(payload).map((val) => {
          if (typeof val === 'string' && val.trim() === contact.phone) {
            return ` ${val}`;
          }
          return val;
        });
        
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.sheet_spreadsheet_id,
          range: `${config.sheet_name || 'Sheet1'}!A:Z`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [rowValues]
          }
        });
        
        sheetAppended = true;
      } catch (err) {
        errors.push(`Google Sheet append failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!webhookTriggered && !sheetAppended) {
      return NextResponse.json({
        error: 'Failed to export lead to any integrations.',
        details: errors
      }, { status: 500 });
    }

    if (conversationId) {
      await supabase
        .from('conversations')
        .update({ exported_to_sheet: true })
        .eq('id', conversationId);
    }

    return NextResponse.json({
      success: true,
      webhookTriggered,
      sheetAppended,
      warnings: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Lead export endpoint error:', err);
    return NextResponse.json({
      error: 'Internal server error',
      details: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
