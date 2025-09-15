export async function wrap(promiseFn, { onStart, onSuccess, onError } = {}) {
  try {
    if (onStart) onStart();
    const result = await promiseFn();
    if (onSuccess) onSuccess(result);
    return result;
  } catch (err) {
    if (onError) onError(err);
    throw err;
  }
}
