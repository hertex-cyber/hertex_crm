from __future__ import annotations

from uuid import UUID

from django.db import IntegrityError, models, transaction
from django.db.models import Q

from apps.lead_management.domain.entities import Lead
from apps.lead_management.models import ActivityLogModel, CommunicationLogModel, LeadModel, LeadStageModel, PipelineModel
from apps.shared_kernel.application.ports import EventPublisher
from apps.shared_kernel.domain.errors import NotFoundError, PermissionDeniedError, ValidationError
from apps.shared_kernel.infrastructure.event_bus import CeleryEventPublisher


class LeadService:
    VALID_SORT_FIELDS = {"created_at", "updated_at", "first_name", "last_name", "email", "score", "status"}

    def __init__(self, event_publisher: EventPublisher | None = None) -> None:
        self.event_publisher = event_publisher or CeleryEventPublisher()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_model(self, lead_id: UUID, organization_id: UUID) -> LeadModel:
        try:
            return LeadModel.objects.get(id=lead_id, organization_id=organization_id)
        except LeadModel.DoesNotExist as exc:
            raise NotFoundError("Lead not found", resource_id=str(lead_id)) from exc

    def _pipeline_dict(self, pipeline: PipelineModel) -> dict:
        return {
            "id": pipeline.id,
            "name": pipeline.name,
            "description": pipeline.description,
            "created_at": pipeline.created_at.isoformat() if pipeline.created_at else None,
            "updated_at": pipeline.updated_at.isoformat() if pipeline.updated_at else None,
        }

    def _stage_dict(self, stage: LeadStageModel) -> dict:
        return {
            "id": stage.id,
            "name": stage.name,
            "order": stage.order,
            "color": stage.color,
            "is_terminal": stage.is_terminal,
            "pipeline_id": stage.pipeline_id,
        }

    def _model_to_dict(self, model: LeadModel) -> dict:
        return {
            "id": model.id,
            "first_name": model.first_name,
            "last_name": model.last_name,
            "email": model.email,
            "phone": model.phone,
            "company": model.company,
            "title": model.title,
            "source": model.source,
            "status": model.status,
            "stage": self._stage_dict(model.stage) if model.stage_id else None,
            "pipeline": self._pipeline_dict(model.pipeline) if model.pipeline_id else None,
            "score": model.score,
            "notes": model.notes,
            "owner_id": model.owner_id,
            "assigned_to_id": model.assigned_to_id,
            "disqualification_reason": model.disqualification_reason,
            "converted_at": model.converted_at.isoformat() if model.converted_at else None,
            "converted_to_contact_id": model.converted_to_contact_id,
            "converted_to_opportunity_id": model.converted_to_opportunity_id,
            "organization_id": model.organization_id,
            "created_at": model.created_at.isoformat() if model.created_at else None,
            "updated_at": model.updated_at.isoformat() if model.updated_at else None,
        }

    def _publish_events(self, lead: Lead) -> None:
        for event in lead.collect_events():
            self.event_publisher.publish(event)

    # ------------------------------------------------------------------
    # Pipeline management
    # ------------------------------------------------------------------

    DEFAULT_STAGES = [
        ("NEW", 0, "#3b82f6", False),
        ("CONTACTED", 1, "#f59e0b", False),
        ("QUALIFIED", 2, "#10b981", False),
        ("CONVERTED", 3, "#6366f1", True),
        ("DISQUALIFIED", 4, "#f43f5e", True),
        ("RECYCLED", 5, "#8b5cf6", False),
    ]

    def list_pipelines(self, organization_id: UUID) -> list[PipelineModel]:
        return list(PipelineModel.objects.filter(organization_id=organization_id).order_by("name"))

    @transaction.atomic
    def create_pipeline(self, organization_id: UUID, name: str, description: str = "") -> PipelineModel:
        try:
            pipeline = PipelineModel.objects.create(
                organization_id=organization_id,
                name=name.strip(),
                description=description,
            )
        except IntegrityError:
            raise ValidationError(f"A pipeline named '{name.strip()}' already exists in this organization")
        self._bootstrap_pipeline_stages(pipeline)
        return pipeline

    def _bootstrap_pipeline_stages(self, pipeline: PipelineModel) -> list[LeadStageModel]:
        stages = []
        for name, order, color, is_terminal in self.DEFAULT_STAGES:
            stage, _ = LeadStageModel.objects.get_or_create(
                pipeline=pipeline,
                organization_id=pipeline.organization_id,
                name=name,
                defaults={"order": order, "color": color, "is_terminal": is_terminal},
            )
            stages.append(stage)
        return stages

    def get_or_create_default_pipeline(self, organization_id: UUID) -> PipelineModel:
        pipelines = self.list_pipelines(organization_id)
        if pipelines:
            return pipelines[0]
        return self.create_pipeline(organization_id, "Sales Pipeline", "Default sales pipeline")

    @transaction.atomic
    def update_pipeline(self, pipeline_id: UUID, organization_id: UUID, **kwargs) -> PipelineModel:
        try:
            pipeline = PipelineModel.objects.get(id=pipeline_id, organization_id=organization_id)
        except PipelineModel.DoesNotExist as exc:
            raise NotFoundError("Pipeline not found") from exc
        for key, value in kwargs.items():
            if value is not None and hasattr(pipeline, key):
                setattr(pipeline, key, value)
        pipeline.save()
        return pipeline

    @transaction.atomic
    def delete_pipeline(self, pipeline_id: UUID, organization_id: UUID) -> None:
        try:
            pipeline = PipelineModel.objects.get(id=pipeline_id, organization_id=organization_id)
        except PipelineModel.DoesNotExist as exc:
            raise NotFoundError("Pipeline not found") from exc
        LeadModel.objects.filter(pipeline=pipeline).update(pipeline=None, stage=None, status="NEW")
        pipeline.delete()

    # ------------------------------------------------------------------
    # Pipeline stage management (scoped to a pipeline)
    # ------------------------------------------------------------------

    def list_stages(self, organization_id: UUID, pipeline_id: UUID | None = None) -> list[LeadStageModel]:
        q = LeadStageModel.objects.filter(organization_id=organization_id)
        if pipeline_id:
            q = q.filter(pipeline_id=pipeline_id)
        stages = list(q.order_by("order"))
        if not stages and pipeline_id:
            try:
                pipeline = PipelineModel.objects.get(id=pipeline_id, organization_id=organization_id)
            except PipelineModel.DoesNotExist:
                return stages
            stages = self._bootstrap_pipeline_stages(pipeline)
        return stages

    def get_default_stage(self, organization_id: UUID, pipeline_id: UUID | None = None) -> LeadStageModel | None:
        stages = self.list_stages(organization_id, pipeline_id)
        return stages[0] if stages else None

    @transaction.atomic
    def create_stage(self, organization_id: UUID, name: str, pipeline_id: UUID | None = None, color: str = "#6366f1", is_terminal: bool = False) -> LeadStageModel:
        pipeline = None
        if pipeline_id:
            try:
                pipeline = PipelineModel.objects.get(id=pipeline_id, organization_id=organization_id)
            except PipelineModel.DoesNotExist:
                raise NotFoundError("Pipeline not found")
        filter_kw = {"organization_id": organization_id}
        if pipeline:
            filter_kw["pipeline_id"] = pipeline.id
        max_order = LeadStageModel.objects.filter(**filter_kw).aggregate(
            max_order=models.Max("order")
        )["max_order"] or -1
        try:
            stage = LeadStageModel.objects.create(
                organization_id=organization_id,
                pipeline=pipeline,
                name=name.strip(),
                order=max_order + 1,
                color=color,
                is_terminal=is_terminal,
            )
        except IntegrityError:
            raise ValidationError(f"A stage named '{name.strip()}' already exists in this{' pipeline' if pipeline else ' organization'}")
        return stage

    @transaction.atomic
    def update_stage(self, stage_id: UUID, organization_id: UUID, **kwargs) -> LeadStageModel:
        try:
            stage = LeadStageModel.objects.get(id=stage_id, organization_id=organization_id)
        except LeadStageModel.DoesNotExist as exc:
            raise NotFoundError("Stage not found") from exc
        for key, value in kwargs.items():
            if value is not None and hasattr(stage, key):
                setattr(stage, key, value)
        stage.save()
        return stage

    @transaction.atomic
    def delete_stage(self, stage_id: UUID, organization_id: UUID) -> None:
        try:
            stage = LeadStageModel.objects.get(id=stage_id, organization_id=organization_id)
        except LeadStageModel.DoesNotExist as exc:
            raise NotFoundError("Stage not found") from exc
        pipelines = self.list_pipelines(organization_id)
        default = self.get_default_stage(organization_id, stage.pipeline_id)
        if default and default.id == stage.id:
            raise ValidationError("Cannot delete the default stage of a pipeline")
        LeadModel.objects.filter(stage=stage).update(stage=default, status=default.name if default else "NEW")
        stage.delete()

    @transaction.atomic
    def reorder_stages(self, organization_id: UUID, stage_ids: list[UUID]) -> list[LeadStageModel]:
        stages = {s.id: s for s in LeadStageModel.objects.filter(organization_id=organization_id)}
        for i, sid in enumerate(stage_ids):
            if sid in stages:
                stages[sid].order = i
                stages[sid].save()
        pipeline_id = stages[stage_ids[0]].pipeline_id if stage_ids and stage_ids[0] in stages else None
        return self.list_stages(organization_id, pipeline_id)

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def list_leads(
        self,
        organization_id: UUID,
        status: str | None = None,
        source: str | None = None,
        assigned_to_id: UUID | None = None,
        pipeline_id: UUID | None = None,
        search: str | None = None,
        sort_by: str = "-created_at",
    ) -> list[LeadModel]:
        qs = LeadModel.objects.filter(organization_id=organization_id)
        if pipeline_id:
            qs = qs.filter(pipeline_id=pipeline_id)
        if status:
            qs = qs.filter(status=status.upper())
        if source:
            qs = qs.filter(source=source.upper())
        if assigned_to_id:
            qs = qs.filter(assigned_to_id=assigned_to_id)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(email__icontains=search)
                | Q(company__icontains=search)
            )
        sort_field = sort_by.lstrip("-")
        if sort_field in self.VALID_SORT_FIELDS:
            qs = qs.order_by(sort_by)
        return list(qs)

    @transaction.atomic
    def create_lead(
        self,
        organization_id: UUID,
        first_name: str,
        last_name: str,
        email: str,
        phone: str = "",
        company: str = "",
        title: str = "",
        source: str | None = None,
        notes: str = "",
        owner_id: UUID | None = None,
        assigned_to_id: UUID | None = None,
        pipeline_id: UUID | None = None,
    ) -> dict:
        existing = LeadModel.objects.filter(organization_id=organization_id, email__iexact=email).first()
        if existing:
            raise ValidationError(f"A lead with email {email} already exists in this organization")

        pipeline = None
        if pipeline_id:
            try:
                pipeline = PipelineModel.objects.get(id=pipeline_id, organization_id=organization_id)
            except PipelineModel.DoesNotExist:
                raise ValidationError("Pipeline not found")
        else:
            pipeline = self.get_or_create_default_pipeline(organization_id)

        default_stage = self.get_default_stage(organization_id, pipeline.id)
        lead = Lead(
            organization_id=organization_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            company=company,
            title=title,
            source=source,
            notes=notes,
            owner_id=owner_id,
            assigned_to_id=assigned_to_id,
        )
        model = LeadModel(
            id=lead.id,
            organization_id=organization_id,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=lead.email,
            phone=lead.phone,
            company=lead.company,
            title=lead.title,
            source=lead.source,
            pipeline=pipeline,
            stage=default_stage,
            status=default_stage.name if default_stage else lead.status,
            score=lead.score,
            notes=lead.notes,
            owner_id=lead.owner_id,
            assigned_to_id=lead.assigned_to_id,
        )
        model.save()
        lead.record_created()
        self._publish_events(lead)
        self.log_activity(model.id, organization_id, "LEAD_CREATED", f"Lead {first_name} {last_name} created", {"score": model.score})
        return self._model_to_dict(model)

    def get_lead(self, lead_id: UUID, organization_id: UUID) -> dict:
        model = self._get_model(lead_id, organization_id)
        return self._model_to_dict(model)

    @transaction.atomic
    def update_lead(
        self,
        lead_id: UUID,
        organization_id: UUID,
        **kwargs,
    ) -> dict:
        model = self._get_model(lead_id, organization_id)
        lead = Lead(
            organization_id=organization_id,
            first_name=model.first_name,
            last_name=model.last_name,
            email=model.email,
            phone=model.phone,
            company=model.company,
            title=model.title,
            source=model.source,
            notes=model.notes,
            owner_id=model.owner_id,
            assigned_to_id=model.assigned_to_id,
            id=model.id,
        )
        lead.update_info(**kwargs)
        changed = False
        if lead.first_name != model.first_name:
            model.first_name = lead.first_name; changed = True
        if lead.last_name != model.last_name:
            model.last_name = lead.last_name; changed = True
        if lead.email != model.email:
            existing = LeadModel.objects.filter(organization_id=organization_id, email__iexact=lead.email).exclude(id=lead_id).first()
            if existing:
                raise ValidationError(f"A lead with email {lead.email} already exists in this organization")
            model.email = lead.email; changed = True
        if lead.phone != model.phone:
            model.phone = lead.phone; changed = True
        if lead.company != model.company:
            model.company = lead.company; changed = True
        if lead.title != model.title:
            model.title = lead.title; changed = True
        if lead.source != model.source:
            model.source = lead.source; changed = True
        if lead.notes != model.notes:
            model.notes = lead.notes; changed = True
        if changed:
            model.save()
        self._publish_events(lead)
        return self._model_to_dict(model)

    @transaction.atomic
    def delete_lead(self, lead_id: UUID, organization_id: UUID) -> None:
        model = self._get_model(lead_id, organization_id)
        lead = Lead(
            organization_id=organization_id,
            first_name=model.first_name,
            last_name=model.last_name,
            email=model.email,
            id=model.id,
        )
        model.delete()
        lead.record_deleted()
        self._publish_events(lead)

    # ------------------------------------------------------------------
    # Stage change on a lead
    # ------------------------------------------------------------------

    @transaction.atomic
    def change_lead_stage(self, lead_id: UUID, organization_id: UUID, stage_id: UUID) -> dict:
        model = self._get_model(lead_id, organization_id)
        old_stage = model.stage.name if model.stage else "None"
        try:
            stage = LeadStageModel.objects.get(id=stage_id, organization_id=organization_id)
        except LeadStageModel.DoesNotExist:
            raise ValidationError("Stage not found")
        model.stage = stage
        model.status = stage.name
        model.save()
        self.log_activity(lead_id, organization_id, "STAGE_CHANGED", f"Stage changed from {old_stage} to {stage.name}", {"old_stage": old_stage, "new_stage": stage.name})
        return self._model_to_dict(model)

    # ------------------------------------------------------------------
    # Assignment
    # ------------------------------------------------------------------

    @transaction.atomic
    def assign_lead(self, lead_id: UUID, organization_id: UUID, user_id: UUID | None) -> dict:
        model = self._get_model(lead_id, organization_id)
        old_assignee = str(model.assigned_to_id) if model.assigned_to_id else "Unassigned"
        lead = Lead(
            organization_id=organization_id,
            first_name=model.first_name,
            last_name=model.last_name,
            email=model.email,
            id=model.id,
        )
        lead.assign_to(user_id)
        model.assigned_to_id = user_id
        model.save()
        self._publish_events(lead)
        new_assignee = str(user_id) if user_id else "Unassigned"
        self.log_activity(lead_id, organization_id, "LEAD_ASSIGNED", f"Lead reassigned from {old_assignee} to {new_assignee}", {"old_assignee": old_assignee, "new_assignee": new_assignee})
        return self._model_to_dict(model)

    # ------------------------------------------------------------------
    # Status management
    # ------------------------------------------------------------------

    @transaction.atomic
    def change_status(self, lead_id: UUID, organization_id: UUID, new_status: str, reason: str = "") -> dict:
        model = self._get_model(lead_id, organization_id)
        old_status = model.status
        lead = Lead(
            organization_id=organization_id,
            first_name=model.first_name,
            last_name=model.last_name,
            email=model.email,
            status=model.status,
            score=model.score,
            disqualification_reason=model.disqualification_reason,
            converted_at=model.converted_at,
            id=model.id,
        )
        lead.change_status(new_status, reason)
        model.status = lead.status
        model.disqualification_reason = lead.disqualification_reason
        if lead.converted_at:
            model.converted_at = lead.converted_at
        model.save()
        self._publish_events(lead)
        self.log_activity(lead_id, organization_id, "STATUS_CHANGED", f"Status changed from {old_status} to {new_status}", {"old_status": old_status, "new_status": new_status, "reason": reason})
        return self._model_to_dict(model)

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    @transaction.atomic
    def score_lead(self, lead_id: UUID, organization_id: UUID, score: int) -> dict:
        model = self._get_model(lead_id, organization_id)
        old_score = model.score
        try:
            lead = Lead(
                organization_id=organization_id,
                first_name=model.first_name,
                last_name=model.last_name,
                email=model.email,
                score=model.score,
                id=model.id,
            )
            lead.set_score(score)
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc
        model.score = lead.score
        model.save()
        self._publish_events(lead)
        self.log_activity(lead_id, organization_id, "SCORE_CHANGED", f"Score changed from {old_score} to {score}", {"old_score": old_score, "new_score": score})
        return self._model_to_dict(model)

    # ------------------------------------------------------------------
    # Conversion
    # ------------------------------------------------------------------

    @transaction.atomic
    def convert_lead(self, lead_id: UUID, organization_id: UUID, contact_id: UUID, opportunity_id: UUID | None = None) -> dict:
        model = self._get_model(lead_id, organization_id)
        if model.status != "QUALIFIED":
            raise ValidationError("Only qualified leads can be converted")
        lead = Lead(
            organization_id=organization_id,
            first_name=model.first_name,
            last_name=model.last_name,
            email=model.email,
            status=model.status,
            id=model.id,
        )
        lead.convert(contact_id, opportunity_id)
        model.status = lead.status
        model.converted_at = lead.converted_at
        model.converted_to_contact_id = contact_id
        model.converted_to_opportunity_id = opportunity_id
        model.save()
        self._publish_events(lead)
        self.log_activity(lead_id, organization_id, "STATUS_CHANGED", "Lead converted", {"new_status": "CONVERTED", "contact_id": str(contact_id)})
        return self._model_to_dict(model)

    # ------------------------------------------------------------------
    # Duplicate detection
    # ------------------------------------------------------------------

    def find_duplicates(self, organization_id: UUID, email: str | None = None) -> list[dict]:
        q = Q(organization_id=organization_id)
        if email:
            q &= Q(email__iexact=email)
        else:
            return []
        return [self._model_to_dict(m) for m in LeadModel.objects.filter(q)]

    # ------------------------------------------------------------------
    # Communications
    # ------------------------------------------------------------------

    def _comm_dict(self, comm: CommunicationLogModel) -> dict:
        return {
            "id": comm.id,
            "lead_id": comm.lead_id,
            "type": comm.type,
            "direction": comm.direction,
            "subject": comm.subject,
            "body": comm.body,
            "from_address": comm.from_address,
            "to_address": comm.to_address,
            "status": comm.status,
            "metadata": comm.metadata,
            "created_at": comm.created_at.isoformat() if comm.created_at else None,
        }

    def list_communications(self, lead_id: UUID, organization_id: UUID) -> list[dict]:
        lead = self._get_model(lead_id, organization_id)
        return [self._comm_dict(c) for c in CommunicationLogModel.objects.filter(lead=lead).order_by("-created_at")]

    @transaction.atomic
    def log_communication(
        self, lead_id: UUID, organization_id: UUID, comm_type: str, direction: str = "OUTBOUND",
        subject: str = "", body: str = "", to_address: str = "", from_address: str = "",
        metadata: dict | None = None,
    ) -> dict:
        lead = self._get_model(lead_id, organization_id)
        comm = CommunicationLogModel.objects.create(
            lead=lead,
            type=comm_type,
            direction=direction,
            subject=subject,
            body=body,
            to_address=to_address or lead.email,
            from_address=from_address,
            metadata=metadata or {},
            status="SENT" if direction == "OUTBOUND" else "RECEIVED",
        )
        return self._comm_dict(comm)

    @transaction.atomic
    def send_email(self, lead_id: UUID, organization_id: UUID, subject: str, body: str, to_address: str | None = None) -> dict:
        lead = self._get_model(lead_id, organization_id)
        result = self.log_communication(
            lead_id, organization_id, "EMAIL", "OUTBOUND",
            subject=subject, body=body,
            to_address=to_address or lead.email,
            from_address="noreply@tzahu.com",
            metadata={"sent_via": "smtp"},
        )
        self.log_activity(lead_id, organization_id, "COMMUNICATION", f"Email sent: {subject}", {"to": to_address or lead.email})
        return result

    @transaction.atomic
    def send_whatsapp(self, lead_id: UUID, organization_id: UUID, message: str, to_phone: str | None = None) -> dict:
        lead = self._get_model(lead_id, organization_id)
        phone = to_phone or lead.phone
        result = self.log_communication(
            lead_id, organization_id, "WHATSAPP", "OUTBOUND",
            body=message,
            to_address=phone,
            metadata={"sent_via": "whatsapp_api"},
        )
        self.log_activity(lead_id, organization_id, "COMMUNICATION", f"WhatsApp sent to {phone}", {"to": phone})
        return result

    @transaction.atomic
    def log_call(self, lead_id: UUID, organization_id: UUID, direction: str = "OUTBOUND", duration: int = 0, notes: str = "") -> dict:
        lead = self._get_model(lead_id, organization_id)
        result = self.log_communication(
            lead_id, organization_id, "CALL", direction,
            body=notes,
            to_address=lead.phone,
            metadata={"duration_seconds": duration},
        )
        self.log_activity(lead_id, organization_id, "COMMUNICATION", f"Call logged ({direction})", {"duration_seconds": duration})
        return result

    # ------------------------------------------------------------------
    # Activity Log / Timeline
    # ------------------------------------------------------------------

    def log_activity(self, lead_id: UUID, organization_id: UUID, activity_type: str, description: str = "", metadata: dict | None = None) -> dict:
        lead = self._get_model(lead_id, organization_id)
        activity = ActivityLogModel.objects.create(
            lead=lead,
            activity_type=activity_type,
            description=description,
            metadata=metadata or {},
        )
        return self._activity_dict(activity)

    def _activity_dict(self, activity: ActivityLogModel) -> dict:
        return {
            "id": activity.id,
            "activity_type": activity.activity_type,
            "description": activity.description,
            "metadata": activity.metadata,
            "created_at": activity.created_at.isoformat(),
        }

    def get_lead_timeline(self, lead_id: UUID, organization_id: UUID) -> list[dict]:
        lead = self._get_model(lead_id, organization_id)
        activities = ActivityLogModel.objects.filter(lead=lead)
        comms = CommunicationLogModel.objects.filter(lead=lead)

        events = [self._activity_dict(a) for a in activities]
        for c in comms:
            events.append({
                "id": c.id,
                "activity_type": "COMMUNICATION",
                "description": f"{c.type} ({c.direction}): {c.subject or c.body[:50] if c.body else ''}",
                "metadata": c.metadata,
                "created_at": c.created_at.isoformat(),
            })

        events.sort(key=lambda e: e["created_at"], reverse=True)
        return events
