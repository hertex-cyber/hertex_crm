from uuid import UUID

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.lead_management.application.services import LeadService
from apps.shared_kernel.api.pagination import StandardPagination
from apps.shared_kernel.domain.errors import NotFoundError, PermissionDeniedError, ValidationError

from .permissions import HasLeadPermission
from .serializers import (
    LeadAssignSerializer,
    LeadConvertSerializer,
    LeadScoreSerializer,
    LeadSerializer,
    LeadStatusSerializer,
    LeadUpdateSerializer,
    LeadWriteSerializer,
)


def organization_id(request):
    value = request.headers.get("X-Organization-ID")
    if not value:
        raise ValidationError("X-Organization-ID header is required")
    try:
        return UUID(str(value))
    except ValueError as exc:
        raise ValidationError("X-Organization-ID must be a valid UUID") from exc


def error_response(error):
    status_code = (
        status.HTTP_403_FORBIDDEN
        if isinstance(error, PermissionDeniedError)
        else status.HTTP_404_NOT_FOUND
        if isinstance(error, NotFoundError)
        else status.HTTP_400_BAD_REQUEST
    )
    return Response({"error": {"code": "LEAD_ERROR", "message": str(error)}}, status=status_code)


class LeadListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def get(self, request):
        try:
            org_id = organization_id(request)
            service = LeadService()
            raw_pid = request.query_params.get("pipeline_id")
            pipeline_id = UUID(raw_pid) if (raw_pid and raw_pid not in ("undefined", "null")) else None
            leads = service.list_leads(
                org_id,
                status=request.query_params.get("status"),
                source=request.query_params.get("source"),
                assigned_to_id=request.query_params.get("assigned_to_id"),
                pipeline_id=pipeline_id,
                search=request.query_params.get("search"),
                sort_by=request.query_params.get("sort_by", "-created_at"),
            )
            lead_dicts = [service._model_to_dict(m) for m in leads]
            paginator = StandardPagination()
            page = paginator.paginate_queryset(lead_dicts, request)
            if page is not None:
                serializer = LeadSerializer(page, many=True)
                return paginator.get_paginated_response(serializer.data)
            return Response(LeadSerializer(lead_dicts, many=True).data)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)

    required_permission_create = "lead.create"

    def post(self, request):
        serializer = LeadWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.create_lead(org_id, **serializer.validated_data)
            return Response(LeadSerializer(lead).data, status=status.HTTP_201_CREATED)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)

    def initial(self, request, *args, **kwargs):
        if request.method.upper() == "POST":
            self.required_permission = self.required_permission_create
        else:
            self.required_permission = getattr(self, "required_permission", "lead.view")
        super().initial(request, *args, **kwargs)


class LeadDetailView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def get(self, request, lead_id):
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.get_lead(lead_id, org_id)
            return Response(LeadSerializer(lead).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)

    required_permission_update = "lead.update"

    def patch(self, request, lead_id):
        serializer = LeadUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.update_lead(lead_id, org_id, **serializer.validated_data)
            return Response(LeadSerializer(lead).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)

    required_permission_delete = "lead.delete"

    def delete(self, request, lead_id):
        try:
            org_id = organization_id(request)
            service = LeadService()
            service.delete_lead(lead_id, org_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)

    def initial(self, request, *args, **kwargs):
        method_map = {"PATCH": self.required_permission_update, "DELETE": self.required_permission_delete}
        self.required_permission = method_map.get(request.method.upper(), self.required_permission)
        super().initial(request, *args, **kwargs)


class LeadAssignView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        serializer = LeadAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.assign_lead(lead_id, org_id, serializer.validated_data["assigned_to_id"])
            return Response(LeadSerializer(lead).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)


class LeadStatusView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        serializer = LeadStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.change_status(
                lead_id, org_id, serializer.validated_data["status"], serializer.validated_data.get("reason", "")
            )
            return Response(LeadSerializer(lead).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)


class LeadScoreView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        serializer = LeadScoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.score_lead(lead_id, org_id, serializer.validated_data["score"])
            return Response(LeadSerializer(lead).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)


class LeadConvertView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        serializer = LeadConvertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.convert_lead(lead_id, org_id, **serializer.validated_data)
            return Response(LeadSerializer(lead).data)
        except (ValidationError, PermissionDeniedError, NotFoundError) as error:
            return error_response(error)


class LeadDuplicateView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def get(self, request):
        try:
            org_id = organization_id(request)
            service = LeadService()
            email = request.query_params.get("email")
            duplicates = service.find_duplicates(org_id, email=email)
            return Response(LeadSerializer(duplicates, many=True).data)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)


class PipelineListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def get(self, request):
        try:
            org_id = organization_id(request)
            service = LeadService()
            pipelines = service.list_pipelines(org_id)
            return Response([service._pipeline_dict(p) for p in pipelines])
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)

    def post(self, request):
        from .serializers import PipelineWriteSerializer
        serializer = PipelineWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            pipeline = service.create_pipeline(org_id, **serializer.validated_data)
            return Response(service._pipeline_dict(pipeline), status=status.HTTP_201_CREATED)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)


class PipelineDetailView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def patch(self, request, pipeline_id):
        from .serializers import PipelineWriteSerializer
        serializer = PipelineWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            pipeline = service.update_pipeline(pipeline_id, org_id, **serializer.validated_data)
            return Response(service._pipeline_dict(pipeline))
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)

    def delete(self, request, pipeline_id):
        try:
            org_id = organization_id(request)
            service = LeadService()
            service.delete_pipeline(pipeline_id, org_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadStageListCreateView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def get(self, request):
        try:
            org_id = organization_id(request)
            raw = request.query_params.get("pipeline_id")
            pipeline_id = UUID(raw) if raw and raw != "undefined" and raw != "null" else None
            service = LeadService()
            stages = service.list_stages(org_id, pipeline_id)
            return Response([service._stage_dict(s) for s in stages])
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)

    def post(self, request):
        from .serializers import LeadStageSerializer
        serializer = LeadStageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            stage = service.create_stage(org_id, **serializer.validated_data)
            return Response(service._stage_dict(stage), status=status.HTTP_201_CREATED)
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)


class LeadStageDetailView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def patch(self, request, stage_id):
        from .serializers import LeadStageSerializer
        serializer = LeadStageSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            stage = service.update_stage(stage_id, org_id, **serializer.validated_data)
            return Response(service._stage_dict(stage))
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)

    def delete(self, request, stage_id):
        try:
            org_id = organization_id(request)
            service = LeadService()
            service.delete_stage(stage_id, org_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadStageChangeView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        stage_id = request.data.get("stage_id")
        if not stage_id:
            return Response({"error": "stage_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            org_id = organization_id(request)
            service = LeadService()
            lead = service.change_lead_stage(lead_id, org_id, UUID(stage_id))
            return Response(LeadSerializer(lead).data)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadCommunicationListView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def get(self, request, lead_id):
        try:
            org_id = organization_id(request)
            service = LeadService()
            comms = service.list_communications(lead_id, org_id)
            from .serializers import CommunicationSerializer
            return Response(CommunicationSerializer(comms, many=True).data)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)

    def post(self, request, lead_id):
        from .serializers import CommunicationWriteSerializer
        serializer = CommunicationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            comm = service.log_communication(lead_id, org_id, **serializer.validated_data)
            from .serializers import CommunicationSerializer
            return Response(CommunicationSerializer(comm).data, status=status.HTTP_201_CREATED)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadEmailSendView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        from .serializers import EmailSendSerializer
        serializer = EmailSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            comm = service.send_email(lead_id, org_id, **serializer.validated_data)
            from .serializers import CommunicationSerializer
            return Response(CommunicationSerializer(comm).data, status=status.HTTP_201_CREATED)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadWhatsAppSendView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        from .serializers import WhatsAppSendSerializer
        serializer = WhatsAppSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            comm = service.send_whatsapp(lead_id, org_id, **serializer.validated_data)
            from .serializers import CommunicationSerializer
            return Response(CommunicationSerializer(comm).data, status=status.HTTP_201_CREATED)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadCallLogView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.update"

    def post(self, request, lead_id):
        from .serializers import CallLogSerializer
        serializer = CallLogSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            org_id = organization_id(request)
            service = LeadService()
            comm = service.log_call(lead_id, org_id, **serializer.validated_data)
            from .serializers import CommunicationSerializer
            return Response(CommunicationSerializer(comm).data, status=status.HTTP_201_CREATED)
        except (ValidationError, NotFoundError, PermissionDeniedError) as error:
            return error_response(error)


class LeadStageReorderView(APIView):
    permission_classes = [IsAuthenticated, HasLeadPermission]
    required_permission = "lead.view"

    def post(self, request):
        stage_ids = request.data.get("stage_ids", [])
        try:
            org_id = organization_id(request)
            service = LeadService()
            stages = service.reorder_stages(org_id, [UUID(s) for s in stage_ids])
            return Response([service._stage_dict(s) for s in stages])
        except (ValidationError, PermissionDeniedError) as error:
            return error_response(error)
