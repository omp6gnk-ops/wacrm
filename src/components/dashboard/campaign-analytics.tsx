'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadCampaignAnalytics } from '@/lib/dashboard/queries';
import type { CampaignAnalytics as CampaignAnalyticsType } from '@/lib/dashboard/types';
import { MetricCard } from '@/components/dashboard/metric-card';
import { SkeletonCard } from '@/components/dashboard/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Radio,
  Users,
  Send,
  CheckCheck,
  Eye,
  MessageCircle,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getBroadcastStatus } from '@/lib/broadcast-status';

export function CampaignAnalytics() {
  const [data, setData] = useState<CampaignAnalyticsType | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const db = createClient();
    loadCampaignAnalytics(db)
      .then((res) => setData(res))
      .catch((err) => console.error('[analytics] failed to load campaign analytics:', err))
      .finally(() => setLoading(false));
  }, []);

  // Filter campaigns based on created_at date range
  const filteredCampaigns = useMemo(() => {
    if (!data) return [];
    return data.campaigns.filter((c) => {
      const createdAt = new Date(c.created_at);
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00');
        if (createdAt < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59.999');
        if (createdAt > end) return false;
      }
      return true;
    });
  }, [data, startDate, endDate]);

  // Recalculate metrics dynamically based on filtered campaigns
  const aggregates = useMemo(() => {
    let totalBroadcasts = filteredCampaigns.length;
    let totalRecipients = 0;
    let totalSent = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalReplied = 0;
    let totalFailed = 0;

    for (const c of filteredCampaigns) {
      totalRecipients += c.total_recipients ?? 0;
      totalSent += c.sent_count ?? 0;
      totalDelivered += c.delivered_count ?? 0;
      totalRead += c.read_count ?? 0;
      totalReplied += c.replied_count ?? 0;
      totalFailed += c.failed_count ?? 0;
    }

    return {
      totalBroadcasts,
      totalRecipients,
      totalSent,
      totalDelivered,
      totalRead,
      totalReplied,
      totalFailed,
    };
  }, [filteredCampaigns]);

  // Paginated subset of filtered campaigns
  const totalPages = Math.ceil(filteredCampaigns.length / pageSize);
  const paginatedCampaigns = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return filteredCampaigns.slice(start, end);
  }, [filteredCampaigns, page]);

  // Reset pagination to page 0 when filters change
  useEffect(() => {
    setPage(0);
  }, [startDate, endDate]);

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  const percent = (num: number, total: number) => {
    if (!total) return '0%';
    return `${Math.round((num / total) * 100)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Campaigns Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Date-wise overall metrics and campaign breakdowns.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">From:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36 h-9 bg-card border-border text-foreground text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">To:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36 h-9 bg-card border-border text-foreground text-xs"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="h-9 px-2 text-muted-foreground hover:text-foreground shrink-0"
              title="Clear date filters"
            >
              <X className="size-4 mr-1" />
              Clear Date
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Campaigns"
          value={aggregates.totalBroadcasts.toLocaleString()}
          icon={Radio}
          subtitle="Campaigns created in range"
        />
        <MetricCard
          title="Total Recipients"
          value={aggregates.totalRecipients.toLocaleString()}
          icon={Users}
          subtitle="Target audience reached"
        />
        <MetricCard
          title="Messages Sent"
          value={aggregates.totalSent.toLocaleString()}
          icon={Send}
          subtitle={`Sent success rate: ${percent(aggregates.totalSent, aggregates.totalRecipients)}`}
        />
        <MetricCard
          title="Delivered Messages"
          value={aggregates.totalDelivered.toLocaleString()}
          icon={CheckCheck}
          subtitle={`Delivery rate: ${percent(aggregates.totalDelivered, aggregates.totalSent)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Read Messages"
          value={aggregates.totalRead.toLocaleString()}
          icon={Eye}
          subtitle={`Read rate: ${percent(aggregates.totalRead, aggregates.totalSent)}`}
        />
        <MetricCard
          title="Replied Messages"
          value={aggregates.totalReplied.toLocaleString()}
          icon={MessageCircle}
          subtitle={`Reply rate: ${percent(aggregates.totalReplied, aggregates.totalSent)}`}
        />
        <MetricCard
          title="Failed Messages"
          value={aggregates.totalFailed.toLocaleString()}
          icon={AlertCircle}
          subtitle={`Failure rate: ${percent(aggregates.totalFailed, aggregates.totalRecipients)}`}
        />
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">Campaign Breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Individual campaign performance metrics and delivery rates.
          </p>
        </div>
        
        {filteredCampaigns.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">No campaigns found in this range.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground pl-5">Campaign Name</TableHead>
                    <TableHead className="text-muted-foreground">Template</TableHead>
                    <TableHead className="text-muted-foreground text-right">Recipients</TableHead>
                    <TableHead className="text-muted-foreground text-right">Sent</TableHead>
                    <TableHead className="text-muted-foreground text-right">Delivered</TableHead>
                    <TableHead className="text-muted-foreground text-right">Read</TableHead>
                    <TableHead className="text-muted-foreground text-right">Replied</TableHead>
                    <TableHead className="text-muted-foreground text-right">Failed</TableHead>
                    <TableHead className="text-muted-foreground pr-5">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCampaigns.map((c) => {
                    const status = getBroadcastStatus(c.status);
                    return (
                      <TableRow key={c.id} className="border-border">
                        <TableCell className="font-medium text-foreground pl-5">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {c.template_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {(c.total_recipients ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {(c.sent_count ?? 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {(c.delivered_count ?? 0).toLocaleString()} ({percent(c.delivered_count, c.sent_count)})
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {(c.read_count ?? 0).toLocaleString()} ({percent(c.read_count, c.sent_count)})
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right tabular-nums">
                          {(c.replied_count ?? 0).toLocaleString()} ({percent(c.replied_count, c.sent_count)})
                        </TableCell>
                        <TableCell className="text-red-400 text-right tabular-nums">
                          {(c.failed_count ?? 0).toLocaleString()} ({percent(c.failed_count, c.total_recipients)})
                        </TableCell>
                        <TableCell className="pr-5">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.classes}`}
                          >
                            {status.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-muted/20">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{page * pageSize + 1}</span> to{' '}
                    <span className="font-semibold text-foreground">
                      {Math.min((page + 1) * pageSize, filteredCampaigns.length)}
                    </span>{' '}
                    of <span className="font-semibold text-foreground">{filteredCampaigns.length}</span> campaigns
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(p - 1, 0))}
                    disabled={page === 0}
                    className="h-8 w-8 border-border bg-card text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                    disabled={page >= totalPages - 1}
                    className="h-8 w-8 border-border bg-card text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
