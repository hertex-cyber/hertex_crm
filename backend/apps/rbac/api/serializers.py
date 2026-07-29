from rest_framework import serializers


class PermissionSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    module = serializers.CharField()
    description = serializers.CharField()


class RoleSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    description = serializers.CharField()
    is_system = serializers.BooleanField()
    permissions = serializers.ListField(child=serializers.CharField())
    member_count = serializers.IntegerField()


class RoleWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    permissions = serializers.ListField(child=serializers.CharField(max_length=100), required=False)


class AssignmentSerializer(serializers.Serializer):
    membership_id = serializers.UUIDField()
