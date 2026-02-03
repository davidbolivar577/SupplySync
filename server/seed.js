const pool = require('./db');

const seedText = `
  -- Clear existing data to avoid duplicates if run twice
  TRUNCATE TABLE transactions, maintenance_logs, projects, contractors, inventory RESTART IDENTITY;

  -- 1. Insert Inventory
  INSERT INTO inventory (name, category, quantity, location, status, unit_cost) VALUES
    ('DeWalt 20V Drill', 'TOOL', 5, 'Shelf A1', 'AVAILABLE', 129.99),
    ('Extension Cord (50ft)', 'TOOL', 10, 'Bin 3', 'AVAILABLE', 45.00),
    ('Drywall Screws (Box)', 'PART', 50, 'Shelf B2', 'AVAILABLE', 12.50),
    ('Circular Saw', 'TOOL', 2, 'Shelf A2', 'MAINTENANCE', 150.00);

  -- 2. Insert Contractors
  INSERT INTO contractors (first_name, last_name, contact_info) VALUES
    ('John', 'Smith', '555-123-4567'),
    ('Sarah', 'Connor', 'sarah@example.com');

  -- 3. Insert Projects
  INSERT INTO projects (name, address, status, start_date) VALUES
    ('Downtown Renovation', '123 Main St', 'ACTIVE', '2024-03-01'),
    ('Suburb House Build', '456 Oak Ln', 'PLANNING', '2024-05-15');
    
  -- 4. Log a Transaction (John checked out a Drill)
  INSERT INTO transactions (inventory_id, contractor_id, project_id, action_type, quantity_changed) VALUES
    (1, 1, 1, 'CHECK_OUT', -1);
`;

const seedDatabase = async () => {
    try {
        console.log('🌱 Seeding database...');
        await pool.query(seedText);
        console.log('✅ Database populated with sample data!');
    } catch (err) {
        console.error('❌ Error seeding database:', err);
    } finally {
        pool.end();
    }
};

seedDatabase();