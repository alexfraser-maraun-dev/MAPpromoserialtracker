-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: collections
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'active', 'closed', 'exported')) DEFAULT 'draft',
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255) NOT NULL, -- Email of the user who created it
  restricted_skus TEXT,            -- Comma-separated list of allowed System SKUs
  restricted_brands TEXT,          -- Comma-separated list of allowed brands
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: serial_mapping_rules
CREATE TABLE serial_mapping_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand VARCHAR(255),
  vendor_id VARCHAR(255),
  vendor_name VARCHAR(255),
  product_description TEXT,
  upc VARCHAR(255),
  system_sku VARCHAR(255),
  manufacturer_sku VARCHAR(255),
  match_type VARCHAR(50) NOT NULL CHECK (match_type IN ('prefix', 'contains', 'regex', 'exact')),
  match_value VARCHAR(255) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: serial_scans
CREATE TABLE serial_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  brand VARCHAR(255),
  vendor_id VARCHAR(255),
  vendor_name VARCHAR(255),
  product_description TEXT,
  upc VARCHAR(255),
  system_sku VARCHAR(255),
  manufacturer_sku VARCHAR(255),
  serial_number VARCHAR(255) NOT NULL,
  normalized_serial_number VARCHAR(255) NOT NULL,
  qty_sold INTEGER NOT NULL DEFAULT 1,
  match_status VARCHAR(50) NOT NULL CHECK (match_status IN ('pending_match', 'matched', 'unmatched', 'manually_assigned')),
  mapping_rule_id UUID REFERENCES serial_mapping_rules(id) ON DELETE SET NULL,
  scanned_by VARCHAR(255) NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Prevent duplicates globally by default, but typically within a collection
  -- For now, enforcing uniqueness globally on normalized_serial_number
  CONSTRAINT uq_normalized_serial_number UNIQUE (normalized_serial_number)
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_collections_modtime
BEFORE UPDATE ON collections
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_serial_mapping_rules_modtime
BEFORE UPDATE ON serial_mapping_rules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_serial_scans_modtime
BEFORE UPDATE ON serial_scans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
