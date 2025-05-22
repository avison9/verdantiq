#!/bin/bash
# wait-for-postgres.sh

set -e

host="$1"
shift
user="$1"
shift
password="$1"
shift
db="$1"
shift
cmd="$@"

until PGPASSWORD=$password psql -h "$host" -U "$user" -d "$db" -c '\q'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 5
done

>&2 echo "Postgres is up - executing command"
exec $cmd