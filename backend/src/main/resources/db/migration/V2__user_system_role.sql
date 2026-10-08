-- Platform-wide role, independent of the per-workspace roles in
-- workspace_members. Only ADMIN may manage other users' accounts.
ALTER TABLE users ADD COLUMN system_role VARCHAR(20) NOT NULL DEFAULT 'USER';
ALTER TABLE users ADD CONSTRAINT chk_users_system_role CHECK (system_role IN ('ADMIN', 'USER'));

-- The seeded demo admin, on databases that were seeded before this column existed.
UPDATE users SET system_role = 'ADMIN' WHERE id = '00000000-0000-0000-0000-000000000001';
