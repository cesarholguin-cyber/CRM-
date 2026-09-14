-- =============================================
-- R&F CRM - Migración completa para Supabase
-- =============================================

-- ==================== ENUMS ====================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
        CREATE TYPE userrole AS ENUM ('ADMIN', 'PROMOTOR');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'projectstatus') THEN
        CREATE TYPE projectstatus AS ENUM ('active', 'completed', 'paused', 'cancelled');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lotstatus') THEN
        CREATE TYPE lotstatus AS ENUM ('available', 'reserved', 'sold', 'blocked');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clientstatus') THEN
        CREATE TYPE clientstatus AS ENUM ('lead', 'contacted', 'visit_scheduled', 'visit_completed', 'interested', 'reservation', 'sold', 'lost');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leadsource') THEN
        CREATE TYPE leadsource AS ENUM ('website', 'whatsapp', 'facebook', 'instagram', 'referral', 'phone', 'visit', 'other');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'salestatus') THEN
        CREATE TYPE salestatus AS ENUM ('reserved', 'option_signed', 'contract_signed', 'financing', 'paid', 'cancelled', 'reversed');
    END IF;
END $$;

-- ==================== TABLAS ====================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role userrole NOT NULL DEFAULT 'PROMOTOR',
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    totp_secret VARCHAR(64),
    totp_enabled BOOLEAN DEFAULT FALSE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Projects
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    location VARCHAR(500),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(100) DEFAULT 'México',
    price_per_sqm FLOAT NOT NULL DEFAULT 1000.0,
    total_lots INTEGER NOT NULL DEFAULT 0,
    available_lots INTEGER NOT NULL DEFAULT 0,
    sold_lots INTEGER NOT NULL DEFAULT 0,
    status projectstatus DEFAULT 'active',
    cover_image_url VARCHAR(500),
    gallery VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clients (antes de lots porque lots referencia clients)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    full_name VARCHAR(500) NOT NULL,
    email VARCHAR(500),
    phone VARCHAR(500),
    address VARCHAR(1000),
    status clientstatus NOT NULL DEFAULT 'lead',
    lead_source leadsource DEFAULT 'website',
    notes TEXT,
    budget_range VARCHAR(255),
    preferred_lot_size FLOAT,
    assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Lots
CREATE TABLE IF NOT EXISTS lots (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    lot_number INTEGER NOT NULL,
    block VARCHAR(50),
    area_sqm FLOAT NOT NULL,
    price_per_sqm FLOAT NOT NULL DEFAULT 1000.0,
    total_price FLOAT NOT NULL,
    status lotstatus NOT NULL DEFAULT 'available',
    map_coordinates VARCHAR(500),
    sold_to_client_id INTEGER REFERENCES clients(id),
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Client Interactions
CREATE TABLE IF NOT EXISTS client_interactions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    interaction_type VARCHAR(50) NOT NULL,
    notes TEXT,
    channel VARCHAR(50),
    metadata_json VARCHAR(2000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sales
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    lot_id INTEGER NOT NULL UNIQUE REFERENCES lots(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sale_price FLOAT NOT NULL,
    down_payment FLOAT NOT NULL DEFAULT 0,
    financing_amount FLOAT NOT NULL DEFAULT 0,
    interest_rate FLOAT,
    payment_terms_months INTEGER,
    monthly_payment FLOAT,
    status salestatus NOT NULL DEFAULT 'reserved',
    notes TEXT,
    reservation_expires_at TIMESTAMPTZ,
    commission_percentage FLOAT,
    commission_amount FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 7. Payment Plans
CREATE TABLE IF NOT EXISTS payment_plans (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    amount FLOAT NOT NULL,
    paid_amount FLOAT DEFAULT 0,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    late_fee FLOAT DEFAULT 0,
    notes VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_plan_id INTEGER REFERENCES payment_plans(id) ON DELETE SET NULL,
    amount FLOAT NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(255),
    receipt_url VARCHAR(500),
    notes VARCHAR(500),
    paid_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ÍNDICES ====================

CREATE INDEX IF NOT EXISTS idx_lots_project_id ON lots(project_id);
CREATE INDEX IF NOT EXISTS idx_lots_status ON lots(status);
CREATE INDEX IF NOT EXISTS idx_clients_project_id ON clients(project_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_agent_id ON clients(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_lot_id ON sales(lot_id);
CREATE INDEX IF NOT EXISTS idx_sales_agent_id ON sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_sale_id ON payment_plans(sale_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_client_id ON payment_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_client_id ON client_interactions(client_id);

-- ==================== SEED DATA ====================
-- Los usuarios admin/promotor se crean automáticamente al iniciar el backend
-- Credenciales iniciales:
--   Admin:     admin@rfdesarrollos.com / Admin123!
--   Promotor:  promotor@rfdesarrollos.com / Promotor123!
