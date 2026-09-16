import { userInfo } from "node:os";

/**
 * База для тестов с Prisma. Перед каждым тестом она очищается целиком, поэтому имя обязано
 * оканчиваться на _test: так тесты не сотрут dev-базу из-за перепутанной переменной.
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || `postgresql://${userInfo().username}@localhost:5432/bebradub_test`;
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`TEST_DATABASE_URL указывает на базу «${name}»: тесты её очистят. Нужна база с суффиксом _test`);
  }
  return url;
}
