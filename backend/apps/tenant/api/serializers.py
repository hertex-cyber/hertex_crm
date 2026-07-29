"""Tenant API serializers."""

from __future__ import annotations

from rest_framework import serializers


class TenantResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    organization_id = serializers.UUIDField()
    plan = serializers.CharField()
    status = serializers.CharField()
    settings = serializers.JSONField()
    created_at = serializers.DateTimeField()


class UpdatePlanSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["free", "starter", "professional", "enterprise"])
