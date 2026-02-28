-- Migration: Add token billing columns to user_servers table
-- Created: 2026-02-28

-- Add OpenRouter token billing columns to user_servers
ALTER TABLE user_servers 
  ADD COLUMN IF NOT EXISTS openrouter_key VARCHAR(255),
  ADD COLUMN IF NOT EXISTS openrouter_key_limit_cents INTEGER DEFAULT 2500,
  ADD COLUMN IF NOT EXISTS token_usage_cents INTEGER DEFAULT 0;

-- Create token_purchases table for tracking top-ups
CREATE TABLE IF NOT EXISTS token_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_server_id UUID REFERENCES user_servers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  stripe_payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_token_purchases_user_id ON token_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_token_purchases_user_server_id ON token_purchases(user_server_id);

-- Create index for openrouter key lookups
CREATE INDEX IF NOT EXISTS idx_user_servers_openrouter_key ON user_servers(openrouter_key);

-- Add comments for documentation
COMMENT ON COLUMN user_servers.openrouter_key IS 'Per-droplet OpenRouter API key for token billing';
COMMENT ON COLUMN user_servers.openrouter_key_limit_cents IS 'Token usage limit in cents (default: 2500 = $25.00)';
COMMENT ON COLUMN user_servers.token_usage_cents IS 'Current token usage in cents';

COMMENT ON TABLE token_purchases IS 'Token purchase/top-up records';
