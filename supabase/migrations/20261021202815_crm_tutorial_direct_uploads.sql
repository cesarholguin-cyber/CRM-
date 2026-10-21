DO $migration$
BEGIN
-- Upload bytes go directly to private Backblaze, never through the CRM proxy.
CREATE TABLE crm.tutorial_uploads (
    id varchar(36) PRIMARY KEY,
    uploaded_by integer REFERENCES crm.users(id) ON DELETE SET NULL,
    object_path varchar(255) NOT NULL UNIQUE,
    storage_upload_id text,
    title varchar(160) NOT NULL,
    description text NOT NULL DEFAULT '',
    content_type varchar(40) NOT NULL CHECK (content_type IN ('video/mp4', 'video/webm')),
    size_bytes integer NOT NULL CONSTRAINT tutorial_uploads_size_check CHECK (size_bytes > 0 AND size_bytes <= 209715200),
    state varchar(16) NOT NULL DEFAULT 'pending' CONSTRAINT tutorial_uploads_state_check CHECK (state IN ('pending', 'complete', 'aborted')),
    tutorial_id integer REFERENCES crm.tutorials(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tutorial_uploads_uploaded_by ON crm.tutorial_uploads(uploaded_by);
CREATE INDEX ix_tutorial_uploads_pending ON crm.tutorial_uploads(created_at) WHERE state = 'pending';
ALTER TABLE crm.tutorial_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm.tutorial_uploads FROM PUBLIC, anon, authenticated;
INSERT INTO crm.crm_schema_migrations (version) VALUES ('supabase-tutorials-v4-ready') ON CONFLICT DO NOTHING;
END
$migration$;
