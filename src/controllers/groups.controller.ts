import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as groupsService from "../services/groups.service.js";
import * as reportsService from "../services/reports.service.js";
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
    const result = await groupsService.joinGroup(req.userId, id);
    return res.json(result);
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

export const listPendingJoinRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const requests = await groupsService.listPendingJoinRequests(id, req.userId);
    return res.json({ requests });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const approveJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.approveJoinRequest(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const rejectJoinRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.rejectJoinRequest(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listInvites = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);

    const raw = typeof req.query.status === "string" ? req.query.status : "all";
    const status =
      raw === "invited" ||
      raw === "pending" ||
      raw === "accepted" ||
      raw === "rejected" ||
      raw === "all"
        ? raw
        : "all";

    const invites = await groupsService.listGroupInvites(id, req.userId, status);
    return res.json({ invites });
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

export const cancelInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.cancelGroupInvite(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const resendInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.resendGroupInvite(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.acceptGroupInvite(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const rejectInvite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.rejectGroupInvite(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listGroupPosts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await groupsService.listGroupPosts(id, req.userId, {
      page,
      limit,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      lang: typeof req.query.lang === "string" ? req.query.lang : undefined,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listAdmins = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const admins = await groupsService.listGroupAdmins(id, req.userId);
    return res.json({ admins });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const makeAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.makeGroupAdmin(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) {
      return invalidId(res);
    }
    const result = await groupsService.removeGroupAdmin(id, req.userId, userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const reportGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const { reasonKey, otherText } = req.body ?? {};
    if (!reasonKey || typeof reasonKey !== "string") {
      return res.status(400).json({ message: "reasonKey is required" });
    }
    await reportsService.reportGroup(req.userId, id, reasonKey, otherText);
    return res.json({ message: "Report submitted" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const muteGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await groupsService.muteGroup(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const unmuteGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return invalidId(res);
    const result = await groupsService.unmuteGroup(id, req.userId);
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
