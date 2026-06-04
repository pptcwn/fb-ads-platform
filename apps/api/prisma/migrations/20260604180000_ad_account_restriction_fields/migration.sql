-- Ad account Meta restriction metadata
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "account_status_code" INTEGER;
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "disable_reason" INTEGER;
ALTER TABLE "ad_accounts" ADD COLUMN IF NOT EXISTS "status_label_th" TEXT;