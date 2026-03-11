from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka import KafkaException, KafkaError
import os
from dotenv import load_dotenv
from typing import Dict, List, Any


load_dotenv(override=True)
CLUSTER = os.getenv("KAFKA_BROKER", "kafka1:9092,kafka2:9093,kafka3:9094,kafka4:9095")

def create_kafka_topics(bootstrap_servers: List, topic_list: List) -> None:
    admin_client = AdminClient({
        'bootstrap.servers': bootstrap_servers
    })

    new_topics = []
    for topic in topic_list:
        new_topics.append(NewTopic(
            topic=topic['name'],
            num_partitions=topic.get('num_partitions', 1),
            replication_factor=topic.get('replication_factor', 1)
        ))

    fs = admin_client.create_topics(new_topics)

    for topic, f in fs.items():
        try:
            f.result()  
            print(f"Successfully created topic: {topic}")
        except KafkaException as e:
            error_message = str(e)

            # Check error code if available
            if hasattr(e.args[0], 'code') and e.args[0].code() == KafkaError.TOPIC_ALREADY_EXISTS:
                print(f"Topic already exists (via code): {topic}")
            elif "Topic already exists" in error_message:
                print(f"Topic already exists (via message): {topic}")
            else:
                print(f"Failed to create topic {topic}: {error_message}")
        except Exception as e:
            print(f"Unexpected error creating topic {topic}: {e}")



if __name__ == '__main__':
    print("Creating Topics......")
    topics_to_create = [
        {'name': 'alert', 'num_partitions': 4, 'replication_factor': 2},
        {'name': 'raw-sensor-data', 'num_partitions': 10, 'replication_factor': 3}
    ]

    create_kafka_topics(CLUSTER, topics_to_create)
