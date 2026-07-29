# Module Blueprint: Custom Fields & Module Builder

- **Module:** `apps.custom_fields`, `apps.custom_modules`
- **Bounded Context:** Dynamic Schema & Entity Customization
- **Status:** Draft v1.0

## Business Purpose

The Custom Fields module allows tenants to extend any CRM entity (Lead, Contact, Account, Opportunity, etc.) with custom fields. The Custom Module Builder enables tenants to create entirely new entity types with their own schemas, relationships, and APIs. Together they provide low-code extensibility without engineering effort.

## Bounded Context

This module owns Custom Field Definitions, Field Groups, Entity Extensions, and Custom Module Definitions. It does NOT own the core entity data but provides the schema that other modules read to extend their models.

## Aggregates, Entities, Value Objects

### Aggregate: CustomFieldDefinition
- **CustomFieldDefinition** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `entity_type: str` (e.g., "lead", "contact", "opportunity", "account")
  - `field_name: str` (machine name, e.g., "custom_referral_source")
  - `field_label: str` (display name)
  - `field_type: FieldType`
  - `is_required: bool`
  - `is_unique: bool`
  - `is_searchable: bool`
  - `default_value: JSONB | None`
  - `placeholder: str | None`
  - `help_text: str | None`
  - `validation_rules: ValidationRule | None`
  - `options: List[FieldOption] | None` (for SELECT, MULTI_SELECT)
  - `field_group_id: UUID v7 | None`
  - `sort_order: int`
  - `show_in_list: bool`
  - `show_in_detail: bool`
  - `timestamps: created_at, updated_at`

### Value Objects
- **FieldType:** `enum(TEXT, TEXTAREA, NUMBER, DECIMAL, DATE, DATETIME, BOOLEAN, SELECT, MULTI_SELECT, EMAIL, PHONE, URL, CURRENCY, PERCENT, COLOR, JSON)`
- **FieldOption:** `{label: str, value: str, color: str | None, sort_order: int}`
- **ValidationRule:** `{min_length: int, max_length: int, min_value: Decimal, max_value: Decimal, regex_pattern: str, custom_validator: str}`

### Entities
- **FieldGroup** — Logical grouping of fields
  - `id, tenant_id, entity_type, name, label, sort_order, collapsible, collapsed_by_default`
- **EntityCustomData** — Stores the actual custom field values per entity instance
  - `id, tenant_id, entity_type, entity_id, data: JSONB, created_at, updated_at`

### Aggregate: CustomModule
- **CustomModule** (Aggregate Root)
  - `id: UUID v7`
  - `tenant_id: UUID v7`
  - `name: str` (machine name, e.g., "asset", "project")
  - `label_singular: str`
  - `label_plural: str`
  - `description: Text`
  - `icon: str | None`
  - `is_active: bool`
  - `enable_activities: bool`
  - `enable_notes: bool`
  - `enable_attachments: bool`
  - `enable_tasks: bool`
  - `enable_workflow: bool`
  - `enable_audit: bool`
  - `enable_comments: bool`
  - `enable_tags: bool`
  - `enable_ownership: bool`
  - `enable_team_assignment: bool`
  - `enable_pipeline: bool` (can this module have a pipeline?)
  - `timestamps: created_at, updated_at`

### Entities
- **CustomModuleField** — Fields on a custom module (same structure as CustomFieldDefinition)
- **CustomModuleRecord** — Actual data row for a custom module instance
  - `id, tenant_id, module_name, data: JSONB, owner_id, created_by, timestamps`
- **CustomModuleRelationship** — Relationships to other entities
  - `id, source_module, target_entity (core or custom), relationship_type: ONE_TO_ONE|ONE_TO_MANY|MANY_TO_MANY`

## Domain Events

- `CustomFieldCreated`, `CustomFieldUpdated`, `CustomFieldDeleted`
- `FieldGroupCreated`, `FieldGroupUpdated`
- `CustomModuleCreated`, `CustomModuleActivated`, `CustomModuleDeactivated`
- `CustomModuleRecordCreated`, `CustomModuleRecordUpdated`

## Commands & Queries

### Commands
- `CreateCustomField(entity_type, definition) -> FieldId`
- `UpdateCustomField(field_id, definition)`
- `DeleteCustomField(field_id)`
- `ReorderFields(entity_type, field_order)`
- `CreateFieldGroup`, `UpdateFieldGroup`, `DeleteFieldGroup`
- `SetCustomFieldValue(entity_type, entity_id, field_name, value)`
- `SetBulkCustomFieldValues(entity_type, entity_ids, field_values)`
- `CreateCustomModule(definition) -> ModuleId`
- `ActivateCustomModule(module_id)`, `DeactivateCustomModule(module_id)`
- `CreateCustomModuleRecord(module_name, data) -> RecordId`
- `UpdateCustomModuleRecord(record_id, data)`
- `DeleteCustomModuleRecord(record_id)`

