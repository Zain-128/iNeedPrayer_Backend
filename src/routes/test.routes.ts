import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, message: "test route" });
});

router.get("/ping", (_req, res) => {
  res.json({ ok: true, ping: "pong" });
});

export default router;
