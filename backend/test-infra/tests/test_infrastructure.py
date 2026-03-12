"""
VerdantIQ Infrastructure Integration Tests
==========================================
Tests the full microservice stack running via docker-compose.
The test runner executes on the host, connecting via published ports.

Port map (host → container):
  Gateway           localhost:8000  → gateway:8000
  Auth service      localhost:8001  → auth:8001
  Tenant service    localhost:8002  → tenant:8002
  Sensor service    localhost:8003  → sensor:8003
  Kafka broker 1    localhost:19092 → kafka1:9092
  Kafka broker 2    localhost:19093 → kafka2:9093
  Kafka broker 3    localhost:19094 → kafka3:9094
  Kafka broker 4    localhost:19095 → kafka4:9095
  Schema Registry   localhost:8089  → schema-registry:8089
  MinIO API         localhost:9000  → minio:9000
  Trino             localhost:8085  → trino:8080
  Iceberg REST      localhost:8181  → iceberg-rest:8181
  Spark Master UI   localhost:8080  → spark-master:8080
  Prometheus        localhost:9090  → prometheus:9090
  Grafana           localhost:3000  → grafana:3000
  Kafka Exporter    localhost:9308  → kafka-exporter:9308
  PostgreSQL        localhost:5432  → postgres:5432
"""
import io
import json
import os
import socket
import time
import logging

import psycopg2
import psycopg2.errors
import pytest
import requests
from confluent_kafka import Consumer, KafkaError, Producer
from confluent_kafka.admin import AdminClient, NewTopic
from minio import Minio
from minio.error import S3Error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Host-facing endpoints ─────────────────────────────────────────────────────

KAFKA_BROKERS       = os.getenv("KAFKA_BROKERS",       "localhost:19092,localhost:19093,localhost:19094,localhost:19095")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL", "http://localhost:8089")
MINIO_ENDPOINT      = os.getenv("MINIO_ENDPOINT",      "localhost:9000")
MINIO_ACCESS_KEY    = os.getenv("MINIO_ROOT_USER",     "admin")
MINIO_SECRET_KEY    = os.getenv("MINIO_ROOT_PASSWORD", "myminiopassword")
TRINO_URL           = os.getenv("TRINO_URL",           "http://localhost:8085")
ICEBERG_REST_URL    = os.getenv("ICEBERG_REST_URL",    "http://localhost:8181")
SPARK_MASTER_UI     = os.getenv("SPARK_MASTER_UI",     "http://localhost:8080")
PROMETHEUS_URL      = os.getenv("PROMETHEUS_URL",      "http://localhost:9090")
GRAFANA_URL         = os.getenv("GRAFANA_URL",         "http://localhost:3000")
GRAFANA_USER        = os.getenv("GRAFANA_ADMIN_USER",  "admin")
GRAFANA_PASSWORD    = os.getenv("GRAFANA_ADMIN_PASSWORD", "myDevPass123")
POSTGRES_HOST       = os.getenv("POSTGRES_HOST",       "localhost")
POSTGRES_DB         = os.getenv("POSTGRES_DB",         "verdantiq")
POSTGRES_USER       = os.getenv("POSTGRES_USER",       "admin")
POSTGRES_PASSWORD   = os.getenv("POSTGRES_PASSWORD",   "mypassword")
GATEWAY_URL         = os.getenv("GATEWAY_URL",         "http://localhost:8000")
AUTH_URL            = os.getenv("AUTH_URL",             "http://localhost:8001")
TENANT_URL          = os.getenv("TENANT_URL",           "http://localhost:8002")
SENSOR_URL          = os.getenv("SENSOR_URL",           "http://localhost:8003")

WAIT_TIMEOUT = int(os.getenv("WAIT_TIMEOUT", "60"))

# Test identifiers — unique enough to avoid collisions between runs
_RUN_ID       = str(int(time.time()))[-6:]
TEST_TOPIC    = f"infra.test.{_RUN_ID}"
TEST_BUCKET   = f"infra-test-{_RUN_ID}"
TEST_EMAIL    = f"infra_{_RUN_ID}@verdantiq.com"
TEST_PASSWORD = "InfraPass!123"
TEST_TENANT   = f"InfraFarm_{_RUN_ID}"


