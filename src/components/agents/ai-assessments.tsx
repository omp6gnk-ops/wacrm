'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Calendar,
  Phone,
  User,
  ExternalLink,
  Filter,
  CheckCircle,
  Tag,
  ArrowRightLeft,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Assessment {
  id: string
  conversationId: string
  contactId: string
  interestLevel: 'hot' | 'warm' | 'cold' | 'not_interested'
  collectedData: Record<string, string>
  aiReasoning: string
  actionsTaken: Array<{ type: string; detail: string; timestamp: string }>
  createdAt: string
  contactName: string
  contactPhone: string
}

export function AiAssessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/ai/assessments' : `/api/ai/assessments?interest_level=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to load assessments');
        return;
      }
      setAssessments(data.assessments || []);
    } catch {
      toast.error('Failed to fetch AI sales assessments');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchAssessments();
  }, [fetchAssessments]);

  // Compute stats
  const totalLeads = assessments.length;
  const hotLeads = assessments.filter((a) => a.interestLevel === 'hot').length;
  const warmLeads = assessments.filter((a) => a.interestLevel === 'warm').length;
  const coldLeads = assessments.filter((a) => a.interestLevel === 'cold').length;
  const uninterestedLeads = assessments.filter((a) => a.interestLevel === 'not_interested').length;

  const qualifiedCount = hotLeads + warmLeads;
  const qualifiedPercent = totalLeads > 0 ? Math.round((qualifiedCount / totalLeads) * 100) : 0;

  const getInterestBadge = (level: Assessment['interestLevel']) => {
    switch (level) {
      case 'hot':
        return (
          <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 hover:bg-red-500/10">
            🔥 Hot Lead
          </Badge>
        );
      case 'warm':
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 hover:bg-amber-500/10">
            ☀️ Warm Lead
          </Badge>
        );
      case 'cold':
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 hover:bg-blue-500/10">
            ❄️ Cold
          </Badge>
        );
      case 'not_interested':
        return (
          <Badge className="bg-muted text-muted-foreground border border-border px-2 py-0.5 hover:bg-muted">
            ❌ Not Interested
          </Badge>
        );
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'tag_added':
        return <Tag className="h-3 w-3 text-emerald-500" />;
      case 'status_changed':
        return <ArrowRightLeft className="h-3 w-3 text-cyan-500" />;
      case 'field_updated':
        return <User className="h-3 w-3 text-indigo-500" />;
      case 'qr_sent':
        return <DollarSign className="h-3 w-3 text-red-500 animate-pulse" />;
      default:
        return <CheckCircle className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Assessed</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">Unique customer interactions</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualified Interest</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{qualifiedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {hotLeads} Hot & {warmLeads} Warm leads
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lead Quality Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualifiedPercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">Interest ratio (Hot+Warm)</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Not Interested</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{uninterestedLeads + coldLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {coldLeads} Cold & {uninterestedLeads} Disinterested
            </p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER PANEL */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg">Assessment History</CardTitle>
            <CardDescription>Real-time log of AI sales analysis, lead status updates, and transactions.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={(val) => setFilter(val ?? 'all')}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Filter Interest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interest Levels</SelectItem>
                <SelectItem value="hot">🔥 Hot Leads</SelectItem>
                <SelectItem value="warm">☀️ Warm Leads</SelectItem>
                <SelectItem value="cold">❄️ Cold Leads</SelectItem>
                <SelectItem value="not_interested">❌ Not Interested</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2 border-t p-6">
              <AlertCircle className="h-8 w-8 text-muted-foreground/60" />
              <p>No assessment records found matching this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border/40">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40 font-semibold text-muted-foreground">
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Interest Rating</th>
                    <th className="p-4">AI Extraction & Reasoning</th>
                    <th className="p-4">Automated Actions</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {assessments.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-4 space-y-1">
                        <div className="font-semibold text-foreground">{a.contactName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {a.contactPhone}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                          <Calendar className="h-3 w-3" /> {new Date(a.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4">{getInterestBadge(a.interestLevel)}</td>
                      <td className="p-4 max-w-[320px] space-y-2">
                        <div className="text-xs text-foreground bg-muted/30 p-2 rounded-lg leading-relaxed border border-border/20 italic">
                          "{a.aiReasoning || 'No reasoning provided.'}"
                        </div>
                        {Object.keys(a.collectedData || {}).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {Object.entries(a.collectedData).map(([key, val]) => (
                              <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0">
                                <span className="text-muted-foreground mr-1 capitalize">{key.replace('custom:', '')}:</span>
                                <span className="font-medium text-foreground truncate max-w-[80px]" title={val}>{val}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 max-w-[200px]">
                        {a.actionsTaken && a.actionsTaken.length > 0 ? (
                          <div className="space-y-1.5">
                            {a.actionsTaken.map((action, i) => (
                              <div key={i} className="text-[11px] flex items-center gap-1.5 text-foreground leading-snug">
                                {getActionIcon(action.type)}
                                <span className="truncate" title={action.detail}>{action.detail}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No automated actions</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/inbox?id=${a.conversationId}`}
                          className={cn(
                            buttonVariants({ variant: 'ghost', size: 'sm' }),
                            'h-8 rounded-lg flex items-center gap-1.5 text-xs text-foreground'
                          )}
                        >
                          View Chat
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
