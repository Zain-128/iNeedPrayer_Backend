import "dotenv/config";
import mongoose from "mongoose";
import { MONGO_URI } from "../contants.js";
import { User } from "../models/user.model.js";

export const ADMIN_EMAIL = "admin@ineedprayer.com";
export const ADMIN_PASSWORD = "Admin@123";
export const ADMIN_NAME = "Admin";

/**
 * Called on server start (after Mongo is connected).
 * Creates default admin if missing; does not reset password on redeploy.
 */
export async function ensureAdminUser() {
  const existing = await User.findOne({ email: ADMIN_EMAIL }).select("+password");

  if (existing) {
    let changed = false;

    if (existing.role !== "admin") {
      existing.role = "admin";
      changed = true;
    }
    if (existing.status !== "active") {
      existing.status = "active";
      existing.blockedReason = "";
      existing.blockedAt = null;
      changed = true;
    }

    if (changed) {
      await existing.save();
      console.log(`Admin user promoted/active: ${ADMIN_EMAIL}`);
    }

    return { created: false, email: ADMIN_EMAIL };
  }

  await User.create({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    name: ADMIN_NAME,
    role: "admin",
    status: "active",
  });

  console.log(`Admin user created: ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);

  return { created: true, email: ADMIN_EMAIL };
}

/** CLI / manual — always sets email, password, role, status. */
export async function seedAdminUser() {
  await mongoose.connect(MONGO_URI as string);

  let user = await User.findOne({ email: ADMIN_EMAIL }).select("+password");

  if (user) {
    user.name = ADMIN_NAME;
    user.password = ADMIN_PASSWORD;
    user.role = "admin";
    user.status = "active";
    user.blockedReason = "";
    user.blockedAt = null;
    await user.save();
    console.log(`Updated admin user: ${ADMIN_EMAIL}`);
  } else {
    await User.create({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: "admin",
      status: "active",
    });
    console.log(`Created admin user: ${ADMIN_EMAIL}`);
  }

  console.log("Admin credentials:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log("Login: POST /api/admin/auth/login");
}

async function main() {
  try {
    await seedAdminUser();
  } finally {
    await mongoose.disconnect();
  }
}

const isDirectRun = process.argv[1]?.includes("seedAdminUser");

if (isDirectRun) {
  main().catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  });
}
