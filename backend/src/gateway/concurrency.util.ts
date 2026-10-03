/**
 * Exécute `fn` sur chaque élément avec au plus `concurrency` appels simultanés
 * (petit pool maison, sans dépendance). L'ordre des résultats suit celui de `items`.
 * Si `fn` rejette, la promesse retournée rejette : l'appelant doit gérer ses erreurs
 * dans `fn` s'il veut un comportement « best effort ».
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.max(
    1,
    Math.min(Math.floor(concurrency) || 1, items.length),
  );
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
