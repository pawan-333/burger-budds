param([switch]$PrepareOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$snapshotPath = Join-Path $projectRoot '.data/delivery-collection/schema.json'
$schema = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json
if ($schema.columns | Where-Object { $_.column -in @('collection_method','collected_at','collected_by','collection_reference','purpose') }) {
  throw 'Expected a verified pre-022 schema snapshot. Do not rerun after applying 022.'
}
$statements = @('begin;')
foreach ($table in @('orders','riders','rider_accounts','cashfree_payments','order_events')) {
  $statements += "create temporary table $table (like public.$table including all);"
}
$statements += "create function pg_temp.complete_rider_delivery(uuid,uuid) returns jsonb language sql as 'select null::jsonb';"
$guard = @($schema.functions | Where-Object { $_.name -eq 'guard_cashfree_fulfilment' })
if ($guard.Count -ne 1) { throw 'Verified deployed payment guard required.' }
$statements += $guard[0].definition.Replace('public.','pg_temp.') + ';'
$statements += 'create trigger guard_cashfree_fulfilment before update on pg_temp.orders for each row execute function pg_temp.guard_cashfree_fulfilment();'
$migrationText = [System.IO.File]::ReadAllText((Join-Path $projectRoot 'supabase/migrations/022_delivery_collection.sql'))
$migrationText = [regex]::Replace($migrationText,'(?im)^\s*(begin|commit);\s*$','')
$statements += $migrationText.Replace('public.','pg_temp.')
$statements += [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'delivery-collection-db.test.sql'))
$statements += 'rollback;'
$testSql = $statements -join "`n"
if ($testSql -match '(?im)^\s*commit\s*;') { throw 'Rollback-only harness cannot contain COMMIT.' }
if ($testSql -match '(?im)(alter\s+table|update|insert\s+into|delete\s+from|create\s+(?:or\s+replace\s+)?function|drop\s+function)\s+public\.') {
  throw 'Fixture harness must never mutate public objects.'
}
$outputPath = Join-Path $projectRoot '.data/delivery-collection/rollback-check.sql'
[System.IO.File]::WriteAllText($outputPath, $testSql)
if ($PrepareOnly) { Write-Output 'Prepared rollback-only temporary-schema SQL.'; exit 0 }
& supabase db query --linked --project-ref fyhkxqygoqmllxjfybyt --file $outputPath --output json
exit $LASTEXITCODE