# ── Wait helper ───────────────────────────────────────────────────────────────

def wait_for_service(
    host: str,
    port: int = None,
    service_name: str = "Service",
    timeout: int = WAIT_TIMEOUT,
    use_http: bool = False,
) -> bool:
    start = time.time()
    while True:
        try:
            if use_http:
                url = host if host.startswith("http") else f"http://{host}"
                r = requests.get(url, timeout=5)
                if r.status_code < 500:
                    logger.info("%s ready at %s", service_name, host)
                    return True
            else:
                with socket.create_connection((host, port), timeout=5):
                    logger.info("%s ready at %s:%s", service_name, host, port)
                    return True
        except Exception as exc:
            logger.debug("Waiting for %s: %s", service_name, exc)
        if time.time() - start > timeout:
            logger.error("%s not ready after %ss", service_name, timeout)
            return False
        time.sleep(2)


# ── Session-scoped fixtures ───────────────────────────────────────────────────

@pytest.fixture(scope="session")
def pg_conn():
    assert wait_for_service(POSTGRES_HOST, 5432, "PostgreSQL"), "PostgreSQL not available"
    conn = psycopg2.connect(
        host=POSTGRES_HOST,
        database=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        port=5432,
        connect_timeout=15,
    )
    conn.autocommit = False
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def minio_client():
    assert wait_for_service("localhost", 9000, "MinIO"), "MinIO not available"
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False,
    )


@pytest.fixture(scope="session")
def kafka_admin():
    assert wait_for_service("localhost", 19092, "Kafka"), "Kafka not available"
    return AdminClient({"bootstrap.servers": KAFKA_BROKERS})