### Queries
- `GetCustomFields(entity_type) -> List[FieldDefinition]`
- `GetCustomField(entity_type, field_name)`
- `GetCustomFieldValue(entity_type, entity_id) -> Dict[name, value]`
- `GetFieldGroups(entity_type)`
- `GetCustomModule(module_name) -> ModuleDefinition`
- `ListCustomModules(is_active?) -> List[ModuleDefinition]`
- `GetCustomModuleRecords(module_name, filters, page) -> PaginatedResult`
- `GetCustomModuleRecord(module_name, record_id)`
- `SearchCustomModule(module_name, query, filters)`

## Application Services

- `CustomFieldService` — Field definition management and validation
- `EntityExtensionService` — Attach and query custom data on core entities
- `CustomModuleService` — Module definition lifecycle
- `CustomModuleDataService` — Record CRUD with dynamic schema
- `SchemaMigrationService` — Handle field type changes and data migration
- `DynamicFormBuilder` — Generate form configurations for frontend

## API Endpoints

### Custom Fields
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/v1/custom-fields/{entity_type}/` | List fields for entity |
| POST | `/api/v1/custom-fields/{entity_type}/` | Add custom field |
| PUT | `/api/v1/custom-fields/{entity_type}/{id}/` | Update field |
| DELETE | `/api/v1/custom-fields/{entity_type}/{id}/` | Delete field |
| PUT | `/api/v1/custom-fields/{entity_type}/reorder/` | Reorder fields |
| GET | `/api/v1/custom-fields/{entity_type}/groups/` | Field groups |
| POST | `/api/v1/custom-fields/{entity_type}/groups/` | Create group |
| GET/PUT | `/api/v1/custom-fields/data/{entity_type}/{entity_id}/` | Get/set field values |

### Custom Modules
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/v1/custom-modules/` | List modules |
| POST | `/api/v1/custom-modules/` | Create module |
| GET/PUT/DELETE | `/api/v1/custom-modules/{name}/` | Module CRUD |
| POST | `/api/v1/custom-modules/{name}/activate/` | Activate |
| POST | `/api/v1/custom-modules/{name}/deactivate/` | Deactivate |
| GET/POST | `/api/v1/custom-modules/{name}/records/` | List/Create records |
| GET/PUT/DELETE | `/api/v1/custom-modules/{name}/records/{id}/` | Record CRUD |
| GET | `/api/v1/custom-modules/{name}/records/search/` | Search records |

## Database Tables

- `custom_fields_definition` — Custom field definitions
- `custom_fields_fieldgroup` — Field grouping
- `custom_fields_data` — Custom field values (JSONB per entity)
- `custom_fields_fieldoption` — Select/multi-select options
- `custom_modules_definition` — Custom module schema
- `custom_modules_field` — Fields on custom modules
- `custom_modules_record` — Custom module data rows
- `custom_modules_relationship` — Entity relationships

## Validation Rules

| Field | Rule |
|-------|------|
| field_name | Unique per entity_type, alphanumeric + underscore |
| field_type | Cannot be changed after data exists (migration required) |
| options | Required for SELECT/MULTI_SELECT types |
| module_name | Unique per tenant, alphanumeric only |
| is_unique | Enforced at DB level for TEXT fields |

## Security & Permissions

| Permission | Codename |
|------------|----------|
| Manage Custom Fields | `custom_fields.manage_fields` |
| View Custom Fields | `custom_fields.view_fields` |
| Manage Modules | `custom_modules.manage_modules` |
| View Module Records | `custom_modules.view_records` |
| Add Module Records | `custom_modules.add_records` |
| Change Module Records | `custom_modules.change_records` |
| Delete Module Records | `custom_modules.delete_records` |

## Testing Strategy

| Layer | Focus |
|-------|-------|
| Unit | Field validation rules, Data type coercion, Field option ordering |
| Integration | Custom data CRUD on core entities, Custom module record CRUD with JSONB, Field type migration |
| API | Custom field definition lifecycle, Custom module dynamic endpoints, Search across custom data |

## Future Enhancements

- **Formula Fields:** Computed fields using expression language
- **Lookup Fields:** Reference fields to other entities
- **Audit Logging:** Track changes to custom field values
- **Import/Export:** Include custom fields in bulk import/export
- **Conditional Logic:** Show/hide fields based on other field values
- **Global Fields:** Company-wide field templates
- **API Auto-Generation:** Dynamic REST endpoints for custom modules
- **Field-Level Permissions:** Restrict visibility per role
- **Custom Validation Scripts:** Tenant-provided Python validation
