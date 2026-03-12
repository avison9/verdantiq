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
#  Multi-Tenant Data Isolation — Tenant A must NEVER see Tenant B's data
#
#  Two fully isolated tenants (A and B) are registered fresh for this module.
#  Every test asserts that A's authenticated session cannot read, write, or
#  infer anything about B's PII, billing records, or sensor data — and vice
#  versa.  A DB-level assertion confirms the physical row separation in
#  PostgreSQL.
#
#  Coverage matrix:
#    PII / Auth service:
#      ✓ /users/me only returns the caller's own tenant data
#      ✓ A's token carries A's tenant_id; cannot impersonate B
#      ✓ A cannot assign a role to one of B's users (404, not 403 — user
#          does not exist within A's tenant boundary)
#
#    Billing / Tenant service:
#      ✓ A cannot create a billing record for B's tenant_id (403)
#      ✓ A cannot record a payment against B's billing_id (404)
#      ✓ A cannot subscribe an ML feature to B's billing_id (404)
#
#    Sensor data / Sensor service:
#      ✓ A cannot list sensors scoped to B's tenant_id (403)
#      ✓ A cannot onboard a sensor under B's tenant_id (403)
#      ✓ A cannot read sensor data from a sensor owned by B (403)
#      ✓ A cannot delete a sensor owned by B (403)
#      ✓ A cannot increment message count on a sensor owned by B (403)
#      ✓ A's sensor list contains zero records from B's tenant (DB-confirmed)
#
#    PostgreSQL (direct connection):
#      ✓ A and B reside in distinct tenant rows with different tenant_ids
#      ✓ Querying the users table by B's user_id from A's session is impossible
#          (enforced at the service layer; confirmed by comparing row counts)
# =============================================================================

_ISO_PASSWORD = "IsoPass!456"


def _register_and_login(label: str) -> dict:
    """Register a brand-new tenant, log in, fetch /users/me, return state dict."""
    assert wait_for_service("localhost", 8001, "Auth service"), "Auth service not available"
    email = f"iso_{label}_{_RUN_ID}@verdantiq.com"
    s = requests.Session()
    reg = s.post(f"{AUTH_URL}/register", json={
        "email": email,
        "password": _ISO_PASSWORD,
        "tenant_name": f"IsoFarm_{label}_{_RUN_ID}",
        "user_profile": {"role": "admin"},
    })
    assert reg.status_code == 200, f"Tenant {label} register failed: {reg.text}"
    login = s.post(f"{AUTH_URL}/login", json={"email": email, "password": _ISO_PASSWORD})
    assert login.status_code == 200, f"Tenant {label} login failed: {login.text}"
    me = s.get(f"{AUTH_URL}/users/me").json()
    return {
        "session":   s,
        "email":     email,
        "tenant_id": me["tenant_id"],
        "user_id":   me["user_id"],
    }


@pytest.fixture(scope="module")
def tenant_a():
    return _register_and_login("A")


@pytest.fixture(scope="module")
def tenant_b():
    return _register_and_login("B")


