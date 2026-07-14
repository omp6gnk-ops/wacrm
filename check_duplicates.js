const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = '.env.local';
let supabaseUrl = '';
let supabaseKey = '';

try {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') supabaseKey = val;
    }
  }
} catch (e) {
  console.error("Error reading env file:", e.message);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const searchPhone = '9256433605';

  // 1. Search contacts containing or matching this phone
  console.log(`--- Searching Contacts for phone: ${searchPhone} ---`);
  const { data: contacts, error: cError } = await supabase
    .from('contacts')
    .select('*')
    .or(`phone.ilike.%${searchPhone}%,phone.eq.${searchPhone}`);

  if (cError) {
    console.error("Error fetching contacts:", cError);
    return;
  }

  console.log(`Found ${contacts.length} matching contacts:`);
  for (const c of contacts) {
    console.log(`- Contact ID: ${c.id}`);
    console.log(`  Name:        "${c.name}"`);
    console.log(`  Phone:       "${c.phone}"`);
    console.log(`  Account ID:  "${c.account_id}"`);
    console.log(`  Created At:  "${c.created_at}"`);
  }

  // 2. Search conversations associated with these contacts
  console.log(`\n--- Searching Conversations for these contacts ---`);
  if (contacts.length > 0) {
    const contactIds = contacts.map(c => c.id);
    const { data: convs, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .in('contact_id', contactIds);

    if (convError) {
      console.error("Error fetching conversations:", convError);
      return;
    }

    console.log(`Found ${convs.length} conversations:`);
    for (const cv of convs) {
      console.log(`- Conv ID: ${cv.id}`);
      console.log(`  Contact ID:  "${cv.contact_id}"`);
      console.log(`  Status:      "${cv.status}"`);
      console.log(`  Assigned:    "${cv.assigned_agent_id}"`);
      console.log(`  Unread:      ${cv.unread_count}`);
      console.log(`  Last Msg:    "${cv.last_message_text}"`);
      console.log(`  Last Msg At: "${cv.last_message_at}"`);
    }
  }

  // 3. Search messages for these conversations
  console.log(`\n--- Checking duplicate phone numbers in contacts table ---`);
  const { data: dupes, error: dError } = await supabase
    .rpc('get_duplicate_phones_diagnostics'); // Let's try raw query or fetch all

  // If RPC doesn't exist, let's fetch count of phone duplicates manually
  const { data: allPhones } = await supabase
    .from('contacts')
    .select('phone');

  const phoneCounts = {};
  for (const p of allPhones || []) {
    if (p.phone) {
      phoneCounts[p.phone] = (phoneCounts[p.phone] || 0) + 1;
    }
  }

  const duplicates = Object.entries(phoneCounts).filter(([phone, count]) => count > 1);
  console.log(`Total duplicate phone numbers in contacts: ${duplicates.length}`);
  console.log("Top 10 duplicate phones:", duplicates.slice(0, 10));
}

run();
