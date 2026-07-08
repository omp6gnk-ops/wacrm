-- Migration 033: Wallet System, Canned Responses, and Custom Lead Statuses
--
-- This migration implements:
-- 1. Wallet Balance & Transaction History on accounts table
-- 2. Utility Only Safeguard on whatsapp_config table
-- 3. Custom Lead Statuses for Conversations
-- 4. Canned Responses (Quick Replies)

-- ── 1. Wallet System ────────────────────────────────────────────────────────
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10, 3) NOT NULL DEFAULT 0.000;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Who performed this transaction
  amount       NUMERIC(10, 3) NOT NULL, -- positive for credit, negative for debit
  type         text NOT NULL CHECK (type IN ('credit', 'debit')),
  description  text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_account_id_idx ON wallet_transactions (account_id);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- SELECT: any member of the account (viewer+) can see transaction history.
DROP POLICY IF EXISTS wallet_transactions_select ON wallet_transactions;
CREATE POLICY wallet_transactions_select ON wallet_transactions FOR SELECT
  USING (is_account_member(account_id));

-- INSERT/UPDATE/DELETE: admin+ only (wallet is settings-class)
DROP POLICY IF EXISTS wallet_transactions_insert ON wallet_transactions;
CREATE POLICY wallet_transactions_insert ON wallet_transactions FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

-- ── 2. Utility Safeguard ────────────────────────────────────────────────────
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS utility_only_safeguard boolean NOT NULL DEFAULT true;

-- ── 3. Custom Lead Statuses ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_custom_statuses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name         text NOT NULL,
  color        text NOT NULL, -- Hex color
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_custom_statuses_account_id_idx ON conversation_custom_statuses (account_id);
ALTER TABLE conversation_custom_statuses ENABLE ROW LEVEL SECURITY;

-- SELECT: any member can see statuses
DROP POLICY IF EXISTS conversation_custom_statuses_select ON conversation_custom_statuses;
CREATE POLICY conversation_custom_statuses_select ON conversation_custom_statuses FOR SELECT
  USING (is_account_member(account_id));

-- INSERT/UPDATE/DELETE: admin+
DROP POLICY IF EXISTS conversation_custom_statuses_insert ON conversation_custom_statuses;
CREATE POLICY conversation_custom_statuses_insert ON conversation_custom_statuses FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS conversation_custom_statuses_update ON conversation_custom_statuses;
CREATE POLICY conversation_custom_statuses_update ON conversation_custom_statuses FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS conversation_custom_statuses_delete ON conversation_custom_statuses;
CREATE POLICY conversation_custom_statuses_delete ON conversation_custom_statuses FOR DELETE
  USING (is_account_member(account_id, 'admin'));

-- Add column to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS custom_status_id uuid REFERENCES conversation_custom_statuses(id) ON DELETE SET NULL;

-- ── 4. Canned Responses ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canned_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shortcut     text NOT NULL,
  message_text text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, shortcut)
);

CREATE INDEX IF NOT EXISTS canned_responses_account_id_idx ON canned_responses (account_id);
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;

-- SELECT: any member can see canned responses
DROP POLICY IF EXISTS canned_responses_select ON canned_responses;
CREATE POLICY canned_responses_select ON canned_responses FOR SELECT
  USING (is_account_member(account_id));

-- INSERT/UPDATE/DELETE: admin+
DROP POLICY IF EXISTS canned_responses_insert ON canned_responses;
CREATE POLICY canned_responses_insert ON canned_responses FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS canned_responses_update ON canned_responses;
CREATE POLICY canned_responses_update ON canned_responses FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS canned_responses_delete ON canned_responses;
CREATE POLICY canned_responses_delete ON canned_responses FOR DELETE
  USING (is_account_member(account_id, 'admin'));
