/**
 * Whether a session token predates the current password.
 *
 * Sessions are JWTs, which cannot be revoked in a database - a token stolen
 * today stays valid for its full 30 days no matter what the account does
 * afterwards. Comparing the token's issue time against the moment the password
 * last changed gives the revocation back: changing a password signs out every
 * other device on its next request.
 *
 * Both sides are compared at whole-second granularity because `iat` is stored
 * in seconds. Without the floor, a token issued in the same second as the
 * change looks older than it, and the person who just changed their password
 * would be signed out along with the attacker.
 */
export function issuedBeforePasswordChange(
  tokenIssuedAtSeconds: number,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return false;
  return Math.floor(passwordChangedAt.getTime() / 1000) > tokenIssuedAtSeconds;
}
