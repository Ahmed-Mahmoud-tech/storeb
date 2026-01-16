#!/bin/bash

# Copy database from production to staging
echo "Dumping production database..."

# Dump production database
railway run --environment production pg_dump -U postgres -d railway -F c -f production_backup.dump

if [ $? -ne 0 ]; then
    echo "Failed to dump production database"
    exit 1
fi

echo "Production database dumped successfully"
echo "Restoring to staging database..."

# Drop and recreate staging database to avoid conflicts
railway run --environment staging psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS railway;"
railway run --environment staging psql -U postgres -d postgres -c "CREATE DATABASE railway;"

# Restore to staging
railway run --environment staging pg_restore -U postgres -d railway --clean --if-exists production_backup.dump

if [ $? -ne 0 ]; then
    echo "Failed to restore to staging database"
    exit 1
fi

echo "Database copied successfully from production to staging"

# Clean up backup file
rm production_backup.dump
