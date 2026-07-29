"""Organization API URL configuration."""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import OrgViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"", OrgViewSet, basename="org")

urlpatterns = [
    path("current", OrgViewSet.as_view({"get": "current"}), name="org-current"),
    path("accept-invite", OrgViewSet.as_view({"post": "accept_invite"}), name="org-accept-invite"),
] + router.urls
