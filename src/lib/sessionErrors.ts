type AuthFailure = { code?: unknown; status?: unknown; name?: unknown; message?: unknown };

const terminalCodes = new Set([
  'bad_jwt',
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_not_found',
  'user_not_found',
]);

export function isTerminalSessionError(reason: unknown) {
  if (!reason || typeof reason !== 'object') return false;
  const error = reason as AuthFailure;
  if (typeof error.code === 'string' && terminalCodes.has(error.code)) return true;
  if (error.name === 'AuthSessionMissingError' || error.status === 401) return true;
  return typeof error.message === 'string' && /invalid refresh token|refresh token.+not found|auth session missing/i.test(error.message);
}
