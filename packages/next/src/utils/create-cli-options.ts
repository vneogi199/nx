export function createCliOptions(
  obj: Record<string, string | number | boolean>
): string[] {
  return Object.entries(obj).reduce((arr, [key, value]) => {
    if (value !== undefined) {
      const kebabCase = key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
      if (value === true || typeof value !== 'boolean') {
        // Boolean flags don't need a value (e.g. --debug)
        arr.push(
          `--${kebabCase}` + (typeof value !== 'boolean' ? `=${value}` : '')
        );
      }
    }
    return arr;
  }, []);
}
