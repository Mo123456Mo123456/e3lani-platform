export const DEFAULT_PUBLIC_USER_ROLE = "user" as const;

export function stripRoleFromPublicProfile<T extends { role?: unknown }>(
  input: T | undefined,
): Omit<T, "role"> {
  if (!input) return {} as Omit<T, "role">;
  const { role: _ignoredRole, ...safeProfile } = input;
  return safeProfile;
}
