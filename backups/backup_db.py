#!/usr/bin/env python3
"""
Simple script to backup Supabase database to SQLite
"""
import os
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from parent directory
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise Exception("Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env file")

# Initialize Supabase client with service role key (bypasses RLS for backups)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Create backup filename with timestamp in the backups directory
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_dir = Path(__file__).parent
backup_file = backup_dir / f'backup_{timestamp}.db'

print(f"Starting backup to {backup_file}...")

# Connect to SQLite
conn = sqlite3.connect(backup_file)
cursor = conn.cursor()

# Define tables to backup
TABLES = [
    'users',
    'locations',
    'categories',
    'items',
    'item_logs',
    'checkout_logs',
    'audit_logs'
]

def create_table_from_data(table_name, sample_record, cursor):
    """Dynamically create SQLite table based on actual data structure"""
    columns = []
    for col_name, value in sample_record.items():
        # Determine SQLite type based on value
        if value is None:
            col_type = 'TEXT'
        elif isinstance(value, bool):
            col_type = 'INTEGER'
        elif isinstance(value, int):
            col_type = 'INTEGER'
        elif isinstance(value, float):
            col_type = 'REAL'
        elif isinstance(value, (dict, list)):
            col_type = 'TEXT'  # Store JSON as text
        else:
            col_type = 'TEXT'

        # Make 'id' the primary key
        if col_name == 'id':
            columns.append(f'{col_name} {col_type} PRIMARY KEY')
        else:
            columns.append(f'{col_name} {col_type}')

    create_sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(columns)})"
    cursor.execute(create_sql)

def backup_table(table_name, cursor):
    """Fetch all data from a Supabase table and insert into SQLite"""
    print(f"Backing up {table_name}...", end=' ')

    try:
        # Fetch all records from Supabase
        response = supabase.table(table_name).select('*').execute()
        records = response.data

        if not records:
            print(f"(empty)")
            return

        # Create table dynamically based on first record
        create_table_from_data(table_name, records[0], cursor)

        # Get column names from first record
        columns = list(records[0].keys())
        placeholders = ','.join(['?' for _ in columns])
        column_names = ','.join(columns)

        # Insert into SQLite
        insert_sql = f'INSERT OR REPLACE INTO {table_name} ({column_names}) VALUES ({placeholders})'

        for record in records:
            values = []
            for col in columns:
                val = record[col]
                # Convert dict/list to string for JSONB columns
                if isinstance(val, (dict, list)):
                    val = json.dumps(val)
                values.append(val)

            cursor.execute(insert_sql, values)

        print(f"({len(records)} records)")

    except Exception as e:
        print(f"Error backing up {table_name}: {e}")

# Backup each table (tables will be created automatically based on data)
for table in TABLES:
    backup_table(table, cursor)

# Commit and close
conn.commit()
conn.close()

print(f"\nBackup complete! Saved to {backup_file}")
print(f"Database size: {os.path.getsize(backup_file) / 1024:.2f} KB")
