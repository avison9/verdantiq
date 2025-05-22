#!/bin/sh

mkdir -p backend/libs/jdbc

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/3.3.6/hadoop-aws-3.3.6.jar -O backend/libs/jdbc/hadoop.jar

wget https://repo1.maven.org/maven2/software/amazon/awssdk/s3/2.20.18/s3-2.20.18.jar -O backend/libs/jdbc/aws-sdk2.jar

wget https://repo1.maven.org/maven2/com/amazonaws/aws-java-sdk-bundle/1.12.100/aws-java-sdk-bundle-1.12.100.jar -O backend/libs/jdbc/aws-sdk2.jar

wget https://jdbc.postgresql.org/download/postgresql-42.7.3.jar -O backend/libs/jdbc/postgresql-jdbc.jar

# wget https://repo1.maven.org/maven2/org/apache/hive/hive-service-rpc/4.0.0-beta-1/hive-service-rpc-4.0.0-beta-1.jar -O backend/libs/jdbc/hive-service-rpc.jar

wget https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-spark-runtime-3.5_2.12/1.4.2/iceberg-spark-runtime-3.5_2.12-1.4.2.jar -O backend/libs/jdbc/iceberg-spark-runtime.jar

wget https://repo1.maven.org/maven2/io/delta/delta-core_2.12/3.1.0/delta-core_2.12-3.1.0.jar -O backend/libs/jdbc/delta-core.jar


wget https://repo1.maven.org/maven2/com/google/guava/guava/30.1.1-jre/guava-30.1-jre.jar -O backend/libs/jdbc/guava-30.1-jre.jar