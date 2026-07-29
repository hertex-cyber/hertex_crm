"""Tenant API URL configuration."""

from __future__ import annotations

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import TenantViewSet

router = DefaultRouter(trailing_slash=False)
router.register(r"", TenantViewSet, basename="tenant")

urlpatterns = [
    path("current", TenantViewSet.as_view({"get": "current"}), name="tenant-current"),
    path("plan", TenantViewSet.as_view({"post": "plan"}), name="tenant-plan"),
] + router.urls
