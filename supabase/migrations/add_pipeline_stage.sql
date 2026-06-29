-- Migration: Add pipeline_stage to contacts table

-- 1. Create the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'pipeline_stage'
    ) THEN
        ALTER TABLE public.contacts ADD COLUMN pipeline_stage text DEFAULT 'new';
    END IF;
END $$;

-- 2. Drop the constraint if it exists to allow re-running
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_pipeline_stage_check;

-- 3. Update existing rows if any are null or invalid
UPDATE public.contacts 
SET pipeline_stage = 'new' 
WHERE pipeline_stage IS NULL 
   OR pipeline_stage NOT IN ('new', 'contacted', 'proposal', 'won', 'lost');

-- 4. Add the CHECK constraint with exact values
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_pipeline_stage_check 
CHECK (pipeline_stage IN ('new', 'contacted', 'proposal', 'won', 'lost'));
