'use client';

import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { SettingsRail } from '@/components/settings/settings-rail';
import { SettingsOverview } from '@/components/settings/settings-overview';
import { ProfileForm } from '@/components/settings/profile-form';
import { SecurityPanel } from '@/components/settings/security-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { FieldsAndTagsPanel } from '@/components/settings/fields-and-tags-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { MembersTab } from '@/components/settings/members-tab';
import { WalletPanel } from '@/components/settings/wallet-panel';
import { CannedPanel } from '@/components/settings/canned-panel';
import { ApiKeysSettings } from '@/components/settings/api-keys-settings';
import { IntegrationsPanel } from '@/components/settings/integrations-panel';
import { AiSalesConfig } from '@/components/settings/ai-sales-config';
import {
  resolveSection,
  SECTION_META,
  type SettingsSection,
} from '@/components/settings/settings-sections';

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { defaultCurrency, canEditSettings } = useAuth();
  const { mode } = useTheme();

  const urlSection = resolveSection(searchParams.get('tab'));
  const [localSection, setLocalSection] = useState<SettingsSection | null>(null);

  // Sync local state when url parameter changes
  useEffect(() => {
    setLocalSection(urlSection);
  }, [urlSection]);

  const section = localSection ?? urlSection;

  // Gate workspace sections for admins only
  const activeSection =
    SECTION_META[section].group === 'workspace' && !canEditSettings
      ? 'overview'
      : section;

  const go = (next: SettingsSection) => {
    setLocalSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  // Cheap, fetch-free rail hints. The Overview landing carries the
  // full live status/counts; the rail just surfaces the two that are
  // already in context.
  const hints: Partial<Record<SettingsSection, ReactNode>> = useMemo(
    () => ({
      appearance: mode.charAt(0).toUpperCase() + mode.slice(1),
      deals: defaultCurrency,
    }),
    [mode, defaultCurrency],
  );

  const panel: Record<SettingsSection, ReactNode> = {
    overview: <SettingsOverview onSelect={go} />,
    profile: <ProfileForm />,
    security: <SecurityPanel />,
    appearance: <AppearancePanel />,
    whatsapp: <WhatsAppConfig />,
    templates: <TemplateManager />,
    fields: <FieldsAndTagsPanel />,
    deals: <DealsSettings />,
    members: <MembersTab />,
    wallet: <WalletPanel />,
    canned: <CannedPanel />,
    api: <ApiKeysSettings />,
    integrations: <IntegrationsPanel />,
    'ai-agent': <AiSalesConfig />,
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything in one place — your account and your workspace. Pick a
          section to manage it.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start">
        <SettingsRail active={activeSection} onSelect={go} hints={hints} />
        <div className="min-w-0">{panel[activeSection]}</div>
      </div>
    </div>
  );
}
