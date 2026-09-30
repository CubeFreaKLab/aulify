// Al fallar un trabajador se drenan los ya iniciados antes de cerrar el informe.
export async function parallel(items, limit, callback) {
  let index = 0, firstError;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while (!firstError && index < items.length) {
      const current = index++;
      try { await callback(items[current], current); }
      catch (error) { firstError ||= error; }
    }
  }));
  if (firstError) throw firstError;
}
