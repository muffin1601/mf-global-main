export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "HttpError";
  }
}
export const forbidden = (message = "You do not have permission to do that.") => new HttpError(403, message, "FORBIDDEN");
export const notFound = (message = "Not found.") => new HttpError(404, message, "NOT_FOUND");
export const badRequest = (message: string) => new HttpError(400, message, "BAD_REQUEST");
export const conflict = (message: string) => new HttpError(409, message, "CONFLICT");
export const tooMany = (message = "Too many requests. Please try again later.") => new HttpError(429, message, "RATE_LIMITED");
