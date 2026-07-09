// Helpers de respuesta HTTP consistentes
export function json(body, opts = {}) {
  return {
    statusCode: opts.status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...(opts.headers || {}),
    },
    body: JSON.stringify(body),
  };
}

export function error(message, status = 400, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

export function ok(data) {
  return json({ ok: true, ...data });
}
