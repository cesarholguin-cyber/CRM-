-- The obsolete role never had commercial permissions. Refuse removal if it was
-- nevertheless linked to commercial records; those records require reconciliation.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM crm.sales WHERE agent_id IN (SELECT id FROM crm.users WHERE role::text = 'SISTEMAS'))
    OR EXISTS (SELECT 1 FROM crm.clients WHERE assigned_agent_id IN (SELECT id FROM crm.users WHERE role::text = 'SISTEMAS'))
    OR EXISTS (SELECT 1 FROM crm.client_interactions WHERE user_id IN (SELECT id FROM crm.users WHERE role::text = 'SISTEMAS'))
    OR EXISTS (SELECT 1 FROM crm.sale_documents WHERE uploaded_by IN (SELECT id FROM crm.users WHERE role::text = 'SISTEMAS')) THEN
        RAISE EXCEPTION 'A retired role has commercial records; reconcile them before removing access';
    END IF;
-- Auth identities and private media archives are retained for transfer. Without a
-- linked CRM profile, existing access/refresh tokens cannot enter this application.
DELETE FROM crm.users WHERE role::text = 'SISTEMAS';
ALTER TABLE crm.users DROP CONSTRAINT IF EXISTS users_commercial_roles_only;
ALTER TABLE crm.users ADD CONSTRAINT users_commercial_roles_only
    CHECK (role::text IN ('ADMIN', 'PROMOTOR'));
-- Do not delete tutorials, multipart metadata or B2 objects. They are archived,
-- private, and no longer exposed through application routes or ORM models.
INSERT INTO crm.crm_schema_migrations(version) VALUES ('supabase-commercial-v5-ready')
ON CONFLICT (version) DO NOTHING;
END $$;
