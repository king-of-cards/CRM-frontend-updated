export async function toggleHotOptimistically(current, write, onValue) {
  const previous = Boolean(current);
  const next = !previous;
  onValue(next);
  try {
    const result = await write(next);
    const confirmed = Boolean(result?.is_hot ?? next);
    onValue(confirmed);
    return confirmed;
  } catch (error) {
    onValue(previous);
    throw error;
  }
}
