export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 8192;

export const readBody = (req) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let settled = false;

    const succeed = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) {
        return;
      }

      length += chunk.length;

      if (length > MAX_BODY_BYTES) {
        fail(new HttpError(400, '요청 본문이 너무 큽니다.'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      succeed(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', fail);
  });
};

export const parseJson = (text) => {
  if (!text || text.trim() === '') {
    return {};
  }

  let value;

  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, '잘못된 JSON입니다.');
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, '잘못된 JSON입니다.');
  }

  return value;
};

export const sendJson = (res, status, body, corsOrigin) => {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(payload);
};

export const sendEmpty = (res, status, corsOrigin) => {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
};
