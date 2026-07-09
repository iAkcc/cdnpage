const BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Error', res.status, data);
  return data;
}

function get(path) { return request('GET', path); }
function post(path, body) { return request('POST', path, body); }
function put(path, body) { return request('PUT', path, body); }
function patch(path, body) { return request('PATCH', path, body); }
function del(path, body) { return request('DELETE', path, body); }

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export default { get, post, put, patch, del };

export const api = { get, post, put, patch, del };
