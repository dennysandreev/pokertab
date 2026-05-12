import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { AuthController } from "./auth/auth.controller";
import { configureApp } from "./main";
import { ApiErrorFilter } from "./shared/api-error.filter";

type MockApp = {
  setGlobalPrefix: jest.Mock;
  enableCors: jest.Mock;
  useGlobalFilters: jest.Mock;
};

describe("configureApp routing", () => {
  it("excludes GET /health from the api prefix", () => {
    const app = createMockApp();

    configureApp(app as never);

    expect(app.setGlobalPrefix).toHaveBeenCalledWith("api", {
      exclude: [{ path: "health", method: RequestMethod.GET }]
    });
    expect(app.enableCors).toHaveBeenCalled();
    expect(app.useGlobalFilters).toHaveBeenCalledWith(expect.any(ApiErrorFilter));
  });

  it("keeps telegram auth route under /api/auth/telegram", () => {
    const authRouteDescriptor = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      "authenticateWithTelegram"
    ) as TypedPropertyDescriptor<(...args: unknown[]) => unknown> | undefined;
    const authRouteHandler = authRouteDescriptor?.value;

    if (!authRouteHandler) {
      throw new Error("Auth route handler is missing");
    }

    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe("auth");
    expect(Reflect.getMetadata(PATH_METADATA, authRouteHandler)).toBe("telegram");
    expect(Reflect.getMetadata(METHOD_METADATA, authRouteHandler)).toBe(RequestMethod.POST);
  });
});

function createMockApp(): MockApp {
  return {
    setGlobalPrefix: jest.fn(),
    enableCors: jest.fn(),
    useGlobalFilters: jest.fn()
  };
}
