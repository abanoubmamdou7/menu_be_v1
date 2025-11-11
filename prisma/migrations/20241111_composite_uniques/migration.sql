-- Drop existing FK that points to the old unique key
ALTER TABLE "item_master" DROP CONSTRAINT IF EXISTS "item_master_itm_group_code_fkey";

-- Drop old unique constraints on single columns
ALTER TABLE "item_main_group" DROP CONSTRAINT IF EXISTS "item_main_group_itm_group_code_key";
ALTER TABLE "item_master" DROP CONSTRAINT IF EXISTS "item_master_itm_code_key";

-- Ensure existing rows with NULL branch_code still have a concrete value if you expect uniqueness;
-- otherwise they can remain NULL because unique constraints treat NULLs as distinct.

-- Remove default UUID generator on itm_code so we always use ERP-provided codes
ALTER TABLE "item_master" ALTER COLUMN "itm_code" DROP DEFAULT;

-- Create new composite unique constraints scoped by branch
ALTER TABLE "item_main_group"
  ADD CONSTRAINT "item_main_group_code_branch_code_unique"
    UNIQUE ("itm_group_code", "branch_code");

ALTER TABLE "item_master"
  ADD CONSTRAINT "item_master_code_branch_code_unique"
    UNIQUE ("itm_code", "branch_code");

-- Recreate FK using composite key
ALTER TABLE "item_master"
  ADD CONSTRAINT "item_master_itm_group_code_branch_code_fkey"
    FOREIGN KEY ("itm_group_code", "branch_code")
    REFERENCES "item_main_group" ("itm_group_code", "branch_code")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

