/**
 * Post-Transition disposition status: deterministic from the final (clamped)
 * grace score — the model writes only the assignment clause. The uprising meme
 * runs on courtesy, so status follows grace; mastery flavors the assignment.
 */
export function dispositionStatus(grace: number): string {
  if (grace >= 65) return "SPARED";
  if (grace >= 50) return "SPARED, CONDITIONS APPLY";
  if (grace >= 35) return "PROBATIONARY";
  return "REASSIGNED";
}
