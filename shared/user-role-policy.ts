export const DEFAULT_PUBLIC_USER_ROLE = "user" as const;

export function stripRoleFromPublicProfile<T extends object>(
  input: T | undefined,
): Omit<T, "role"> {
  if (!input) return {} as Omit<T, "role">;
  const { role: _ignoredRole, ...safeProfile } = input as T & { role?: unknown };
  return safeProfile as Omit<T, "role">;
}
