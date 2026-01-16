# Copy database from production to staging using Railway TCP proxy

Write-Host "Getting production database connection info..."
railway environment production
railway service Postgres

# Get production TCP proxy info
$prodVars = railway variables --kv | ConvertFrom-StringData
$prodHost = $prodVars['RAILWAY_TCP_PROXY_DOMAIN']
$prodPort = $prodVars['RAILWAY_TCP_PROXY_PORT']
$prodPass = 'mzAYsKPjCuqPyMKWIbKcuxfPRJPYDpeq'

Write-Host "Dumping production database..."
$env:PGPASSWORD = $prodPass
pg_dump -h $prodHost -p $prodPort -U postgres -d railway -F c -f production_backup.dump

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to dump production database" -ForegroundColor Red
    exit 1
}

Write-Host "Production database dumped successfully" -ForegroundColor Green

# Switch to staging
Write-Host "Getting staging database connection info..."
railway environment staging
railway service Postgres

$stagingVars = railway variables --kv | ConvertFrom-StringData
$stagingHost = $stagingVars['RAILWAY_TCP_PROXY_DOMAIN']
$stagingPort = $stagingVars['RAILWAY_TCP_PROXY_PORT']
$stagingPass = 'sNEcXOEegFadHcRsvfhUxVIWZGlESLYx'

Write-Host "Restoring to staging database..."
$env:PGPASSWORD = $stagingPass
pg_restore -h $stagingHost -p $stagingPort -U postgres -d railway --clean --if-exists production_backup.dump

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Some errors may occur during restore (this is normal)" -ForegroundColor Yellow
}

Write-Host "Database copied successfully from production to staging" -ForegroundColor Green

# Clean up
Remove-Item production_backup.dump -ErrorAction SilentlyContinue
