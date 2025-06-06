#!/bin/sh

mkdir -p backend/libs/jdbc

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/3.3.6/hadoop-aws-3.3.6.jar -O backend/libs/jdbc/hadoop-aws-3.3.6.jar

wget https://repo1.maven.org/maven2/software/amazon/awssdk/s3/2.20.18/s3-2.20.18.jar -O backend/libs/jdbc/s3-2.20.18.jar

wget https://repo1.maven.org/maven2/com/amazonaws/aws-java-sdk-bundle/1.12.100/aws-java-sdk-bundle-1.12.100.jar -O backend/libs/jdbc/aws-java-sdk-bundle-1.12.100.jar

wget https://jdbc.postgresql.org/download/postgresql-42.7.3.jar -O backend/libs/jdbc/postgresql-42.7.3.jar

wget https://repo1.maven.org/maven2/org/apache/iceberg/iceberg-spark-runtime-3.5_2.12/1.4.2/iceberg-spark-runtime-3.5_2.12-1.4.2.jar -O backend/libs/jdbc/iceberg-spark-runtime-3.5_2.12-1.4.2.jar

wget https://repo1.maven.org/maven2/com/google/guava/guava/30.1.1-jre/guava-30.1.1-jre.jar -O backend/libs/jdbc/guava-30.1.1-jre.jar

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-client-api/3.3.6/hadoop-client-api-3.3.6.jar -O backend/libs/jdbc/hadoop-client-api-3.3.6.jar

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-client-runtime/3.3.6/hadoop-client-runtime-3.3.6.jar -O backend/libs/jdbc/hadoop-client-runtime-3.3.6.jar

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-common/3.3.6/hadoop-common-3.3.6.jar -O backend/libs/jdbc/hadoop-common-3.3.6.jar

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-client/3.3.6/hadoop-client-3.3.6.jar -O backend/libs/jdbc/hadoop-client-3.3.6.jar

wget https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-yarn-server-web-proxy/3.3.6/hadoop-yarn-server-web-proxy-3.3.6.jar -O backend/libs/jdbc/hadoop-yarn-server-web-proxy-3.3.6.jar

wget https://repo1.maven.org/maven2/io/delta/delta-core_2.12/2.4.0/delta-core_2.12-2.4.0.jar -O backend/libs/jdbc/delta-core_2.12-2.4.0.jar

wget https://repo1.maven.org/maven2/org/apache/spark/spark-sql-kafka-0-10_2.12/3.5.1/spark-sql-kafka-0-10_2.12-3.5.1.jar -O spark-sql-kafka-0-10_2.12-3.5.1.jar

wget https://repo1.maven.org/maven2/org/apache/spark/spark-avro_2.12/3.5.1/spark-avro_2.12-3.5.1.jar -O spark-avro_2.12-3.5.1.jar

wget https://packages.confluent.io/maven/io/confluent/kafka-schema-registry-client/7.7.0/kafka-schema-registry-client-7.7.0.jar -O kafka-schema-registry-client-7.7.0.jar

wget https://packages.confluent.io/maven/io/confluent/kafka-avro-serializer/7.7.0/kafka-avro-serializer-7.7.0.jar -O kafka-avro-serializer-7.7.0.jar

wget https://repo1.maven.org/maven2/org/apache/kafka/kafka-clients/3.4.0/kafka-clients-3.4.0.jar -O kafka-clients-3.4.0.jar
# wget https://repo1.maven.org/maven2/org/apache/hive/hive-service-rpc/4.0.0-beta-1/hive-service-rpc-4.0.0-beta-1.jar -O backend/libs/jdbc/hive-service-rpc.jar

# wget https://repo1.maven.org/maven2/io/delta/delta-core_2.12/3.1.0/delta-core_2.12-3.1.0.jar -O backend/libs/jdbc/delta-core.jar