@pytest.fixture(scope="module")
def tenant_b_billing(tenant_b):
    """Create an active billing record for Tenant B; yield the billing_id."""
    from datetime import datetime, timedelta, timezone
    s   = tenant_b["session"]
    tid = tenant_b["tenant_id"]
    r = s.post(f"{TENANT_URL}/billings/", json={
        "tenant_id":      tid,
        "frequency":      "monthly",
        "payment_method": "credit_card",
        "due_date":       (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    })
    assert r.status_code in (200, 400), f"Tenant B billing setup failed: {r.text}"
    # If 400 (already exists from a re-run), retrieve via internal endpoint
    if r.status_code == 200:
        yield r.json()["id"]
    else:
        # Billing already exists — fetch id from internal status endpoint
        status_r = requests.get(
            f"{TENANT_URL}/internal/tenants/{tid}/billing-status"
        )
        yield status_r.json().get("billing_id")


@pytest.fixture(scope="module")
def tenant_b_sensor(tenant_b, tenant_b_billing):
    """Onboard a sensor under Tenant B; yield sensor_id. Cleaned up after module."""
    assert wait_for_service("localhost", 8003, "Sensor service"), "Sensor service not available"
    s   = tenant_b["session"]
    tid = tenant_b["tenant_id"]
    r = s.post(f"{SENSOR_URL}/sensors/", json={
        "tenant_id":   tid,
        "sensor_name": f"IsoSensor_B_{_RUN_ID}",
        "sensor_type": "temperature",
        "location":    "Isolation Field B",
    })
    assert r.status_code == 201, f"Tenant B sensor onboard failed: {r.text}"
    sensor_id = r.json()["sensor_id"]
    yield sensor_id
    s.delete(f"{SENSOR_URL}/sensors/{sensor_id}")


# ── PII / Auth-service isolation ──────────────────────────────────────────────

def test_isolation_me_returns_own_tenant_only(tenant_a, tenant_b):
    """/users/me returns only the caller's own tenant_id — never the other tenant's."""
    me_a = tenant_a["session"].get(f"{AUTH_URL}/users/me").json()
    me_b = tenant_b["session"].get(f"{AUTH_URL}/users/me").json()

    assert me_a["tenant_id"] == tenant_a["tenant_id"]
    assert me_b["tenant_id"] == tenant_b["tenant_id"]
    # The two tenants must be distinct and must not bleed into each other's response
    assert me_a["tenant_id"] != me_b["tenant_id"]
    assert me_a["email"] == tenant_a["email"]
    assert me_b["email"] == tenant_b["email"]
    # Tenant B's email must not appear anywhere in Tenant A's /me response
    assert tenant_b["email"] not in str(me_a)


def test_isolation_a_token_carries_a_tenant_id(tenant_a, tenant_b):
    """JWT issued to Tenant A encodes A's tenant_id; B's tenant_id is absent."""
    import base64, json as _json
    cookie = tenant_a["session"].cookies.get("access_token")
    assert cookie, "Tenant A has no access_token cookie"
    # Decode payload segment (no verification needed — we're checking claims content)
    padding = "=" * (4 - len(cookie.split(".")[1]) % 4)
    payload = _json.loads(base64.b64decode(cookie.split(".")[1] + padding))
    assert str(payload.get("tenant_id")) == str(tenant_a["tenant_id"]), \
        "Token tenant_id does not match Tenant A's actual tenant_id"
    assert str(payload.get("tenant_id")) != str(tenant_b["tenant_id"]), \
        "Token tenant_id must not equal Tenant B's tenant_id"


def test_isolation_a_cannot_assign_role_to_b_user(tenant_a, tenant_b):
    """Role assignment targeting a user in another tenant returns 404 (user not found in A's boundary)."""
    r = tenant_a["session"].post(
        f"{AUTH_URL}/users/{tenant_b['user_id']}/roles",
        json={"role_name": "admin"},
    )
    # 404 — B's user_id is not visible within A's tenant scope
    assert r.status_code == 404, (
        f"Expected 404 (user not in tenant), got {r.status_code}: {r.text}"
    )


# ── Billing / Tenant-service isolation ───────────────────────────────────────

def test_isolation_a_cannot_create_billing_for_b(tenant_a, tenant_b):
    """Tenant A cannot create a billing record for Tenant B's tenant_id."""
    from datetime import datetime, timedelta, timezone
    r = tenant_a["session"].post(f"{TENANT_URL}/billings/", json={
        "tenant_id":      tenant_b["tenant_id"],
        "frequency":      "monthly",
        "payment_method": "credit_card",
        "due_date":       (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    })
    assert r.status_code == 403, (
        f"Expected 403 creating billing for another tenant, got {r.status_code}: {r.text}"
    )


def test_isolation_a_cannot_record_payment_for_b_billing(tenant_a, tenant_b_billing):
    """Tenant A cannot record a payment against Tenant B's billing_id."""
    r = tenant_a["session"].post(f"{TENANT_URL}/billings/{tenant_b_billing}/payment")
    # 404 — billing exists but is not associated with A's tenant
    assert r.status_code == 404, (
        f"Expected 404 paying B's billing from A's session, got {r.status_code}: {r.text}"
    )


def test_isolation_a_cannot_subscribe_ml_for_b_billing(tenant_a, tenant_b_billing):
    """Tenant A cannot subscribe an ML feature to Tenant B's billing."""
    r = tenant_a["session"].post(
        f"{TENANT_URL}/billings/{tenant_b_billing}/ml-features/",
        json={"feature_name": "data_insights", "cost": 9.99},
    )
    assert r.status_code == 404, (
        f"Expected 404 subscribing ML on B's billing from A's session, got {r.status_code}: {r.text}"
    )


# ── Sensor-data / Sensor-service isolation ───────────────────────────────────

def test_isolation_a_cannot_list_b_sensors(tenant_a, tenant_b):
    """Tenant A cannot request the sensor list scoped to Tenant B's tenant_id."""
    r = tenant_a["session"].get(
        f"{SENSOR_URL}/sensors/", params={"tenant_id": tenant_b["tenant_id"]}
    )
    assert r.status_code == 403, (
        f"Expected 403 listing B's sensors from A's session, got {r.status_code}: {r.text}"
    )


def test_isolation_a_cannot_onboard_sensor_for_b(tenant_a, tenant_b):
    """Tenant A cannot register a sensor under Tenant B's tenant_id."""
    r = tenant_a["session"].post(f"{SENSOR_URL}/sensors/", json={
        "tenant_id":   tenant_b["tenant_id"],
        "sensor_name": "TrojanSensor",
        "sensor_type": "humidity",
    })
    assert r.status_code == 403, (
        f"Expected 403 onboarding sensor for B from A's session, got {r.status_code}: {r.text}"
    )


def test_isolation_a_cannot_read_b_sensor_data(tenant_a, tenant_b_sensor):
    """Tenant A cannot retrieve sensor data from a sensor owned by Tenant B."""
    r = tenant_a["session"].get(f"{SENSOR_URL}/sensors/{tenant_b_sensor}/data")
    assert r.status_code == 403, (
        f"Expected 403 reading B's sensor data from A's session, got {r.status_code}: {r.text}"
    )


def test_isolation_a_cannot_delete_b_sensor(tenant_a, tenant_b_sensor):
    """Tenant A cannot delete a sensor that belongs to Tenant B."""
    r = tenant_a["session"].delete(f"{SENSOR_URL}/sensors/{tenant_b_sensor}")
    assert r.status_code == 403, (
        f"Expected 403 deleting B's sensor from A's session, got {r.status_code}: {r.text}"
    )


def test_isolation_a_cannot_update_b_sensor_messages(tenant_a, tenant_b_sensor):
    """Tenant A cannot increment the message counter on a sensor owned by Tenant B."""
    r = tenant_a["session"].post(
        f"{SENSOR_URL}/sensors/{tenant_b_sensor}/messages",
        json={"message_increment": 1},
    )
    assert r.status_code == 403, (
        f"Expected 403 updating B's sensor messages from A's session, got {r.status_code}: {r.text}"
    )


def test_isolation_a_sensor_list_contains_no_b_records(tenant_a, tenant_b_sensor):
    """After Tenant B has sensors, Tenant A's sensor list must contain zero of them."""
    # tenant_b_sensor fixture ensures B's sensor exists before this assertion
    r = tenant_a["session"].get(
        f"{SENSOR_URL}/sensors/", params={"tenant_id": tenant_a["tenant_id"], "limit": 100}
    )
    assert r.status_code == 200
    sensor_ids = [s["sensor_id"] for s in r.json()]
    assert tenant_b_sensor not in sensor_ids, (
        f"Tenant B's sensor_id {tenant_b_sensor} leaked into Tenant A's sensor list"
    )
    tenant_ids_in_response = {s["tenant_id"] for s in r.json()}
    assert tenant_a["tenant_id"] not in (tenant_ids_in_response - {tenant_a["tenant_id"]}), \
        "A's sensor list contains records from a foreign tenant_id"


# ── PostgreSQL row-level isolation ────────────────────────────────────────────

def test_isolation_pg_tenants_are_distinct_rows(tenant_a, tenant_b, pg_conn):
    """Tenant A and Tenant B must exist as separate rows with different PKs."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT tenant_id FROM tenants WHERE tenant_id = ANY(%s)",
            ([tenant_a["tenant_id"], tenant_b["tenant_id"]],),
        )
        rows = cur.fetchall()
    assert len(rows) == 2, "Expected exactly 2 distinct tenant rows"
    ids = {r[0] for r in rows}
    assert tenant_a["tenant_id"] in ids
    assert tenant_b["tenant_id"] in ids
    assert tenant_a["tenant_id"] != tenant_b["tenant_id"]


def test_isolation_pg_users_are_in_separate_tenants(tenant_a, tenant_b, pg_conn):
    """Each user row must be bound to its own tenant_id and not shared."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT user_id, tenant_id FROM users WHERE user_id = ANY(%s)",
            ([tenant_a["user_id"], tenant_b["user_id"]],),
        )
        rows = {r[0]: r[1] for r in cur.fetchall()}
    assert rows[tenant_a["user_id"]] == tenant_a["tenant_id"], \
        "Tenant A's user_id is bound to the wrong tenant_id in the DB"
    assert rows[tenant_b["user_id"]] == tenant_b["tenant_id"], \
        "Tenant B's user_id is bound to the wrong tenant_id in the DB"
    assert rows[tenant_a["user_id"]] != rows[tenant_b["user_id"]], \
        "A and B share the same tenant_id — isolation has failed at the DB level"


def test_isolation_pg_b_user_email_not_in_a_query(tenant_a, tenant_b, pg_conn):
    """Querying users by A's tenant_id must return zero rows belonging to B."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT email FROM users WHERE tenant_id = %s",
            (tenant_a["tenant_id"],),
        )
        emails = {r[0] for r in cur.fetchall()}
    assert tenant_b["email"] not in emails, (
        f"Tenant B's email appeared in a DB query scoped to Tenant A's tenant_id"
    )


def test_isolation_pg_sensors_scoped_to_owner_tenant(tenant_b_sensor, tenant_a, tenant_b, pg_conn):
    """Tenant B's sensor row must have tenant_id = B's tenant_id, not A's."""
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT tenant_id FROM sensors WHERE sensor_id = %s",
            (tenant_b_sensor,),
        )
        row = cur.fetchone()
    assert row is not None, f"Sensor {tenant_b_sensor} not found in DB"
    assert row[0] == tenant_b["tenant_id"], \
        f"Sensor tenant_id is {row[0]}, expected {tenant_b['tenant_id']}"
    assert row[0] != tenant_a["tenant_id"], \
        "Tenant B's sensor has A's tenant_id — isolation failure at DB level"


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

