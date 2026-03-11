#!/bin/sh

# list root nodes as health check
# if echo "ls /" | zkCli.sh -server localhost:2181 | grep -q '\[zookeeper\]'; then
#   exit 0
# else
#   exit 1
# fi

for i in $(seq 1 5); do
  echo ruok | nc -w 5 localhost 2181 | grep -q imok && exit 0
  sleep 1
done

exit 1