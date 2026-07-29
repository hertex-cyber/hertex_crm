from rest_framework import serializers


class LeadSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    email = serializers.EmailField()
    phone = serializers.CharField()
    company = serializers.CharField()
    title = serializers.CharField()
    source = serializers.CharField()
    status = serializers.CharField()
    score = serializers.IntegerField()
    notes = serializers.CharField()
    owner_id = serializers.UUIDField(allow_null=True)
    assigned_to_id = serializers.UUIDField(allow_null=True)
    disqualification_reason = serializers.CharField()
    converted_at = serializers.DateTimeField(allow_null=True)
    converted_to_contact_id = serializers.UUIDField(allow_null=True)
    converted_to_opportunity_id = serializers.UUIDField(allow_null=True)
    stage = serializers.DictField(allow_null=True, required=False)
    organization_id = serializers.UUIDField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class LeadWriteSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=120)
    last_name = serializers.CharField(max_length=120)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    company = serializers.CharField(max_length=200, required=False, allow_blank=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    source = serializers.ChoiceField(
        choices=["WEB_FORM", "REFERRAL", "COLD_CALL", "EMAIL", "SOCIAL_MEDIA", "PARTNER", "OTHER"],
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    owner_id = serializers.UUIDField(required=False, allow_null=True)
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)
    pipeline_id = serializers.UUIDField(required=False, allow_null=True)


class LeadUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=120, required=False)
    last_name = serializers.CharField(max_length=120, required=False)
    email = serializers.EmailField(max_length=254, required=False)
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    company = serializers.CharField(max_length=200, required=False, allow_blank=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    source = serializers.ChoiceField(
        choices=["WEB_FORM", "REFERRAL", "COLD_CALL", "EMAIL", "SOCIAL_MEDIA", "PARTNER", "OTHER"],
        required=False,
    )
    notes = serializers.CharField(required=False, allow_blank=True)
    owner_id = serializers.UUIDField(required=False, allow_null=True)
    assigned_to_id = serializers.UUIDField(required=False, allow_null=True)


class LeadStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=["NEW", "CONTACTED", "QUALIFIED", "DISQUALIFIED", "RECYCLED"]
    )
    reason = serializers.CharField(required=False, allow_blank=True)


class LeadScoreSerializer(serializers.Serializer):
    score = serializers.IntegerField(min_value=0, max_value=100)


class LeadAssignSerializer(serializers.Serializer):
    assigned_to_id = serializers.UUIDField(allow_null=True)


class LeadConvertSerializer(serializers.Serializer):
    contact_id = serializers.UUIDField()
    opportunity_id = serializers.UUIDField(required=False, allow_null=True)


class CommunicationSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    type = serializers.CharField()
    direction = serializers.CharField()
    subject = serializers.CharField()
    body = serializers.CharField()
    from_address = serializers.CharField()
    to_address = serializers.CharField()
    status = serializers.CharField()
    metadata = serializers.DictField()
    created_at = serializers.DateTimeField()


class CommunicationWriteSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["EMAIL", "WHATSAPP", "CALL", "SMS"])
    direction = serializers.ChoiceField(choices=["OUTBOUND", "INBOUND"], default="OUTBOUND")
    subject = serializers.CharField(required=False, allow_blank=True)
    body = serializers.CharField(required=False, allow_blank=True)
    to_address = serializers.CharField(required=False, allow_blank=True)
    from_address = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.DictField(required=False, default=dict)


class EmailSendSerializer(serializers.Serializer):
    subject = serializers.CharField()
    body = serializers.CharField()
    to_address = serializers.CharField(required=False, allow_blank=True)


class WhatsAppSendSerializer(serializers.Serializer):
    message = serializers.CharField()
    to_phone = serializers.CharField(required=False, allow_blank=True)


class CallLogSerializer(serializers.Serializer):
    direction = serializers.ChoiceField(choices=["OUTBOUND", "INBOUND"], default="OUTBOUND")
    duration = serializers.IntegerField(default=0, required=False)
    notes = serializers.CharField(required=False, allow_blank=True)


class LeadStageSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=80)
    color = serializers.CharField(max_length=7, required=False)
    is_terminal = serializers.BooleanField(required=False)
    pipeline_id = serializers.UUIDField(required=False, allow_null=True)


class PipelineSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True)


class PipelineWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    description = serializers.CharField(required=False, allow_blank=True)
