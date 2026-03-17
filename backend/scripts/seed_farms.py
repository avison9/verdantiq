"""
VerdantIQ — Farm Seeder
=======================
Creates 5 mock farms in the database for testing.

Usage (run from host):
    docker cp backend/scripts/seed_farms.py sensor:/tmp/seed_farms.py
    docker exec sensor python /tmp/seed_farms.py

Or pipe directly (no copy step):
    docker exec -i sensor python3 - < backend/scripts/seed_farms.py

Options:
    TENANT_ID env var  — which tenant to seed into (default: 1)
    DATABASE_URL env var — overrides the default DB connection
"""

import json
import os
import uuid
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import Json

# ── Config ─────────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://admin:mypassword@postgres:5432/verdantiq",
)
TENANT_ID = int(os.getenv("TENANT_ID", "1"))

# ── Mock farm data ─────────────────────────────────────────────────────────────

FARMS = [
    {
        "farm_name":        "Greenfield North Estate",
        "address":          "12 Agric Road, Ogun State",
        "country":          "Nigeria",
        "farm_size_ha":     42.5,
        "farm_type":        "open_field",
        "latitude":         6.8923,
        "longitude":        3.7215,
        "perimeter_km":     7.8,
        "crops":            ["Maize", "Soybean", "Cowpea"],
        "rainfall_avg_mm":  1350.0,
        "sunlight_avg_hrs": 7.2,
        "soil_type":        "Loam",
        "crop_history": [
            {"year": 2022, "crops": ["Maize", "Cowpea"],          "yield_tons": 18.4},
            {"year": 2023, "crops": ["Soybean", "Maize"],         "yield_tons": 21.0},
            {"year": 2024, "crops": ["Maize", "Soybean", "Yam"],  "yield_tons": 26.3},
        ],
        "notes": "Primary cash crop farm. Drip irrigation installed in 2023.",
    },
    {
        "farm_name":        "Sunrise Greenhouse Complex",
        "address":          "Plot 7, Lekki Free Zone, Lagos",
        "country":          "Nigeria",
        "farm_size_ha":     3.2,
        "farm_type":        "greenhouse",
        "latitude":         6.4530,
        "longitude":        3.5120,
        "perimeter_km":     2.3,
        "crops":            ["Tomato", "Pepper", "Lettuce", "Cucumber"],
        "rainfall_avg_mm":  None,
        "sunlight_avg_hrs": 14.0,
        "soil_type":        "Sandy Loam",
        "crop_history": [
            {"year": 2023, "crops": ["Tomato", "Lettuce"],          "yield_tons": 9.5},
            {"year": 2024, "crops": ["Tomato", "Pepper", "Lettuce"],"yield_tons": 12.1},
        ],
        "notes": "Climate-controlled greenhouse. Temperature sensors critical for HVAC automation.",
    },
    {
        "farm_name":        "Riverview Mixed Farm",
        "address":          "KM 14, Ibadan–Abeokuta Expressway, Oyo State",
        "country":          "Nigeria",
        "farm_size_ha":     85.0,
        "farm_type":        "mixed",
        "latitude":         7.2340,
        "longitude":        3.8905,
        "perimeter_km":     14.6,
        "crops":            ["Cassava", "Yam", "Plantain", "Maize"],
        "rainfall_avg_mm":  1420.0,
        "sunlight_avg_hrs": 6.8,
        "soil_type":        "Clay Loam",
        "crop_history": [
            {"year": 2021, "crops": ["Cassava", "Yam"],              "yield_tons": 34.2},
            {"year": 2022, "crops": ["Cassava", "Plantain"],         "yield_tons": 38.7},
            {"year": 2023, "crops": ["Yam", "Maize", "Cassava"],     "yield_tons": 42.5},
            {"year": 2024, "crops": ["Cassava", "Yam", "Plantain"],  "yield_tons": 45.0},
        ],
        "notes": "Largest farm in portfolio. Flood-prone in south quadrant — soil sensors deployed there.",
    },
    {
        "farm_name":        "Delta Hydroponic Hub",
        "address":          "Block C, Tech Farm Estate, Asaba, Delta State",
        "country":          "Nigeria",
        "farm_size_ha":     0.8,
        "farm_type":        "hydroponic",
        "latitude":         6.1960,
        "longitude":        6.7342,
        "perimeter_km":     1.1,
        "crops":            ["Lettuce", "Spinach", "Basil", "Kale"],
        "rainfall_avg_mm":  None,
        "sunlight_avg_hrs": 16.0,
        "soil_type":        None,
        "crop_history": [
            {"year": 2024, "crops": ["Lettuce", "Spinach", "Basil"], "yield_tons": 3.2},
        ],
        "notes": "Nutrient-film technique system. Water flow and EC sensors are mission-critical.",
    },
    {
        "farm_name":        "Savanna West Plantation",
        "address":          "Ungwar Rimi District, Kaduna State",
        "country":          "Nigeria",
        "farm_size_ha":     210.0,
        "farm_type":        "open_field",
        "latitude":         10.5264,
        "longitude":        7.4381,
        "perimeter_km":     31.4,
        "crops":            ["Sorghum", "Millet", "Groundnut", "Cotton"],
        "rainfall_avg_mm":  850.0,
        "sunlight_avg_hrs": 8.5,
        "soil_type":        "Sandy",
        "crop_history": [
            {"year": 2020, "crops": ["Sorghum", "Millet"],            "yield_tons": 62.0},
            {"year": 2021, "crops": ["Groundnut", "Sorghum"],         "yield_tons": 57.5},
            {"year": 2022, "crops": ["Millet", "Cotton"],             "yield_tons": 70.2},
            {"year": 2023, "crops": ["Sorghum", "Groundnut", "Cotton"],"yield_tons": 78.4},
            {"year": 2024, "crops": ["Sorghum", "Millet", "Groundnut"],"yield_tons": 81.0},
        ],
        "notes": "Dryland farming. Weather station sensors essential for drought early-warning.",
    },
]

