import api from "@services/api";
import type { Organization } from "@store/authStore";

export interface Member {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  rbac_roles: string[];
  status: string;
  created_at: string;
}

export interface OrgResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  created_at: string;
}

export interface TenantResponse {
  id: string;
  organization_id: string;
  plan: string;
  status: string;
  settings: Record<string, any>;
  created_at: string;
}

export async function createOrg(data: { name: string; slug: string }): Promise<OrgResponse> {
  const res = await api.post("/orgs/", data);
  return res.data;
}

export async function getOrg(orgId: string): Promise<OrgResponse> {
  const res = await api.get(`/orgs/${orgId}/`);
  return res.data;
}

export async function updateOrg(orgId: string, data: { name?: string; description?: string }): Promise<OrgResponse> {
  const res = await api.patch(`/orgs/${orgId}/`, data);
  return res.data;
}

export async function listMyOrgs(): Promise<OrgResponse[]> {
  const res = await api.get("/orgs/");
  return res.data;
}

export async function getCurrentOrg(): Promise<OrgResponse> {
  const res = await api.get("/orgs/current");
  return res.data;
}

export async function inviteMember(orgId: string, data: { email: string; role: string }): Promise<Member> {
  const res = await api.post(`/orgs/${orgId}/invite`, data);
  return res.data;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  const res = await api.get(`/orgs/${orgId}/members`);
  return res.data;
}

export async function changeMemberRole(orgId: string, membershipId: string, role: string): Promise<Member> {
  const res = await api.post(`/orgs/${orgId}/members/${membershipId}`, { role });
  return res.data;
}

export async function removeMember(orgId: string, membershipId: string): Promise<void> {
  await api.delete(`/orgs/${orgId}/members/${membershipId}`);
}

export async function acceptInvite(membershipId: string): Promise<void> {
  await api.post("/orgs/accept-invite", { membership_id: membershipId });
}

export async function getCurrentTenant(): Promise<TenantResponse> {
  const res = await api.get("/tenants/current");
  return res.data;
}

export async function changePlan(plan: string): Promise<TenantResponse> {
  const res = await api.post("/tenants/plan", { plan });
  return res.data;
}
