import api from "@services/api";

export interface Permission { code: string; label: string; module: string; description: string; }
export interface Role { id: string; name: string; description: string; is_system: boolean; permissions: string[]; member_count: number; }

export const listPermissions = async (): Promise<Permission[]> => (await api.get("/roles/permissions")).data;
export const listRoles = async (): Promise<Role[]> => {
  const { data } = await api.get("/roles/");
  return data.results ?? data;
};
export const createRole = async (data: Pick<Role, "name" | "description" | "permissions">): Promise<Role> => (await api.post("/roles/", data)).data;
export const updateRole = async (id: string, data: Partial<Pick<Role, "name" | "description" | "permissions">>): Promise<Role> => (await api.patch(`/roles/${id}`, data)).data;
export const deleteRole = async (id: string): Promise<void> => { await api.delete(`/roles/${id}`); };
export const getMyPermissions = async (): Promise<{ permissions: string[]; is_admin: boolean }> => (await api.get("/roles/me")).data;
