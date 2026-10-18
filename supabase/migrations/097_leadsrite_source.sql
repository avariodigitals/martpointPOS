-- Replace the user-facing Explee lead source with the neutral LeadsRite name.
-- The Explee integration tables/API identifiers remain technical implementation details.
UPDATE leads
SET source = 'leadsrite'
WHERE lower(trim(source)) = 'explee';
