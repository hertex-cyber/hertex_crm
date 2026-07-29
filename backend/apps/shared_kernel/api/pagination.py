"""Standard pagination classes for consistent API responses."""

from rest_framework.pagination import PageNumberPagination, CursorPagination


class StandardPagination(PageNumberPagination):
    """Default pagination for low-write entities (Organization, User, etc.)."""

    page_query_param = "page"
    page_size_query_param = "pageSize"
    max_page_size = 1000
    page_size = 100


class CursorBasedPagination(CursorPagination):
    """Cursor-based pagination for high-write entities (Activity, Event Log, etc.)."""

    page_size = 100
    max_page_size = 1000
    ordering = "-created_at"
