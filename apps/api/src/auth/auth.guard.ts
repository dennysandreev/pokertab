import {
  type CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import { ApiError } from "../shared/api-error";
import { AUTH_ERROR_CODES } from "./auth.constants";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      throw new ApiError(
        AUTH_ERROR_CODES.unauthorized,
        "Нужна авторизация",
        HttpStatus.UNAUTHORIZED
      );
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();
    request.user = await this.authService.authenticateAccessToken(token);

    return true;
  }
}
