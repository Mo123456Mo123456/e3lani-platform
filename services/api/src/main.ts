import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { parseServerEnv } from "@e3lani/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const env = parseServerEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.use(helmet());
  app.enableCors({
    origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN],
    credentials: false,
    methods: ["GET", "POST", "PATCH", "DELETE"]
  });
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();
  await app.listen(env.API_PORT, "0.0.0.0");
  console.info(`E3lani API listening on ${env.API_PORT}`);
}

void bootstrap();
