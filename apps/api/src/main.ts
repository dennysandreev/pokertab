import "reflect-metadata";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiErrorFilter } from "./shared/api-error.filter";

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api", {
    exclude: [{ path: "health", method: RequestMethod.GET }]
  });
  app.enableCors();
  app.useGlobalFilters(new ApiErrorFilter());
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}
