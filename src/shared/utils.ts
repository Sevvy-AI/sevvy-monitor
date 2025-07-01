export const fetchWithTimeout = async (
  url: string,
  options: any,
  timeout: number
) => {
  return Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    ),
  ]);
};
