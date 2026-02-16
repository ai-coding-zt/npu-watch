import type { Response } from 'express';
import type { ApiResponse } from '../types.js';
import { formatError, ERR_UNKNOWN } from '../constants/index.js';

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const response: ApiResponse<T> = { success: true, data };
  res.status(status).json(response);
}

export function sendSuccessMessage(res: Response, message: string, status = 200): void {
  res.status(status).json({ success: true, message });
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendError(res: Response, error: string, status = 500): void {
  res.status(status).json({ success: false, error });
}

export function sendBadRequest(res: Response, error: unknown, fallback = ERR_UNKNOWN): void {
  sendError(res, formatError(error, fallback), 400);
}

export function sendNotFound(res: Response, error: string): void {
  sendError(res, error, 404);
}

export function sendInternalError(res: Response, error: unknown, fallback = ERR_UNKNOWN): void {
  sendError(res, formatError(error, fallback), 500);
}

export function sendNoCache(res: Response, error: string, status = 400): void {
  res.status(status).json({ success: false, error });
}
