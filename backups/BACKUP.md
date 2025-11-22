# Database Backup

Simple Python script to backup your Supabase database to a local SQLite file.

## Setup

1. Install Python dependencies:
```bash
cd backups
pip install -r requirements.txt
```

## Usage

Run the backup script (from any directory):
```bash
python backups/backup_db.py
```

Or from the backups directory:
```bash
cd backups
python backup_db.py
```

This will create a timestamped SQLite database file (e.g., `backup_20250121_143022.db`) in the `backups/` directory.

## What gets backed up

All tables:
- users
- locations
- categories
- items
- item_logs
- checkout_logs
- audit_logs

## Viewing the backup

You can open the SQLite file with any SQLite viewer:
- [DB Browser for SQLite](https://sqlitebrowser.org/) (GUI)
- `sqlite3 backup_YYYYMMDD_HHMMSS.db` (command line)

## Automating backups

You can set up a cron job or scheduled task to run this script regularly:

```bash
# Example: Daily backup at 2 AM
0 2 * * * cd /path/to/RCCInventoryTracker/backups && python backup_db.py
```
