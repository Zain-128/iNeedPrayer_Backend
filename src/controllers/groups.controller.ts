import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as groupsService from "../services/groups.service.js";
import { paramStr } from "../utils/routeParams.js";

function invalidId(res: Response) {
  return res.status(400).json({ message: "Invalid id" });
}

export const listGroups = async (req: AuthRequest, res: Response) => {
  try {
    const tab =
      req.query.tab === "my"
        ? "my"
        : req.query.tab === "joined"
          ? "joined"
          : undefined;
    const mine = req.query.mine === "1" || req.query.mine === "true";
    const groups = await groupsService.listGroups({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      tab,
      mine,
    });
    return res.json({ groups });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listMyGroups = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const groups = await groupsService.listGroups({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      tab: "my",
    });
    return res.json({ groups });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const discoverGroups = async (req: AuthRequest, res: Response) => {
  try {
    const groups = await groupsService.discoverGroups({
      userId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
    });
    return res.json({ groups });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getGroup = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const group = await groupsService.getGroup(id, req.userId);
    return res.json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const group = await groupsService.createGroup(req.userId, req.body ?? {});
    return res.status(201).json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const group = await groupsService.updateGroup(id, req.userId, req.body ?? {});
    return res.json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await groupsService.deleteGroup(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const joinGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const group = await groupsService.joinGroup(req.userId, id);
    return res.json({ group });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await groupsService.leaveGroup(req.userId, id);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const inviteGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const { userIds, emails } = req.body ?? {};
    const ids = Array.isArray(userIds)
      ? userIds.filter((x: unknown) => typeof x === "string")
      : [];
    const mail = Array.isArray(emails)
      ? emails.filter((x: unknown) => typeof x === "string")
      : [];

    if (!ids.length && !mail.length) {
      return res.status(400).json({ message: "userIds or emails required" });
    }

    const result = await groupsService.inviteToGroup(req.userId, id, {
      userIds: ids,
      emails: mail,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listMembers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const members = await groupsService.listGroupMembers(id, req.userId);
    return res.json({ members });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listInviteCandidates = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const users = await groupsService.listInviteCandidates(
      id,
      req.userId,
      typeof req.query.q === "string" ? req.query.q : undefined
    );
    return res.json({ users });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await groupsService.addGroupMember(id, req.userId, req.body ?? {});
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.removeGroupMember(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const { role } = req.body ?? {};
    const result = await groupsService.updateGroupMemberRole(
      id,
      req.userId,
      userId,
      role
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
