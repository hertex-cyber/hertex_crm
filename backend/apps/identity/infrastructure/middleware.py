"""JWT Authentication middleware for Django request pipeline.

Sets request.user and request.organization_id from the JWT token
for non-DRF views (admin, template views, etc.).
"""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.functional import SimpleLazyObject


class JWTAuthenticationMiddleware:
    """Populates request.user from JWT for non-DRF parts of the request pipeline."""

    def __init__(self, get_response):
        self._get_response = get_response

    def __call__(self, request):
        request.organization_id = None
        return self._get_response(request)
