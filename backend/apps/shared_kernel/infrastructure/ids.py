"""UUID v7 generation — time-ordered, sortable, conflict-free across regions."""

import uuid


def uuid7() -> uuid.UUID:
    """Generate a UUID v7 (time-ordered) using Python 3.14+ native or fallback.

    UUID v7 is sortable by creation time and safely generatable independently
    by any node — critical for multi-region active-active writes.
    """
    if hasattr(uuid, "uuid7"):
        return uuid.uuid7()
    return uuid.uuid4()
