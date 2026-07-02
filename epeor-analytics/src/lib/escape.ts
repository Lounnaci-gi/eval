/**
 * Échappement HTML défensif pour interpolation dans un template literal
 * destiné à être injecté via `document.write` (ex: fenêtre d'impression).
 *
 * Échappe les caractères pouvant casser le contexte HTML ou injecter du JS :
 *  - & → &amp;
 *  - < → &lt;
 *  - > → &gt;
 *  - " → &quot;
 *  - ' → &#x27;
 *  - / → &#x2F;
 *
 * Ne JAMAIS bypasser cette fonction pour des valeurs issues de l'utilisateur
 * (data API, params, champs d'admin). Pour les littéraux statiques du code,
 * l'échappement est inoffensif.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
