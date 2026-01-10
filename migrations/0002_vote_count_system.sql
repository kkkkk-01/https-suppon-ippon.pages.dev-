-- Add vote_count column to votes table
ALTER TABLE votes ADD COLUMN vote_count INTEGER NOT NULL DEFAULT 0;

-- Update existing data: convert voted (0/1) to vote_count
UPDATE votes SET vote_count = voted WHERE voted = 1;

-- Note: We keep the 'voted' column for backward compatibility
-- but will use vote_count as the primary field going forward
