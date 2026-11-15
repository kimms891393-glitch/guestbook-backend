import { HttpError } from './http.js';

const isString = (value) => typeof value === 'string';

export const normalizeName = (value) => {
  if (!isString(value)) {
    throw new HttpError(400, 'name은 1~20자여야 합니다.');
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 20) {
    throw new HttpError(400, 'name은 1~20자여야 합니다.');
  }

  return name;
};

export const normalizeMessage = (value) => {
  if (!isString(value)) {
    throw new HttpError(400, 'message는 1~500자여야 합니다.');
  }

  const message = value.trim();

  if (message.length < 1 || message.length > 500) {
    throw new HttpError(400, 'message는 1~500자여야 합니다.');
  }

  return message;
};

export const normalizePassword = (value) => {
  if (!isString(value) || value.length < 4 || value.length > 20) {
    throw new HttpError(400, 'password는 4~20자여야 합니다.');
  }

  return value;
};

export const parseId = (value) => {
  if (!/^\d+$/.test(value)) {
    throw new HttpError(404, '글을 찾을 수 없습니다.');
  }

  return Number(value);
};

export const parsePage = (value) => {
  if (value === undefined) {
    return 1;
  }

  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new HttpError(400, 'page는 1 이상이어야 합니다.');
  }

  return Number(value);
};

export const parseLimit = (value) => {
  if (value === undefined) {
    return 20;
  }

  if (!/^\d+$/.test(value)) {
    throw new HttpError(400, 'limit는 1~100이어야 합니다.');
  }

  const limit = Number(value);

  if (limit < 1 || limit > 100) {
    throw new HttpError(400, 'limit는 1~100이어야 합니다.');
  }

  return limit;
};