# ── Seed ───────────────────────────────────────────────────────────────────────

def main():
    # Parse host/port/dbname from DATABASE_URL
    # e.g. postgresql://admin:mypassword@postgres:5432/verdantiq
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    now = datetime.now(timezone.utc)
    inserted = 0
    skipped  = 0

    for farm in FARMS:
        farm_id = str(uuid.uuid4())

        # Check if a farm with the same name already exists for this tenant
        cur.execute(
            "SELECT farm_id FROM farms WHERE tenant_id = %s AND farm_name = %s",
            (TENANT_ID, farm["farm_name"]),
        )
        if cur.fetchone():
            print(f"  [skip]   '{farm['farm_name']}' already exists")
            skipped += 1
            continue

        cur.execute(
            """
            INSERT INTO farms (
                farm_id, tenant_id, farm_name, address, country,
                farm_size_ha, farm_type, latitude, longitude, perimeter_km,
                crops, rainfall_avg_mm, sunlight_avg_hrs, soil_type,
                crop_history, notes, created_at
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s
            )
            """,
            (
                farm_id,
                TENANT_ID,
                farm["farm_name"],
                farm["address"],
                farm["country"],
                farm["farm_size_ha"],
                farm["farm_type"],
                farm["latitude"],
                farm["longitude"],
                farm["perimeter_km"],
                Json(farm["crops"]),
                farm["rainfall_avg_mm"],
                farm["sunlight_avg_hrs"],
                farm["soil_type"],
                Json(farm["crop_history"]),
                farm["notes"],
                now,
            ),
        )
        print(f"  [ok]     '{farm['farm_name']}' → {farm_id}")
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone. {inserted} farm(s) inserted, {skipped} skipped (already exist).")


if __name__ == "__main__":
    main()
