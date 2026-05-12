import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiError extends HttpException {
  readonly code: string;

  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    details?: Record<string, string>
  ) {
    super(
      {
        error: {
          code,
          message,
          ...(details ? { details } : {})
        }
      },
      status
    );

    this.code = code;
  }
}
