#!/usr/bin/env bash
set -euo pipefail

echo "Esperando a SQL Server (auth-sql:1433)..."
for i in {1..60}; do
  if sqlcmd -S auth-sql -U sa -P "${MSSQL_SA_PASSWORD}" -Q "SELECT 1" -b -o /dev/null 2>&1; then
    break
  fi
  echo "  intento $i/60..."
  sleep 2
done

echo "Ejecutando seed /sql/auth-init.sql ..."
sqlcmd -S auth-sql -U sa -P "${MSSQL_SA_PASSWORD}" -d master -i /sql/auth-init.sql -b
echo "Seed OK"