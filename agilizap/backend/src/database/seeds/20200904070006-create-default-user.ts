import { QueryInterface } from "sequelize";
import { hash } from "bcryptjs";
import { validatePassword } from "../../security/policy";
module.exports = {
  up: async (qi: QueryInterface) => {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !email.includes("@")) throw new Error("Explicit BOOTSTRAP_ADMIN_EMAIL required");
    validatePassword(password);
    const passwordHash = await hash(password, 12);
    await qi.bulkInsert("Users", [{
      name: "Administrador", email, passwordHash, profile: "admin", companyId: 1,
      super: process.env.BOOTSTRAP_PLATFORM_ADMIN === "true", tokenVersion: 0,
      mustChangePassword: false, createdAt: new Date(), updatedAt: new Date()
    }]);
  },
  down: async () => { throw new Error("Bootstrap accounts must be removed explicitly by ID after review"); }
};
