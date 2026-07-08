'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Minus, Landmark, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  created_at: string;
}

export function WalletPanel() {
  const { accountId, canEditSettings, user } = useAuth();
  const supabase = createClient();

  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Input states for adding tokens
  const [amountInput, setAmountInput] = useState('');
  const [descInput, setDescInput] = useState('');

  async function loadWalletData() {
    if (!accountId) return;
    try {
      // 1. Fetch current account balance
      const { data: acct, error: acctErr } = await supabase
        .from('accounts')
        .select('wallet_balance')
        .eq('id', accountId)
        .single();
      
      if (acctErr) throw acctErr;
      setBalance(Number(acct?.wallet_balance ?? 0));

      // 2. Fetch last 50 transactions
      const { data: txs, error: txsErr } = await supabase
        .from('wallet_transactions')
        .select('id, amount, type, description, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txsErr) throw txsErr;
      setTransactions(txs ?? []);
    } catch (err: any) {
      console.error('Failed to load wallet data:', err);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWalletData();
  }, [accountId]);

  async function handleTransaction(actionType: 'credit' | 'debit') {
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid amount greater than 0');
      return;
    }
    if (!descInput.trim()) {
      toast.error('Enter a description for the transaction');
      return;
    }
    if (!accountId || !user) return;

    setSubmitting(true);
    try {
      const finalAmount = actionType === 'credit' ? amt : -amt;
      const newBalance = (balance ?? 0) + finalAmount;

      if (newBalance < 0) {
        toast.error('Insufficient wallet balance to perform this debit');
        setSubmitting(false);
        return;
      }

      // 1. Update account balance
      const { error: acctErr } = await supabase
        .from('accounts')
        .update({ wallet_balance: newBalance })
        .eq('id', accountId);
      
      if (acctErr) throw acctErr;

      // 2. Insert transaction record
      const { error: txErr } = await supabase
        .from('wallet_transactions')
        .insert({
          account_id: accountId,
          user_id: user.id,
          amount: finalAmount,
          type: actionType,
          description: descInput.trim()
        });

      if (txErr) throw txErr;

      toast.success(`Successfully ${actionType === 'credit' ? 'credited' : 'debited'} ${amt} tokens`);
      setAmountInput('');
      setDescInput('');
      await loadWalletData();
    } catch (err: any) {
      console.error('Transaction failed:', err);
      toast.error('Transaction failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Wallet Manager</h2>
        <p className="text-sm text-muted-foreground">
          Manage your campaign token balance, credit tokens, and audit transaction logs.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Balance Card */}
        <Card className="flex flex-col justify-between p-5 md:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Current Balance</span>
            <Landmark className="h-5 w-5 text-primary/70" />
          </div>
          <div className="mt-4">
            <span className="text-4xl font-extrabold text-foreground">
              {(balance ?? 0).toFixed(3)}
            </span>
            <span className="ml-1 text-sm text-muted-foreground font-medium">Tokens</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            1 Token = 1 INR. Utility sends debit 0.115 tokens; Marketing sends debit 0.800 tokens.
          </p>
        </Card>

        {/* Transaction Actions Form (Admin Only) */}
        {canEditSettings && (
          <Card className="p-5 md:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Adjust Tokens</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="tx-amount" className="text-xs">Amount (Tokens)</Label>
                <Input
                  id="tx-amount"
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.000"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="bg-muted/50 border-border text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tx-desc" className="text-xs">Reason / Description</Label>
                <Input
                  id="tx-desc"
                  placeholder="e.g. Added Summer Admissions Campaign credit"
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  className="bg-muted/50 border-border text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => handleTransaction('debit')}
                disabled={submitting}
                className="text-red-400 hover:text-red-300 border-border"
              >
                <Minus className="mr-1.5 h-4 w-4" /> Debit
              </Button>
              <Button
                onClick={() => handleTransaction('credit')}
                disabled={submitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Credit
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Transaction Logs */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-medium pb-2">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Description</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'credit';
                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 pr-4 text-muted-foreground whitespace-nowrap">
                        {format(new Date(tx.created_at), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td className="py-2.5 pr-4 text-foreground font-medium break-words max-w-xs">
                        {tx.description}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${
                          isCredit 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {isCredit ? (
                            <>
                              <ArrowUpRight className="h-3 w-3" /> Credit
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="h-3 w-3" /> Debit
                            </>
                          )}
                        </span>
                      </td>
                      <td className={`py-2.5 font-bold text-right whitespace-nowrap ${
                        isCredit ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {isCredit ? '+' : ''}{tx.amount.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
