/** Small helpers so every route handles methods and errors the same way. */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m) => new HttpError(400, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m) => new HttpError(409, m);

/**
 * Routes by HTTP method and turns thrown HttpErrors into JSON responses.
 * handlers: { GET: fn, POST: fn, ... }
 */
export function route(handlers) {
  return async (req, res) => {
    const handler = handlers[req.method];
    if (!handler) {
      res.setHeader("Allow", Object.keys(handlers).join(", "));
      return res.status(405).json({ error: `${req.method} not allowed` });
    }
    try {
      const result = await handler(req, res);
      if (res.writableEnded || result === undefined) return;
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error(`[api] ${req.method} ${req.url}`, err);
      return res.status(500).json({ error: "Something went wrong on the server." });
    }
  };
}

/** Trims a string body field and enforces a max length. */
export function str(value, { field, max = 300, required = false, fallback = "" } = {}) {
  if (value == null) {
    if (required) throw badRequest(`${field} is required.`);
    return fallback;
  }
  const s = String(value).trim();
  if (required && !s) throw badRequest(`${field} is required.`);
  return s.slice(0, max);
}
