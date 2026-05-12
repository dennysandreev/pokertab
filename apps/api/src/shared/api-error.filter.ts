import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { ApiError } from "./api-error";

type HttpResponseLike = {
  status(code: number): HttpResponseLike;
  json(payload: unknown): void;
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();

    if (exception instanceof ApiError) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === "object" && payload !== null && "error" in payload) {
        response.status(status).json(payload);
        return;
      }

      const message = typeof payload === "string" ? payload : exception.message;

      response.status(status).json({
        error: {
          code: status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR",
          message
        }
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Внутренняя ошибка сервиса"
      }
    });
  }
}