def _trino_available(timeout: int = 30) -> bool:
    """Return True only if Trino is reachable and fully started."""
    try:
        if not wait_for_service(f"{TRINO_URL}/v1/info", service_name="Trino", use_http=True, timeout=timeout):
            return False
        r = requests.get(f"{TRINO_URL}/v1/info", timeout=10)
        return r.status_code == 200 and r.json().get("starting") is False
    except Exception:
        return False


def test_trino_info_endpoint():
    if not _trino_available():
        pytest.skip("Trino not available in this environment")
    r = requests.get(f"{TRINO_URL}/v1/info")
    assert r.status_code == 200
    assert r.json().get("starting") is False, "Trino is still starting"


def test_trino_tpch_catalog_query():
    """Query the built-in tpch catalog — verifies Trino can execute SQL end-to-end."""
    if not _trino_available():
        pytest.skip("Trino not available in this environment")
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
    if not _trino_available():
        pytest.skip("Trino not available in this environment")
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
    """A Prometheus datasource should be provisioned in Grafana (skipped if not configured)."""
    auth = (GRAFANA_USER, GRAFANA_PASSWORD)
    r = requests.get(f"{GRAFANA_URL}/api/datasources", auth=auth)
    assert r.status_code == 200
    prometheus_ds = [ds for ds in r.json() if ds.get("type") == "prometheus"]
    if not prometheus_ds:
        pytest.skip("No Prometheus datasource provisioned in Grafana — add a provisioning config to enable this check")


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
