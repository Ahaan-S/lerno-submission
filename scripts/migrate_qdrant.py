"""
One-time migration: copies all vectors from Qdrant Cloud to GCP self-hosted instance.
Uses Python to avoid JavaScript BigInt issues with large point IDs.
"""
import os, sys
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

OLD_URL = os.environ["OLD_QDRANT_URL"]
OLD_KEY = os.environ["OLD_QDRANT_API_KEY"]
NEW_URL = os.environ["NEW_QDRANT_URL"]
NEW_KEY = os.environ["NEW_QDRANT_API_KEY"]

BATCH_SIZE = 100

old = QdrantClient(url=OLD_URL, api_key=OLD_KEY)
new = QdrantClient(url=NEW_URL, api_key=NEW_KEY)

print(f"Source:      {OLD_URL}")
print(f"Destination: {NEW_URL}")

collections = old.get_collections().collections
print(f"\nFound {len(collections)} collection(s): {', '.join(c.name for c in collections)}")

for col in collections:
    name = col.name
    print(f"\n── Migrating collection: {name} ──")

    info = old.get_collection(name)
    dest_cols = [c.name for c in new.get_collections().collections]

    if name in dest_cols:
        print("  Collection exists on destination — will upsert (no data loss)")
    else:
        print("  Creating collection on destination...")
        new.recreate_collection(
            collection_name=name,
            vectors_config=info.config.params.vectors,
        )

    offset = None
    total = 0
    batch = 0

    while True:
        records, next_offset = old.scroll(
            collection_name=name,
            limit=BATCH_SIZE,
            offset=offset,
            with_vectors=True,
            with_payload=True,
        )

        if not records:
            break

        # Convert Record → PointStruct for upsert
        point_structs = [
            PointStruct(id=r.id, vector=r.vector, payload=r.payload or {})
            for r in records if r.vector is not None
        ]
        if not point_structs:
            if next_offset is None:
                break
            offset = next_offset
            continue
        new.upsert(collection_name=name, points=point_structs, wait=True)

        total += len(records)
        batch += 1
        print(f"\r  Batch {batch}: {total} points copied...", end="", flush=True)

        if next_offset is None:
            break
        offset = next_offset

    print(f"\n  Done: {total} points migrated")

    old_count = old.get_collection(name).points_count
    new_count = new.get_collection(name).points_count
    if old_count == new_count:
        print(f"  Count matches: {new_count} ✓")
    else:
        print(f"  ⚠️  Count mismatch — old: {old_count}, new: {new_count}. Re-run to retry.")

print("\n✅ Migration complete.")
print("\nNext: re-create indexes:")
print(f"  QDRANT_URL={NEW_URL} QDRANT_API_KEY={NEW_KEY} npm run qdrant:setup")
