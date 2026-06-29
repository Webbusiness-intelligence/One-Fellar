-- ============================================================
-- 032_drop_whatsapp_crm.sql
--
-- The app is now Ad Studio only — drop every WhatsApp/CRM table. CASCADE also
-- removes their RLS policies, triggers, indexes and foreign keys.
--
-- KEPT (do NOT drop): accounts, profiles, account_invitations, credit_ledger,
-- and all ad_* tables (ad_chats, ad_chat_messages, ad_jobs, ad_assets,
-- ad_products, ad_product_images, ad_soul_ids, ad_skills, ad_brand_kits,
-- ad_commercials, ad_commercial_scenes).
-- ============================================================

-- Messaging / inbox
DROP TABLE IF EXISTS message_reactions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS message_templates CASCADE;
DROP TABLE IF EXISTS whatsapp_config CASCADE;

-- Broadcasts
DROP TABLE IF EXISTS broadcast_recipients CASCADE;
DROP TABLE IF EXISTS broadcasts CASCADE;

-- Automations
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS automation_pending_executions CASCADE;
DROP TABLE IF EXISTS automation_steps CASCADE;
DROP TABLE IF EXISTS automations CASCADE;

-- Flows
DROP TABLE IF EXISTS flow_run_events CASCADE;
DROP TABLE IF EXISTS flow_runs CASCADE;
DROP TABLE IF EXISTS flow_nodes CASCADE;
DROP TABLE IF EXISTS flows CASCADE;

-- Pipelines / deals
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS pipeline_stages CASCADE;
DROP TABLE IF EXISTS pipelines CASCADE;

-- Contacts + their fields/tags/notes
DROP TABLE IF EXISTS contact_custom_values CASCADE;
DROP TABLE IF EXISTS contact_tags CASCADE;
DROP TABLE IF EXISTS contact_notes CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS custom_fields CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