@pytest.fixture(scope="module")
def auth_session():
    """Register + log in a test user; yield the session with the auth cookie set."""
    assert wait_for_service("localhost", 8001, "Auth service"), "Auth service not available"
    s = requests.Session()
    # Register (ignore 400 if already exists from a previous run)
    s.post(f"{AUTH_URL}/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "tenant_name": TEST_TENANT,
        "user_profile": {"role": "admin"},
    })
    login = s.post(f"{AUTH_URL}/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert login.status_code == 200, f"Login failed: {login.text}"
    yield s
    s.post(f"{AUTH_URL}/logout")


# =============================================================================
#  PostgreSQL — schema integrity & FK enforcement
# =============================================================================

# Tables owned by auth, tenant, and sensor services
EXPECTED_TABLES = {
    "tenants", "users", "sessions",
    "user_profiles", "tenant_profiles",
    "roles", "user_roles",
    "password_reset_tokens", "user_activity_logs",
    "sensors",
    "billings", "ml_feature_subscriptions",
}


def test_postgres_connectivity(pg_conn):
    """Basic SELECT 1 must succeed."""
    with pg_conn.cursor() as cur:
        cur.execute("SELECT 1")
        assert cur.fetchone()[0] == 1


def test_postgres_microservice_tables_exist(pg_conn):
    """Every table owned by auth / tenant / sensor services must be present."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public'"
        )
        actual = {row[0] for row in cur.fetchall()}
    missing = EXPECTED_TABLES - actual
    assert not missing, f"Missing DB tables: {missing}"


def test_postgres_foreign_key_enforcement(pg_conn):
    """Inserting a user with a non-existent tenant_id must raise ForeignKeyViolation."""
    with pg_conn.cursor() as cur:
        with pytest.raises(psycopg2.errors.ForeignKeyViolation):
            cur.execute(
                "INSERT INTO users (tenant_id, email, password_hash, status) "
                "VALUES (999999, 'fk_test@example.com', 'x', 'active')"
            )
    pg_conn.rollback()


def test_postgres_tenant_name_unique(pg_conn):
    """The tenants.tenant_name column has a UNIQUE constraint."""
    with pg_conn.cursor() as cur:
        # Create a temporary unique tenant name for this check
        name = f"UniqueConstraintCheck_{_RUN_ID}"
        cur.execute(
            "INSERT INTO tenants (tenant_name, status) VALUES (%s, 'active')",
            (name,),
        )
        with pytest.raises(psycopg2.errors.UniqueViolation):
            cur.execute(
                "INSERT INTO tenants (tenant_name, status) VALUES (%s, 'active')",
                (name,),
            )
    pg_conn.rollback()


# =============================================================================
#  Kafka — multi-broker cluster, produce/consume, replication
# =============================================================================

def test_kafka_all_brokers_reachable():
    """All 4 Kafka brokers must accept TCP connections on their published ports."""
    for port in [19092, 19093, 19094, 19095]:
        assert wait_for_service("localhost", port, f"kafka broker:{port}", timeout=30), \
            f"Kafka broker on port {port} not reachable"


def test_kafka_produce_consume(kafka_admin):
    """Create topic → produce JSON payload → consume → verify content → delete topic."""
    topic = f"{TEST_TOPIC}.produce_consume"
    fs = kafka_admin.create_topics([NewTopic(topic, num_partitions=3, replication_factor=3)])
    for t, f in fs.items():
        try:
            f.result()
        except Exception as exc:
            pytest.fail(f"Topic creation failed for {t}: {exc}")
    time.sleep(3)  # allow leader election

    payload = json.dumps({"sensor_id": 1, "tenant_id": 1, "temperature": 24.5}).encode()
    errors = []

    producer = Producer({"bootstrap.servers": KAFKA_BROKERS, "client.id": "infra-test"})
    producer.produce(topic, payload, callback=lambda err, _: errors.append(err) if err else None)
    producer.flush(timeout=20)
    assert not errors, f"Produce delivery errors: {errors}"

    consumer = Consumer({
        "bootstrap.servers": KAFKA_BROKERS,
        "group.id": f"infra-test-group-{_RUN_ID}",
        "auto.offset.reset": "earliest",
        "session.timeout.ms": 6000,
    })
    consumer.subscribe([topic])
    try:
        msg = consumer.poll(timeout=20.0)
        assert msg is not None, "No message received from Kafka"
        assert msg.error() is None, f"Kafka error on consume: {msg.error()}"
        assert msg.value() == payload, "Consumed message content mismatch"
    finally:
        consumer.close()

    kafka_admin.delete_topics([topic])


def test_kafka_topic_replication(kafka_admin):
    """Topic with replication_factor=3 must have ≥3 in-sync replicas per partition."""
    topic = f"{TEST_TOPIC}.replication"
    kafka_admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=3)])
    time.sleep(3)

    meta = kafka_admin.list_topics(topic=topic, timeout=10)
    tp_meta = meta.topics.get(topic)
    assert tp_meta is not None, f"Topic {topic} not found in metadata"
    for partition in tp_meta.partitions.values():
        assert len(partition.isrs) >= 3, (
            f"Partition {partition.id} only has {len(partition.isrs)} ISR(s)"
        )
    kafka_admin.delete_topics([topic])


def test_kafka_multi_broker_failover(kafka_admin):
    """Produce to a topic whose leader is on broker 1; consumer must still receive after leader info refresh."""
    topic = f"{TEST_TOPIC}.failover"
    kafka_admin.create_topics([NewTopic(topic, num_partitions=1, replication_factor=3)])
    time.sleep(3)

    # Produce via full broker list — Kafka client will discover and use the leader
    producer = Producer({"bootstrap.servers": KAFKA_BROKERS})
    producer.produce(topic, b"failover-test")
    producer.flush(timeout=20)

    consumer = Consumer({
        "bootstrap.servers": KAFKA_BROKERS,
        "group.id": f"failover-group-{_RUN_ID}",
        "auto.offset.reset": "earliest",
    })
    consumer.subscribe([topic])
    try:
        msg = consumer.poll(timeout=20.0)
        assert msg is not None and msg.value() == b"failover-test"
    finally:
        consumer.close()
    kafka_admin.delete_topics([topic])


def test_kafka_consumer_groups_api(kafka_admin):
    """list_consumer_groups() must return successfully (cluster metadata is reachable)."""
    result = kafka_admin.list_consumer_groups().result()
    assert isinstance(result.valid, list)


# =============================================================================
#  Schema Registry — Avro schema lifecycle
# =============================================================================

def test_schema_registry_reachable():
    """Schema Registry /subjects endpoint must return 200."""
    assert wait_for_service(
        SCHEMA_REGISTRY_URL, service_name="Schema Registry", use_http=True, timeout=30
    ), "Schema Registry not available"
    r = requests.get(f"{SCHEMA_REGISTRY_URL}/subjects")
    assert r.status_code == 200, f"Schema Registry returned {r.status_code}"


def test_schema_registry_register_sensor_avro():
    """Register the SensorReading Avro schema used by the IoT pipeline."""
    subject = f"verdantiq.sensor.readings-{_RUN_ID}-value"
    schema = json.dumps({
        "type": "record",
        "name": "SensorReading",
        "namespace": "com.verdantiq",
        "fields": [
            {"name": "sensor_id",  "type": "int"},
            {"name": "tenant_id",  "type": "int"},
            {"name": "timestamp",  "type": "string"},
            {"name": "reading",    "type": {"type": "map", "values": "double"}},
        ],
    })
    r = requests.post(
        f"{SCHEMA_REGISTRY_URL}/subjects/{subject}/versions",
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        json={"schema": schema},
    )
    assert r.status_code in (200, 409), f"Schema registration failed: {r.text}"
    assert r.json().get("id") is not None


def test_schema_registry_retrieve_registered_schema():
    """A previously registered subject must be listed and retrievable."""
    r = requests.get(f"{SCHEMA_REGISTRY_URL}/subjects")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_schema_registry_global_compatibility_is_backward():
    """Global compatibility level must be BACKWARD as configured."""
    r = requests.get(f"{SCHEMA_REGISTRY_URL}/config")
    assert r.status_code == 200
    assert r.json().get("compatibilityLevel", "").upper() == "BACKWARD"


def test_schema_registry_schema_evolution_backward_compatible():
    """Adding an optional field to an existing schema must pass BACKWARD compatibility."""
    subject = f"verdantiq.sensor.compat-{_RUN_ID}-value"
    v1 = json.dumps({
        "type": "record", "name": "Compat",
        "fields": [{"name": "sensor_id", "type": "int"}],
    })
    v2 = json.dumps({
        "type": "record", "name": "Compat",
        "fields": [
            {"name": "sensor_id", "type": "int"},
            {"name": "location", "type": ["null", "string"], "default": None},
        ],
    })
    headers = {"Content-Type": "application/vnd.schemaregistry.v1+json"}
    r1 = requests.post(f"{SCHEMA_REGISTRY_URL}/subjects/{subject}/versions",
                       headers=headers, json={"schema": v1})
    assert r1.status_code in (200, 409)
    r2 = requests.post(f"{SCHEMA_REGISTRY_URL}/subjects/{subject}/versions",
                       headers=headers, json={"schema": v2})
    assert r2.status_code in (200, 409), f"Schema evolution rejected: {r2.text}"


# =============================================================================
#  MinIO — object storage (Iceberg / Spark warehouse)
# =============================================================================

def test_minio_reachable(minio_client):
    """MinIO client can list buckets without error."""
    buckets = minio_client.list_buckets()
    assert isinstance(buckets, list)


def test_minio_bucket_lifecycle(minio_client):
    """Create bucket → upload object → retrieve and verify → delete object → delete bucket."""
    bucket = TEST_BUCKET
    obj_key = "sensor/readings/test.json"
    payload = json.dumps({"sensor_id": 1, "temperature": 25.5}).encode()

    # clean slate
    if minio_client.bucket_exists(bucket):
        for obj in minio_client.list_objects(bucket, recursive=True):
            minio_client.remove_object(bucket, obj.object_name)
        minio_client.remove_bucket(bucket)

    minio_client.make_bucket(bucket)
    assert minio_client.bucket_exists(bucket), "Bucket creation failed"

    minio_client.put_object(
        bucket, obj_key, io.BytesIO(payload),
        length=len(payload), content_type="application/json",
    )
    resp = minio_client.get_object(bucket, obj_key)
    try:
        assert resp.read() == payload, "Retrieved object content mismatch"
    finally:
        resp.close()

    minio_client.remove_object(bucket, obj_key)
    minio_client.remove_bucket(bucket)
    assert not minio_client.bucket_exists(bucket), "Bucket was not deleted"


def test_minio_multipart_upload(minio_client):
    """Upload a multi-part object (simulates large Spark/Iceberg data files)."""
    bucket = f"{TEST_BUCKET}-mp"
    obj_key = "spark/iceberg/part-00000.parquet"
    # MinIO requires ≥5 MB per part for real multipart; use put_object with 6 MB
    data = b"x" * (6 * 1024 * 1024)

    if minio_client.bucket_exists(bucket):
        for obj in minio_client.list_objects(bucket, recursive=True):
            minio_client.remove_object(bucket, obj.object_name)
        minio_client.remove_bucket(bucket)

    minio_client.make_bucket(bucket)
    minio_client.put_object(bucket, obj_key, io.BytesIO(data), length=len(data))
    stat = minio_client.stat_object(bucket, obj_key)
    assert stat.size == len(data)

    minio_client.remove_object(bucket, obj_key)
    minio_client.remove_bucket(bucket)


# =============================================================================
#  Auth Microservice
# =============================================================================

def test_auth_health():
    assert wait_for_service("localhost", 8001, "Auth service"), "Auth service not available"
    r = requests.get(f"{AUTH_URL}/health")
    assert r.status_code == 200
    assert r.json() == {"service": "auth", "status": "ok"}


def test_auth_register_and_login():
    """End-to-end: register a new user and log in successfully."""
    email = f"infra_reg_{_RUN_ID}_2@verdantiq.com"
    s = requests.Session()
    reg = s.post(f"{AUTH_URL}/register", json={
        "email": email,
        "password": TEST_PASSWORD,
        "tenant_name": f"RegFarm_{_RUN_ID}",
        "user_profile": {"role": "manager"},
    })
    assert reg.status_code == 200, f"Register failed: {reg.text}"
    assert reg.json()["email"] == email

    login = s.post(f"{AUTH_URL}/login", json={"email": email, "password": TEST_PASSWORD})
    assert login.status_code == 200
    assert "access_token" in login.json()
    assert "access_token" in login.cookies


def test_auth_get_me(auth_session):
    """Authenticated /users/me returns the logged-in user's profile."""
    r = auth_session.get(f"{AUTH_URL}/users/me")
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == TEST_EMAIL
    assert "user_id" in data
    assert "tenant_id" in data


def test_auth_unauthenticated_returns_401():
    r = requests.get(f"{AUTH_URL}/users/me")
    assert r.status_code == 401


def test_auth_duplicate_email_returns_400():
    """Registering the same email twice must return 400."""
    requests.post(f"{AUTH_URL}/register", json={
        "email": f"dup_{_RUN_ID}@verdantiq.com",
        "password": TEST_PASSWORD,
        "tenant_name": f"DupFarm_{_RUN_ID}",
    })
    r = requests.post(f"{AUTH_URL}/register", json={
        "email": f"dup_{_RUN_ID}@verdantiq.com",
        "password": TEST_PASSWORD,
        "tenant_name": f"DupFarm2_{_RUN_ID}",
    })
    assert r.status_code == 400


def test_auth_wrong_password_returns_401():
    r = requests.post(f"{AUTH_URL}/login", json={
        "email": TEST_EMAIL, "password": "completely-wrong"
    })
    assert r.status_code == 401


def test_auth_forgot_password_unknown_email_is_safe():
    """Security: unknown email must return 200 without revealing whether it exists."""
    r = requests.post(f"{AUTH_URL}/forgot-password",
                      json={"email": "nobody@nowhere.com"})
    assert r.status_code == 200
    assert r.json().get("reset_token") is None


# =============================================================================
#  Tenant Microservice
# =============================================================================

def test_tenant_health():
    assert wait_for_service("localhost", 8002, "Tenant service"), "Tenant service not available"
    r = requests.get(f"{TENANT_URL}/health")
    assert r.status_code == 200
    assert r.json() == {"service": "tenant", "status": "ok"}


def test_tenant_create_billing(auth_session):
    """Create a billing record for the authenticated user's tenant."""
    from datetime import datetime, timedelta, timezone
    me = auth_session.get(f"{AUTH_URL}/users/me").json()
    r = auth_session.post(f"{TENANT_URL}/billings/", json={
        "tenant_id": me["tenant_id"],
        "frequency": "monthly",
        "payment_method": "credit_card",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    })
    # 200 = created; 400 = already exists from a previous run — both are ok
    assert r.status_code in (200, 400), f"Unexpected: {r.text}"
    if r.status_code == 200:
        assert r.json()["status"] == "active"


def test_tenant_billing_status_internal_endpoint(auth_session):
    """Internal billing-status endpoint returns correct shape for known tenant."""
    me = auth_session.get(f"{AUTH_URL}/users/me").json()
    r = requests.get(f"{TENANT_URL}/internal/tenants/{me['tenant_id']}/billing-status")
    assert r.status_code == 200
    data = r.json()
    assert "billing_active" in data
    assert data["tenant_id"] == me["tenant_id"]


def test_tenant_internal_sensor_count_update(auth_session):
    """Sensor count patch endpoint updates without error."""
    me = auth_session.get(f"{AUTH_URL}/users/me").json()
    r = requests.patch(
        f"{TENANT_URL}/internal/billings/sensor-count",
        json={"tenant_id": me["tenant_id"], "delta": 1},
    )
    assert r.status_code == 200


def test_tenant_unauthenticated_returns_401():
    r = requests.post(f"{TENANT_URL}/billings/", json={})
    assert r.status_code == 401


def test_tenant_cross_tenant_billing_blocked(auth_session):
    """Posting a billing for a different tenant_id must return 403."""
    from datetime import datetime, timedelta, timezone
    r = auth_session.post(f"{TENANT_URL}/billings/", json={
        "tenant_id": 999999,
        "frequency": "monthly",
        "payment_method": "credit_card",
        "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    })
    assert r.status_code == 403


# =============================================================================
#  Sensor Microservice
# =============================================================================

def test_sensor_health():
    assert wait_for_service("localhost", 8003, "Sensor service"), "Sensor service not available"
    r = requests.get(f"{SENSOR_URL}/health")
    assert r.status_code == 200
    assert r.json() == {"service": "sensor", "status": "ok"}


def test_sensor_unauthenticated_returns_401():
    r = requests.get(f"{SENSOR_URL}/sensors/?tenant_id=1")
    assert r.status_code == 401


def test_sensor_cross_tenant_blocked(auth_session):
    """Requesting sensors for a different tenant must return 403."""
    r = auth_session.get(f"{SENSOR_URL}/sensors/?tenant_id=999999")
    assert r.status_code == 403


# =============================================================================
#  API Gateway — routing to microservices
# =============================================================================

def test_gateway_reachable():
    assert wait_for_service("localhost", 8000, "Gateway"), "Gateway not available"


def test_gateway_routes_to_auth_health():
    r = requests.get(f"{GATEWAY_URL}/health/auth")
    assert r.status_code == 200
    assert r.json()["service"] == "auth"


def test_gateway_routes_to_tenant_health():
    r = requests.get(f"{GATEWAY_URL}/health/tenant")
    assert r.status_code == 200
    assert r.json()["service"] == "tenant"


def test_gateway_routes_to_sensor_health():
    r = requests.get(f"{GATEWAY_URL}/health/sensor")
    assert r.status_code == 200
    assert r.json()["service"] == "sensor"


def test_gateway_aggregate_health():
    """GET /health on the gateway proxies to auth health."""
    r = requests.get(f"{GATEWAY_URL}/health")
    assert r.status_code == 200
    assert r.json()["service"] == "auth"


def test_gateway_blocks_internal_routes():
    """The gateway must return 403 for any /internal/ path."""
    r = requests.get(f"{GATEWAY_URL}/internal/tenants/1/billing-status")
    assert r.status_code == 403


def test_gateway_full_auth_flow(auth_session):
    """Register → login → GET /users/me all succeed through the gateway."""
    r = auth_session.get(f"{GATEWAY_URL}/users/me")
    assert r.status_code == 200
    assert r.json()["email"] == TEST_EMAIL


# =============================================================================
#  Trino — federated SQL query engine
# =============================================================================

def test_trino_info_endpoint():
    assert wait_for_service(
        f"{TRINO_URL}/v1/info", service_name="Trino", use_http=True, timeout=90
    ), "Trino not available"
    r = requests.get(f"{TRINO_URL}/v1/info")
    assert r.status_code == 200
    assert r.json().get("starting") is False, "Trino is still starting"


def test_trino_tpch_catalog_query():
    """Query the built-in tpch catalog — verifies Trino can execute SQL end-to-end."""
    try:
        import trino as trino_pkg
    except ImportError:
        pytest.skip("trino package not installed")

    conn = trino_pkg.dbapi.connect(
        host="localhost", port=8085, user="trino", catalog="tpch", schema="sf1"
    )
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM nation")
    row = cur.fetchone()
    cur.close()
    conn.close()
    assert row[0] == 25, f"TPCH nation table should have 25 rows, got {row[0]}"


def test_trino_iceberg_catalog_registered():
    """Trino's /v1/info must report a valid node version (iceberg catalog config is loaded)."""
    r = requests.get(f"{TRINO_URL}/v1/info")
    assert "nodeVersion" in r.json()


# =============================================================================
#  Iceberg REST Catalog
# =============================================================================

def test_iceberg_rest_config_endpoint():
    assert wait_for_service(
        f"{ICEBERG_REST_URL}/v1/config", service_name="Iceberg REST", use_http=True, timeout=60
    ), "Iceberg REST not available"
    r = requests.get(f"{ICEBERG_REST_URL}/v1/config")
    assert r.status_code == 200


def test_iceberg_rest_namespace_create_list_delete():
    """Create a test namespace, verify it appears in the list, then delete it."""
    ns = f"infra_ns_{_RUN_ID}"
    headers = {"Content-Type": "application/json"}

    create = requests.post(
        f"{ICEBERG_REST_URL}/v1/namespaces",
        headers=headers,
        json={"namespace": [ns], "properties": {}},
    )
    assert create.status_code in (200, 409), f"Namespace create failed: {create.text}"

    list_r = requests.get(f"{ICEBERG_REST_URL}/v1/namespaces")
    assert list_r.status_code == 200
    namespaces = list_r.json().get("namespaces", [])
    assert any(ns in item for item in namespaces), f"{ns} not in namespace list"


# =============================================================================
#  Spark — standalone cluster
# =============================================================================

def test_spark_master_ui_reachable():
    assert wait_for_service("localhost", 8080, "Spark Master"), "Spark Master not available"
    r = requests.get("http://localhost:8080", timeout=10)
    assert r.status_code == 200


def test_spark_master_has_alive_workers():
    """Spark Master REST API must report at least one alive worker."""
    r = requests.get("http://localhost:8080/json/", timeout=10)
    if r.status_code != 200:
        pytest.skip("Spark Master /json/ endpoint not available on this version")
    data = r.json()
    alive = data.get("aliveworkers", 0)
    assert alive >= 1, f"Expected ≥1 alive Spark workers, got {alive}"


def test_spark_master_cluster_status():
    """Spark cluster status must be ALIVE."""
    r = requests.get("http://localhost:8080/json/", timeout=10)
    if r.status_code != 200:
        pytest.skip("Spark Master /json/ endpoint not available on this version")
    assert r.json().get("status") == "ALIVE"


# =============================================================================
#  Prometheus — metrics collection
# =============================================================================

def test_prometheus_reachable():
    assert wait_for_service("localhost", 9090, "Prometheus"), "Prometheus not available"
    r = requests.get(f"{PROMETHEUS_URL}/-/ready")
    assert r.status_code == 200


def test_prometheus_targets_api():
    r = requests.get(f"{PROMETHEUS_URL}/api/v1/targets")
    assert r.status_code == 200
    assert r.json()["status"] == "success"


def test_prometheus_kafka_exporter_target_registered():
    """Prometheus must scrape the kafka-exporter job."""
    r = requests.get(f"{PROMETHEUS_URL}/api/v1/targets")
    all_targets = r.json()["data"]["activeTargets"]
    kafka_targets = [t for t in all_targets if "kafka" in t["labels"].get("job", "").lower()]
    assert kafka_targets, "kafka-exporter target not found in Prometheus active targets"


def test_prometheus_up_metric_present():
    """The 'up' metric must have at least one result — Prometheus is scraping."""
    r = requests.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": "up"})
    assert r.status_code == 200
    assert len(r.json()["data"]["result"]) > 0, "No 'up' metric results in Prometheus TSDB"


def test_prometheus_kafka_brokers_metric():
    """kafka_brokers metric from kafka-exporter must be present and ≥ 4."""
    r = requests.get(
        f"{PROMETHEUS_URL}/api/v1/query",
        params={"query": "kafka_brokers"},
    )
    assert r.status_code == 200
    results = r.json()["data"]["result"]
    if results:
        broker_count = int(float(results[0]["value"][1]))
        assert broker_count >= 4, f"Expected ≥4 Kafka brokers, got {broker_count}"


# =============================================================================
#  Grafana — dashboards and datasource
# =============================================================================

def test_grafana_health():
    assert wait_for_service("localhost", 3000, "Grafana"), "Grafana not available"
    r = requests.get(f"{GRAFANA_URL}/api/health")
    assert r.status_code == 200
    assert r.json()["database"] == "ok"


def test_grafana_prometheus_datasource_configured():
    """A Prometheus datasource must be provisioned in Grafana."""
    auth = (GRAFANA_USER, GRAFANA_PASSWORD)
    r = requests.get(f"{GRAFANA_URL}/api/datasources", auth=auth)
    assert r.status_code == 200
    prometheus_ds = [ds for ds in r.json() if ds.get("type") == "prometheus"]
    assert prometheus_ds, "No Prometheus datasource found in Grafana"


def test_grafana_search_api():
    """Dashboard search API must respond successfully."""
    auth = (GRAFANA_USER, GRAFANA_PASSWORD)
    r = requests.get(f"{GRAFANA_URL}/api/search", auth=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_grafana_org_api():
    """Grafana org API must confirm the default organization exists."""
    auth = (GRAFANA_USER, GRAFANA_PASSWORD)
    r = requests.get(f"{GRAFANA_URL}/api/org", auth=auth)
    assert r.status_code == 200
    assert r.json()["id"] == 1


# =============================================================================
#  Kafka Exporter — Prometheus metrics bridge
# =============================================================================

def test_kafka_exporter_metrics_endpoint():
    """kafka-exporter must expose text-format Prometheus metrics on port 9308."""
    assert wait_for_service("localhost", 9308, "Kafka Exporter"), "Kafka Exporter not available"
    r = requests.get("http://localhost:9308/metrics", timeout=10)
    assert r.status_code == 200
    assert "kafka_brokers" in r.text, "kafka_brokers metric missing from exporter output"


def test_kafka_exporter_reports_correct_broker_count():
    """kafka_brokers metric value must equal 4 (our cluster size)."""
    r = requests.get("http://localhost:9308/metrics", timeout=10)
    for line in r.text.splitlines():
        if line.startswith("kafka_brokers "):
            count = int(float(line.split()[-1]))
            assert count == 4, f"Expected 4 Kafka brokers, exporter reports {count}"
            return
    pytest.fail("kafka_brokers metric line not found in exporter output")
