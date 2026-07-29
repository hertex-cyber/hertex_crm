import api from "@services/api";

export interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
  is_terminal: boolean;
  pipeline_id: string | null;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  source: string;
  status: string;
  stage: Stage | null;
  pipeline: Pipeline | null;
  score: number;
  notes: string;
  owner_id: string | null;
  assigned_to_id: string | null;
  disqualification_reason: string;
  converted_at: string | null;
  converted_to_contact_id: string | null;
  converted_to_opportunity_id: string | null;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface LeadCreate {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  source?: string;
  notes?: string;
  owner_id?: string | null;
  assigned_to_id?: string | null;
  pipeline_id?: string;
}

export interface LeadUpdate {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  source?: string;
  notes?: string;
  assigned_to_id?: string | null;
}

export const listLeads = async (params?: {
  status?: string;
  source?: string;
  assigned_to_id?: string;
  search?: string;
  sort_by?: string;
  page?: number;
  pageSize?: number;
}): Promise<Lead[]> => {
  const { data } = await api.get("/leads/", { params });
  return data.results ?? data;
};

export const getLead = async (id: string): Promise<Lead> => {
  const { data } = await api.get(`/leads/${id}`);
  return data;
};

export const createLead = async (payload: LeadCreate): Promise<Lead> => {
  const { data } = await api.post("/leads/", payload);
  return data;
};

export const updateLead = async (id: string, payload: LeadUpdate): Promise<Lead> => {
  const { data } = await api.patch(`/leads/${id}`, payload);
  return data;
};

export const deleteLead = async (id: string): Promise<void> => {
  await api.delete(`/leads/${id}`);
};

export const assignLead = async (id: string, assigned_to_id: string | null): Promise<Lead> => {
  const { data } = await api.post(`/leads/${id}/assign`, { assigned_to_id });
  return data;
};

export const changeLeadStatus = async (id: string, status: string, reason?: string): Promise<Lead> => {
  const { data } = await api.post(`/leads/${id}/status`, { status, reason });
  return data;
};

export const scoreLead = async (id: string, score: number): Promise<Lead> => {
  const { data } = await api.post(`/leads/${id}/score`, { score });
  return data;
};

export const convertLead = async (id: string, contact_id: string, opportunity_id?: string): Promise<Lead> => {
  const { data } = await api.post(`/leads/${id}/convert`, { contact_id, opportunity_id });
  return data;
};

export const findLeadDuplicates = async (email: string): Promise<Lead[]> => {
  const { data } = await api.get("/leads/duplicates", { params: { email } });
  return data;
};

export const changeLeadStage = async (id: string, stage_id: string): Promise<Lead> => {
  const { data } = await api.post(`/leads/${id}/stage`, { stage_id });
  return data;
};

export const listPipelines = async (): Promise<Pipeline[]> => {
  const { data } = await api.get("/leads/pipelines");
  return data;
};

export const createPipeline = async (payload: { name: string; description?: string }): Promise<Pipeline> => {
  const { data } = await api.post("/leads/pipelines", payload);
  return data;
};

export const updatePipeline = async (id: string, payload: { name?: string; description?: string }): Promise<Pipeline> => {
  const { data } = await api.patch(`/leads/pipelines/${id}`, payload);
  return data;
};

export const deletePipeline = async (id: string): Promise<void> => {
  await api.delete(`/leads/pipelines/${id}`);
};

export const listStages = async (pipeline_id?: string): Promise<Stage[]> => {
  const params = pipeline_id ? { pipeline_id } : {};
  const { data } = await api.get("/leads/stages", { params });
  return data;
};

export const createStage = async (payload: { name: string; color?: string; is_terminal?: boolean; pipeline_id?: string }): Promise<Stage> => {
  const { data } = await api.post("/leads/stages", payload);
  return data;
};

export const updateStage = async (id: string, payload: { name?: string; color?: string; is_terminal?: boolean }): Promise<Stage> => {
  const { data } = await api.patch(`/leads/stages/${id}`, payload);
  return data;
};

export const deleteStage = async (id: string): Promise<void> => {
  await api.delete(`/leads/stages/${id}`);
};

export const reorderStages = async (stage_ids: string[]): Promise<Stage[]> => {
  const { data } = await api.post("/leads/stages/reorder", { stage_ids });
  return data;
};

export interface Communication {
  id: string;
  lead_id: string;
  type: "EMAIL" | "WHATSAPP" | "CALL" | "SMS";
  direction: "OUTBOUND" | "INBOUND";
  subject: string;
  body: string;
  from_address: string;
  to_address: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const listCommunications = async (leadId: string): Promise<Communication[]> => {
  const { data } = await api.get(`/leads/${leadId}/communications`);
  return data;
};

export const sendEmail = async (leadId: string, payload: { subject: string; body: string; to_address?: string }): Promise<Communication> => {
  const { data } = await api.post(`/leads/${leadId}/send-email`, payload);
  return data;
};

export const sendWhatsApp = async (leadId: string, payload: { message: string; to_phone?: string }): Promise<Communication> => {
  const { data } = await api.post(`/leads/${leadId}/send-whatsapp`, payload);
  return data;
};

export const logCall = async (leadId: string, payload: { direction?: string; duration?: number; notes?: string }): Promise<Communication> => {
  const { data } = await api.post(`/leads/${leadId}/log-call`, payload);
  return data;
};

export const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "DISQUALIFIED", "RECYCLED"] as const;
export const SOURCE_OPTIONS = ["WEB_FORM", "REFERRAL", "COLD_CALL", "EMAIL", "SOCIAL_MEDIA", "PARTNER", "OTHER"] as const;

export const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  DISQUALIFIED: "Disqualified",
  RECYCLED: "Recycled",
};

export const SOURCE_LABELS: Record<string, string> = {
  WEB_FORM: "Web Form",
  REFERRAL: "Referral",
  COLD_CALL: "Cold Call",
  EMAIL: "Email",
  SOCIAL_MEDIA: "Social Media",
  PARTNER: "Partner",
  OTHER: "Other",
};

export const STATUS_COLORS: Record<string, string> = {
  NEW: "#1976d2",
  CONTACTED: "#f57c00",
  QUALIFIED: "#388e3c",
  CONVERTED: "#1565c0",
  DISQUALIFIED: "#d32f2f",
  RECYCLED: "#6a1b9a",
};
