export function resolveClickUpAuthorizationHeader(accessToken: string): string {
  if (accessToken.startsWith("Bearer ")) {
    return accessToken;
  }

  if (accessToken.startsWith("pk_")) {
    return accessToken;
  }

  return `Bearer ${accessToken}`;
}
