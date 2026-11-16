-- Keep user-owned audit records append-only.
-- Users may read and create their own operational events and executive briefs,
-- but cannot rewrite or erase the audit history from the client API.

revoke update, delete on public.aahana_ops_events from authenticated;
revoke update, delete on public.aahana_exec_briefs from authenticated;

-- System telemetry remains service-role only; task transitions remain RPC-only.
