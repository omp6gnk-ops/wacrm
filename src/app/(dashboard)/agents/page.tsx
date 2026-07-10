'use client';

import { useEffect, useState } from 'react';
import { Bot, Sparkles, Settings2, TrendingUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiSalesConfig } from '@/components/settings/ai-sales-config';
import { AiAssessments } from '@/components/agents/ai-assessments';

type Tab = 'playground' | 'setup' | 'assessments';

export default function AgentsPage() {
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  // Land first-time users on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTab(data?.configured ? 'playground' : 'setup');
      } catch {
        if (!cancelled) setTab('setup');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          AI Agents
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Your bring-your-own-key AI agent — set it up, then test it in the
        playground before it replies to customers in the inbox.
      </p>

      {decided && (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> Playground
            </TabsTrigger>
            <TabsTrigger value="setup">
              <Settings2 className="mr-1.5 h-4 w-4" /> Setup
            </TabsTrigger>
            <TabsTrigger value="assessments">
              <TrendingUp className="mr-1.5 h-4 w-4" /> Sales Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground onGoToSetup={() => setTab('setup')} />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            <AiSalesConfig />
          </TabsContent>

          <TabsContent value="assessments" className="mt-4">
            <AiAssessments />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
