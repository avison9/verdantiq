import logging
import time
import random
import sys
from typing import Dict, List, Any
from confluent_kafka import Producer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.error import KafkaError
from confluent_kafka.schema_registry import Schema
from confluent_kafka.serialization import SerializationContext, MessageField
import requests
import os
from requests.exceptions import RequestException
from dotenv import load_dotenv
import json

load_dotenv(override=True)

class SensorSimulator:
    """Simulates agricultural sensor data with Avro serialization, schema registration, and robust error handling."""

    SENSORS = [
        {"type": "soil_moisture", "fields": {"moisture": float, "ph": float}},
        {"type": "poultry_temp", "fields": {"temp_celsius": float, "humidity": float}},
        {"type": "bird_feeder", "fields": {"food_level": float, "battery": float}}
    ]
    
    def __init__(self):
        self._setup_logging()
        self.kafka_brokers = os.getenv('KAFKA_BROKER', "kafka1:9092,kafka2:9092,kafka3:9092,kafka4:9092")
        self.schema_registry_url = os.getenv('SCHEMA_REGISTRY_URL', "http://schema-registry:8089")
        self.max_retries = int(os.getenv('MAX_RETRIES', 5))
        self.retry_delay = int(os.getenv('RETRY_DELAY', 2))
        
        # Initialize schema registry client first
        self.schema_registry_client = SchemaRegistryClient({'url': self.schema_registry_url})
        
        # Register all schemas before creating producer
        self.registered_schemas = {} 
        self._register_all_schemas()
        
        # Then create producer and serializers
        self.producer, self.serializers = self._create_avro_producer()

    def _setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,  
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S')
        self.logger = logging.getLogger(self.__class__.__name__)

    def _register_all_schemas(self):
        """Register all sensor schemas with the Schema Registry."""
        self.logger.info("Registering schemas...")
        for sensor in self.SENSORS:
            schema_str = self.get_avro_schema(sensor["type"], sensor["fields"])
            subject = f"{sensor['type']}-value"
            schema_obj = Schema(schema_str, schema_type="AVRO")
            
            # Check if the schema already exists
            try:
                # Check if schema already exists by trying to retrieve it
                registered_schema = self.schema_registry_client.get_latest_version(subject)
                schema_id = registered_schema.version
                self.logger.info(f"Schema {subject} already registered with ID {schema_id}")
            except Exception as e:
                # If schema is not found (404 error or other), we register a new schema
                if "404" in str(e):
                    schema_id = self.schema_registry_client.register_schema(subject, schema_obj)
                    self.logger.info(f"Registered new schema {subject} with ID {schema_id}")
                else:
                    self.logger.warning(f"Schema lookup failed (attempt 1): {str(e)}")
                    raise
            
            self.registered_schemas[subject] = schema_id
    


    def _create_avro_producer(self) -> tuple[Producer, dict]:
        """Create AvroSerializer with schema registry integration."""
        def topic_record_subject_name_strategy(ctx: SerializationContext, record_name: str) -> str:
            return f"{ctx.topic}-{record_name}"
    
        serializers = {}
        for sensor in self.SENSORS:
            schema_str = self.get_avro_schema(sensor["type"], sensor["fields"])
            subject = f"{sensor['type']}-value"
            schema_id = self.registered_schemas.get(subject)
            
            if not schema_id:
                raise ValueError(f"Schema ID not found for subject: {subject}. Registration failed.")
            
            serializers[sensor["type"]] = AvroSerializer(
                self.schema_registry_client,
                schema_str=schema_str,
                to_dict=lambda data, ctx: data,
                conf={'subject.name.strategy': topic_record_subject_name_strategy}
            )

        producer_config = {
            'bootstrap.servers': self.kafka_brokers,
            'message.send.max.retries': self.max_retries,
            'retry.backoff.ms': self.retry_delay * 1000,
            'retry.backoff.max.ms': 2000,
            'enable.idempotence': True,
            'client.id': 'sensor-data-producer'
        }
        
        return Producer(producer_config), serializers

    def get_avro_schema(self, sensor_type: str, fields: Dict[str, type]) -> str:
        """Generate Avro schema for a sensor type."""
        
        # Validate field types
        valid_field_types = (int, float, str, bool)  
        
        # Ensure all field types are valid
        for field_name, field_type in fields.items():
            if field_type not in valid_field_types:
                raise ValueError(f"Invalid field type '{field_type}' for field '{field_name}'")
        
        # Create the schema
        schema = {
            "type": "record",
            "name": sensor_type,
            "namespace": "com.verdantiq.sensors",
            "fields": [
                {"name": "farm_id", "type": "string"},
                {"name": "timestamp", "type": "long"},
                *[{"name": k, "type": "float" if v in (int, float) else "string"} for k, v in fields.items()]
            ]
        }
        
        # Return as JSON string
        return json.dumps(schema)

    def generate_sensor_data(self) -> List[Dict[str, Any]]:
        """Generate random sensor data for all configured sensor types."""
        return [
            {
                "type": sensor["type"],
                "data": {
                    "farm_id": f"farm_{random.randint(1, 100)}",
                    "timestamp": int(time.time() * 1000),
                    **{k: round(random.uniform(0, 100), 2) for k in sensor["fields"]}
                }
            }
            for sensor in self.SENSORS
        ]

    def send_data(self, data: Dict[str, Any]) -> bool:
        """Send sensor data to Kafka with schema validation."""
        try:
            serializer = self.serializers.get(data["type"])
            if not serializer:
                self.logger.error(f"No serializer found for type: {data['type']}")
                return False

            serialized_value = serializer(data["data"], SerializationContext(topic="raw-sensor-data", field=MessageField.VALUE))

            if serialized_value is None:
                self.logger.error(f"Serialization failed for {data['type']}")
                return False
                
            self.producer.produce(
                topic="raw-sensor-data",
                value=serialized_value,
                callback=self._delivery_callback)
            self.producer.poll(0)
            print(f"Sent {data['type']} data to raw-sensor-data")
            self.logger.debug(f"Sent {data['type']} data")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send data: {str(e)}", exc_info=True)
            return False

    def _delivery_callback(self, err: KafkaError, msg):
        """Handle message delivery callbacks."""
        if err:
            self.logger.error(f"Message delivery failed: {err}")
        else:
            self.logger.debug(
                f"Message delivered to {msg.topic()} [{msg.partition()}] @ offset {msg.offset()}"
            )

    def run(self, interval: int = 15):
        """Main simulation loop with graceful shutdown."""
        self.logger.info("Starting sensor simulation...")
        try:
            while True:
                for sensor_data in self.generate_sensor_data():
                    self.send_data(sensor_data)
                time.sleep(interval)
        except KeyboardInterrupt:
            self.logger.info("Shutting down gracefully...")
        finally:
            self.producer.flush()
            self.logger.info("Flushed all pending messages")

if __name__ == "__main__":
    try:
        simulator = SensorSimulator()
        simulator.run()
    except Exception as e:
        logging.getLogger('sensor-simulator').critical(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)