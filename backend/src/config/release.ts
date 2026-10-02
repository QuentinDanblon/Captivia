/** Identifiant de version déployée (SHA Git) : Render l'injecte via RENDER_GIT_COMMIT, sinon GIT_SHA. */
export function getRelease(): string | undefined {
  return process.env.RENDER_GIT_COMMIT || process.env.GIT_SHA || undefined;
}
