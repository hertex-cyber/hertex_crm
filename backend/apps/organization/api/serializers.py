"""Organization API serializers."""

from __future__ import annotations

from rest_framework import serializers


class CreateOrgSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=128)


class UpdateOrgSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)


class OrgResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()
    description = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()


class InviteMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.CharField()


class MemberResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    role = serializers.CharField()
    rbac_roles = serializers.ListField(child=serializers.CharField(), default=list)
    status = serializers.CharField()
    created_at = serializers.DateTimeField(allow_null=True)


class ChangeRoleSerializer(serializers.Serializer):
    role = serializers.CharField()


class AcceptInviteSerializer(serializers.Serializer):
    membership_id = serializers.UUIDField()
