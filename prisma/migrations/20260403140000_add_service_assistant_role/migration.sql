-- Phase F: service assistant role for inbox-only staff (UserRole enum).
-- PostgreSQL: new enum value must be committed before use in the same transaction in some versions;
-- `db push` handles dev; for migrate deploy, run when upgrading production.

ALTER TYPE "UserRole" ADD VALUE 'SERVICE_ASSISTANT';
