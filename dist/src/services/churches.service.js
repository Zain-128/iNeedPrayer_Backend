import mongoose from "mongoose";
import { Church } from "../models/church.model.js";
import { ChurchFollow } from "../models/churchFollow.model.js";
import { ChurchMember } from "../models/churchMember.model.js";
import { ChurchInvite } from "../models/churchInvite.model.js";
import { User } from "../models/user.model.js";
import { ChurchEvent } from "../models/event.model.js";
import { FriendRequest } from "../models/friendRequest.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { UserSubscription } from "../models/userSubscription.model.js";
import { LiveStreamSettings } from "../models/liveStreamSettings.model.js";
import { createNotification, notifyMany } from "./notifications.service.js";
import { CHURCH_VERIFY_CODE, isSmtpConfigured } from "../contants.js";
import { queueEmail, sendEmail } from "./email/mailer.js";
import { churchVerificationCodeEmail, churchVerifiedEmail, } from "./email/templates.js";
const CHURCH_CODE_TTL_MINUTES = 15;
const CHURCH_RESEND_COOLDOWN_MS = 60 * 1000; // 60s cooldown to protect SMTP
/** Default / bypass stub code (12345) accepted for testing and fast verification. */
function isChurchStubCode(code) {
    if (!code)
        return false;
    const trimmed = code.trim();
    return (trimmed === CHURCH_VERIFY_CODE ||
        trimmed === "12345" ||
        trimmed === "1234");
}
async function sendChurchVerificationSms(phone, churchName, code) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;
    const bodyText = `Your verification code for ${churchName} on I Need Prayer is: ${code}. Valid for 15 minutes.`;
    if (accountSid && authToken && fromNumber) {
        try {
            const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
            const params = new URLSearchParams({
                To: phone,
                From: fromNumber,
                Body: bodyText,
            });
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            });
            if (!res.ok) {
                const errText = await res.text();
                console.warn(`Twilio SMS failed with HTTP ${res.status}:`, errText);
            }
            else {
                console.log(`[CHURCH VERIFICATION SMS] Sent successfully to ${phone}`);
            }
        }
        catch (e) {
            console.warn("Twilio SMS send error:", e?.message);
        }
    }
    else {
        console.log(`[CHURCH VERIFICATION SMS (SIMULATED)] Phone: ${phone} | Church: "${churchName}" | Code: ${code} (Default code: 12345)`);
    }
}
import { formatCountLabel } from "../utils/mappers.js";
import { normalizeChurchInput, validateCreateChurchInput, } from "../utils/churchInput.js";
export function getChurchPermissionsForRole(role) {
    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isEditor = role === "editor";
    return {
        isOwner,
        canEditChurch: isOwner || isAdmin,
        canManageAdmins: isOwner,
        canManageEditors: isOwner || isAdmin,
        canManageFollowers: isOwner || isAdmin,
        canManageInvitations: isOwner || isAdmin,
        canManageEvents: isOwner || isAdmin || isEditor,
        canManagePosts: isOwner || isAdmin || isEditor,
        canManageLiveStreams: isOwner || isAdmin,
        canAccessAnalytics: isOwner || isAdmin,
        canManageWallet: isOwner,
        canManageWithdrawals: isOwner,
        canDeleteChurch: isOwner,
    };
}
function generateVerificationCode() {
    return String(Math.floor(10000 + Math.random() * 90000));
}
async function assertChurchManager(churchId, userId) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const doc = church;
    if (church.createdBy?.toString() === userId) {
        return { church: doc };
    }
    const member = await ChurchMember.findOne({
        church: churchId,
        user: userId,
        role: { $in: ["owner", "admin"] },
    });
    if (!member) {
        const err = new Error("Not allowed");
        err.statusCode = 403;
        throw err;
    }
    return { church: doc };
}
export async function getChurchUserRole(churchId, userId) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (!userId) {
        return { role: "none", church };
    }
    if (church.createdBy?.toString() === userId) {
        return { role: "owner", church };
    }
    const member = await ChurchMember.findOne({ church: churchId, user: userId }).lean();
    if (member?.role && ["owner", "admin", "editor", "member"].includes(member.role)) {
        return { role: member.role, church };
    }
    const isFollowing = await ChurchFollow.exists({ church: churchId, user: userId });
    if (isFollowing) {
        return { role: "follower", church };
    }
    return { role: "none", church };
}
export async function getUserChurchPermissions(churchId, userId) {
    const { role } = await getChurchUserRole(churchId, userId);
    return {
        role,
        permissions: getChurchPermissionsForRole(role),
    };
}
export async function assertChurchPermission(churchId, userId, permKey) {
    const { role, church } = await getChurchUserRole(churchId, userId);
    const perms = getChurchPermissionsForRole(role);
    if (!perms[permKey]) {
        const err = new Error(`Forbidden: You do not have permission to perform this action (${String(permKey)})`);
        err.statusCode = 403;
        throw err;
    }
    return { church, role, perms };
}
function mapChurch(c, userId, followedSet, myChurchSet) {
    const id = c._id.toString();
    const banner = c.bannerImage || c.image || "";
    const image = c.image ?? "";
    const email = c.email ?? "";
    const phone = c.phone ?? "";
    const about = c.about ?? "";
    const pastorName = c.pastorName ?? "";
    const socialLinks = (c.socialLinks ?? [])
        .filter((s) => s?.platform && s?.url)
        .map((s) => ({
        platform: String(s.platform).trim(),
        url: String(s.url).trim(),
    }));
    const rawImages = Array.isArray(c.images) ? c.images : [];
    const images = rawImages
        .map((x) => String(x ?? "").trim())
        .filter(Boolean);
    return {
        id,
        // Canonical fields
        name: c.name,
        locationShort: c.locationShort ?? "",
        locationFull: c.locationFull ?? "",
        country: c.country ?? "",
        state: c.state ?? "",
        city: c.city ?? "",
        streetAddress: c.streetAddress ?? "",
        landmark: c.landmark ?? "",
        followersLabel: formatCountLabel(c.followerCount ?? 0, "followers"),
        membersLabel: formatCountLabel(c.memberCount ?? 1, "members"),
        image,
        bannerImage: banner,
        banner,
        images,
        website: c.website ?? "",
        email,
        phone,
        denomination: c.denomination ?? "",
        shortBio: c.shortBio ?? "",
        about,
        liveStreamUrl: c.liveStreamUrl ?? "",
        pastorName,
        socialLinks,
        isVerified: !!c.isVerified,
        isFollowed: userId && followedSet ? followedSet.has(id) : false,
        isMyChurch: userId && myChurchSet
            ? myChurchSet.has(id)
            : c.createdBy?.toString() === userId,
        followerCount: c.followerCount ?? 0,
        memberCount: c.memberCount ?? 1,
        // UI aliases (CreateChurch / EditChurch payload shape)
        churchName: c.name,
        businessEmail: email,
        businessPhone: phone,
        pastorOrLeaderName: pastorName,
        aboutChurch: about,
        logo: image,
    };
}
async function loadUserContext(userId) {
    let followedSet = new Set();
    let myChurchSet = new Set();
    if (!userId)
        return { followedSet, myChurchSet };
    const [follows, owned, adminMemberships] = await Promise.all([
        ChurchFollow.find({ user: userId }).select("church").lean(),
        Church.find({ createdBy: userId }).select("_id").lean(),
        ChurchMember.find({ user: userId }).select("church role").lean(),
    ]);
    followedSet = new Set(follows.map((f) => f.church.toString()));
    myChurchSet = new Set(owned.map((m) => m._id.toString()));
    for (const m of adminMemberships) {
        if (m.role === "owner" || m.role === "admin") {
            myChurchSet.add(m.church.toString());
        }
    }
    return { followedSet, myChurchSet };
}
export async function listChurches(opts) {
    let sort = { followerCount: -1 };
    if (opts.filter === "nearest" ||
        opts.filter === "trending_posts" ||
        opts.filter === "trending_search") {
        sort = { updatedAt: -1 };
    }
    const q = opts.q?.trim();
    const rx = q
        ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : null;
    const mongoFilter = rx
        ? {
            $or: [
                { name: rx },
                { locationShort: rx },
                { about: rx },
                { city: rx },
                { country: rx },
            ],
        }
        : {};
    // Public browse only shows approved churches; "my" / "followed" keep owner's view
    if (opts.tab !== "my" && opts.tab !== "followed") {
        mongoFilter.status = "Approved";
    }
    let docs = await Church.find(mongoFilter).sort(sort).limit(100).lean();
    const { followedSet, myChurchSet } = await loadUserContext(opts.userId);
    if (opts.userId && opts.tab === "my") {
        docs = docs.filter((c) => myChurchSet.has(c._id.toString()));
    }
    if (opts.userId && opts.tab === "followed") {
        docs = docs.filter((c) => followedSet.has(c._id.toString()));
    }
    return docs.map((c) => mapChurch(c, opts.userId, followedSet, myChurchSet));
}
export async function discoverChurches(opts) {
    const q = opts.q?.trim();
    const rx = q
        ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        : null;
    const mongoFilter = {
        status: "Approved",
        ...(rx
            ? {
                $or: [{ name: rx }, { locationShort: rx }, { city: rx }],
            }
            : {}),
    };
    let docs = await Church.find(mongoFilter)
        .sort({ followerCount: -1 })
        .limit(100)
        .lean();
    const { followedSet, myChurchSet } = await loadUserContext(opts.userId);
    if (opts.userId) {
        docs = docs.filter((c) => !myChurchSet.has(c._id.toString()) &&
            !followedSet.has(c._id.toString()));
    }
    return docs.map((c) => mapChurch(c, opts.userId, followedSet, myChurchSet));
}
export async function getChurch(id, userId) {
    const c = await Church.findById(id).lean();
    if (!c) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const { followedSet, myChurchSet } = await loadUserContext(userId);
    const isMine = userId ? myChurchSet.has(c._id.toString()) : false;
    if ((c.status === "Suspended" || c.status === "Rejected") &&
        !isMine) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    return mapChurch(c, userId, followedSet, myChurchSet);
}
function applyNormalizedToChurch(church, input, partial = false) {
    const fields = [
        "name",
        "website",
        "country",
        "state",
        "city",
        "streetAddress",
        "landmark",
        "locationShort",
        "locationFull",
        "email",
        "phone",
        "shortBio",
        "about",
        "image",
        "bannerImage",
        "denomination",
        "liveStreamUrl",
        "pastorName",
    ];
    for (const f of fields) {
        const v = input[f];
        if (typeof v !== "string")
            continue;
        if (partial && v === "")
            continue;
        if (!partial || v !== undefined) {
            church[f] = v;
        }
    }
    // socialLinks: on create always set; on PATCH only if client sent the key
    if (!partial || input.socialLinksProvided) {
        church.socialLinks =
            input.socialLinks ?? [];
    }
    // images: on create always set; on PATCH only if client sent the key
    if (!partial || input.images !== undefined) {
        church.images = input.images || [];
    }
}
export async function createChurch(userId, body, opts) {
    const input = normalizeChurchInput(body);
    const validationError = validateCreateChurchInput(input);
    if (validationError) {
        const err = new Error(validationError);
        err.statusCode = 400;
        throw err;
    }
    const existingOwned = await Church.findOne({ createdBy: userId }).select("_id");
    if (existingOwned) {
        const err = new Error("You can only create one church");
        err.statusCode = 409;
        throw err;
    }
    const code = opts?.verificationCode?.trim() ||
        (opts?.skipVerification ? null : generateVerificationCode());
    const isVerified = opts?.skipVerification || isChurchStubCode(code);
    const c = await Church.create({
        name: input.name,
        website: input.website,
        country: input.country,
        state: input.state,
        city: input.city,
        streetAddress: input.streetAddress,
        landmark: input.landmark,
        locationShort: input.locationShort,
        locationFull: input.locationFull,
        email: input.email,
        phone: input.phone,
        shortBio: input.shortBio,
        about: input.about,
        image: input.image,
        bannerImage: input.bannerImage,
        images: input.images || [],
        denomination: input.denomination,
        liveStreamUrl: input.liveStreamUrl,
        pastorName: input.pastorName,
        socialLinks: input.socialLinks,
        isVerified: !!isVerified,
        verificationCode: isVerified ? null : code,
        verificationCodeExpiresAt: isVerified
            ? null
            : new Date(Date.now() + CHURCH_CODE_TTL_MINUTES * 60 * 1000),
        createdBy: userId,
        memberCount: 1,
    });
    await ChurchMember.create({
        user: userId,
        church: c._id,
        role: "owner",
    });
    const { ensureEntityWallet } = await import("./wallet.service.js");
    void ensureEntityWallet("church", c._id.toString());
    const church = await getChurch(c._id.toString(), userId);
    if (!isVerified && code) {
        if (c.email?.trim()) {
            if (isSmtpConfigured()) {
                try {
                    await sendEmail(c.email.trim(), churchVerificationCodeEmail({ churchName: c.name, code, minutes: CHURCH_CODE_TTL_MINUTES }));
                    console.log(`[CHURCH VERIFICATION EMAIL] Sent verification code ${code} to ${c.email.trim()}`);
                }
                catch (e) {
                    console.warn("[CHURCH VERIFICATION EMAIL] Failed to send email:", e?.message);
                }
            }
            else {
                console.log(`[CHURCH VERIFICATION EMAIL (FALLBACK)] Church: "${c.name}" | Email: ${c.email.trim()} | Code: ${code} (Default bypass: 12345)`);
            }
        }
    }
    const { recordAdminActivity } = await import("./admin/adminActivity.service.js");
    void recordAdminActivity({
        type: isVerified ? "church_created" : "church_pending",
        title: isVerified
            ? "New church created"
            : "New church pending verification",
        message: c.name,
        refType: "church",
        refId: c._id.toString(),
        actorId: userId,
        meta: { isVerified: !!isVerified },
    });
    return {
        church,
        verificationRequired: !isVerified,
        devVerificationCode: !isVerified ? (code || CHURCH_VERIFY_CODE || "12345") : undefined,
    };
}
export async function updateChurch(churchId, userId, body) {
    const { church } = await assertChurchManager(churchId, userId);
    const input = normalizeChurchInput(body);
    if (input.name === "" && body?.name !== "") {
        const err = new Error("Church name is required");
        err.statusCode = 400;
        throw err;
    }
    applyNormalizedToChurch(church, input, true);
    if (input.name)
        church.name = input.name;
    await church.save();
    return getChurch(churchId, userId);
}
export async function deleteChurch(churchId, userId) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (church.createdBy?.toString() !== userId) {
        const err = new Error("Only the church owner can delete");
        err.statusCode = 403;
        throw err;
    }
    await Promise.all([
        ChurchFollow.deleteMany({ church: churchId }),
        ChurchMember.deleteMany({ church: churchId }),
        church.deleteOne(),
    ]);
    return { ok: true };
}
export async function sendChurchVerification(churchId, userId) {
    const { church } = await assertChurchManager(churchId, userId);
    if (church.isVerified) {
        return { ok: true, alreadyVerified: true };
    }
    const rawChurch = await Church.findById(churchId).select("+verificationRequestedAt");
    const lastRequested = rawChurch?.verificationRequestedAt?.getTime() ?? 0;
    if (Date.now() - lastRequested < CHURCH_RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.max(1, Math.ceil((CHURCH_RESEND_COOLDOWN_MS - (Date.now() - lastRequested)) / 1000));
        const err = new Error(`Please wait ${waitSeconds}s before requesting a new verification code.`);
        err.statusCode = 429;
        throw err;
    }
    const code = generateVerificationCode();
    church.verificationCode = code;
    church.verificationCodeExpiresAt = new Date(Date.now() + CHURCH_CODE_TTL_MINUTES * 60 * 1000);
    church.verificationRequestedAt = new Date();
    await church.save();
    if (church.email?.trim()) {
        if (isSmtpConfigured()) {
            try {
                await sendEmail(church.email.trim(), churchVerificationCodeEmail({ churchName: church.name, code, minutes: CHURCH_CODE_TTL_MINUTES }));
                console.log(`[CHURCH VERIFICATION EMAIL] Resent code ${code} to ${church.email.trim()}`);
            }
            catch (e) {
                console.warn("[CHURCH VERIFICATION EMAIL] Could not send church verification email:", e?.message);
            }
        }
        else {
            console.log(`[CHURCH VERIFICATION EMAIL (FALLBACK)] Resend Email: ${church.email} | Code: ${code} (Default code: 12345)`);
        }
    }
    return {
        ok: true,
        channel: "email",
        email: church.email,
        target: church.email,
        devVerificationCode: CHURCH_VERIFY_CODE || code || "12345",
    };
}
export async function verifyChurch(churchId, code, userId) {
    const raw = await Church.findById(churchId).select("+verificationCode +verificationCodeExpiresAt");
    if (!raw) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const church = raw;
    const trimmed = String(code ?? "").trim();
    const stubOk = isChurchStubCode(trimmed);
    const storedOk = church.verificationCode &&
        trimmed === church.verificationCode &&
        church.verificationCodeExpiresAt &&
        church.verificationCodeExpiresAt > new Date();
    if (!stubOk && !storedOk) {
        const err = new Error("Invalid verification code. Please check your church email, or enter 12345.");
        err.statusCode = 400;
        throw err;
    }
    church.isVerified = true;
    church.verificationCode = null;
    church.verificationCodeExpiresAt = null;
    await church.save();
    if (church.email) {
        queueEmail(church.email, churchVerifiedEmail(church.name));
    }
    return {
        ok: true,
        church: await getChurch(churchId, userId),
    };
}
export async function toggleFollowChurch(userId, churchId) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const ex = await ChurchFollow.findOne({ user: userId, church: churchId });
    if (ex) {
        await ex.deleteOne();
        church.followerCount = Math.max(0, church.followerCount - 1);
        await church.save();
        return {
            following: false,
            followerCount: church.followerCount,
            followersLabel: formatCountLabel(church.followerCount, "followers"),
        };
    }
    await ChurchFollow.create({ user: userId, church: churchId });
    church.followerCount += 1;
    await church.save();
    // If there was a pending church invite for this user, mark it accepted
    await ChurchInvite.updateOne({ church: churchId, user: userId, status: "pending" }, { $set: { status: "accepted" } }).catch(() => null);
    return {
        following: true,
        followerCount: church.followerCount,
        followersLabel: formatCountLabel(church.followerCount, "followers"),
    };
}
export async function listChurchMembers(churchId, userId) {
    await assertChurchManager(churchId, userId);
    const members = await ChurchMember.find({ church: churchId })
        .populate("user", "name email avatar")
        .sort({ role: 1, createdAt: 1 })
        .lean();
    return members.map((m) => ({
        id: m._id.toString(),
        userId: m.user?._id?.toString() ?? "",
        name: m.user?.name ?? "",
        email: m.user?.email ?? "",
        avatar: m.user?.avatar ?? "",
        role: m.role,
        joinedAt: m.createdAt,
    }));
}
export async function addChurchMember(churchId, actorId, body) {
    await assertChurchManager(churchId, actorId);
    let targetUserId = body.userId?.trim();
    if (!targetUserId && body.email?.trim()) {
        const u = await User.findOne({ email: body.email.trim().toLowerCase() });
        if (!u) {
            const err = new Error("User not found for that email");
            err.statusCode = 404;
            throw err;
        }
        targetUserId = u._id.toString();
    }
    if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
        const err = new Error("userId or email is required");
        err.statusCode = 400;
        throw err;
    }
    const role = body.role === "admin" || body.role === "member" ? body.role : "member";
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const ex = await ChurchMember.findOne({ church: churchId, user: targetUserId });
    if (ex) {
        const err = new Error("User is already a church member");
        err.statusCode = 400;
        throw err;
    }
    await ChurchMember.create({ church: churchId, user: targetUserId, role });
    church.memberCount = (church.memberCount ?? 0) + 1;
    await church.save();
    const user = await User.findById(targetUserId).select("name email avatar").lean();
    return {
        member: {
            userId: targetUserId,
            name: user?.name ?? "",
            email: user?.email ?? "",
            avatar: user?.avatar ?? "",
            role,
        },
        memberCount: church.memberCount,
    };
}
export async function removeChurchMember(churchId, actorId, targetUserId) {
    await assertChurchManager(churchId, actorId);
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (church.createdBy?.toString() === targetUserId) {
        const err = new Error("Cannot remove the church owner");
        err.statusCode = 400;
        throw err;
    }
    const ex = await ChurchMember.findOne({ church: churchId, user: targetUserId });
    if (!ex) {
        const err = new Error("Member not found");
        err.statusCode = 404;
        throw err;
    }
    await ex.deleteOne();
    church.memberCount = Math.max(1, (church.memberCount ?? 1) - 1);
    await church.save();
    return { ok: true, memberCount: church.memberCount };
}
export async function updateChurchMemberRole(churchId, actorId, targetUserId, role) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (church.createdBy?.toString() !== actorId) {
        const err = new Error("Only the church owner can change roles");
        err.statusCode = 403;
        throw err;
    }
    if (targetUserId === actorId) {
        const err = new Error("Cannot change owner role");
        err.statusCode = 400;
        throw err;
    }
    if (role !== "admin" && role !== "member") {
        const err = new Error("role must be admin or member");
        err.statusCode = 400;
        throw err;
    }
    const ex = await ChurchMember.findOne({ church: churchId, user: targetUserId });
    if (!ex) {
        const err = new Error("Member not found");
        err.statusCode = 404;
        throw err;
    }
    ex.role = role;
    await ex.save();
    return { ok: true, userId: targetUserId, role };
}
export async function getNearbyChurches(opts) {
    const q = opts.q?.trim();
    const filter = { status: "Approved" };
    if (opts.city)
        filter.city = new RegExp(opts.city, "i");
    if (opts.state)
        filter.state = new RegExp(opts.state, "i");
    if (opts.country)
        filter.country = new RegExp(opts.country, "i");
    if (q) {
        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ name: rx }, { city: rx }, { streetAddress: rx }];
    }
    const { followedSet, myChurchSet } = await loadUserContext(opts.userId);
    const docs = await Church.find(filter)
        .sort({ followerCount: -1 })
        .limit(Math.min(50, Math.max(1, opts.limit || 20)))
        .lean();
    return docs.map((c) => mapChurch(c, opts.userId, followedSet, myChurchSet));
}
export async function getChurchAnalytics(churchId, userId) {
    const { church } = await assertChurchManager(churchId, userId);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [followers, newFollowers, members] = await Promise.all([
        ChurchFollow.countDocuments({ church: churchId }),
        ChurchFollow.countDocuments({ church: churchId, createdAt: { $gte: thirtyDaysAgo } }),
        ChurchMember.countDocuments({ church: churchId }),
    ]);
    return {
        churchId,
        churchName: church.name,
        followers: Math.max(followers, church.followerCount || 0),
        newFollowersLast30Days: newFollowers,
        members: Math.max(members, church.memberCount || 1),
        isVerified: !!church.isVerified,
    };
}
function mapPopulatedInviteUser(u) {
    if (!u || typeof u !== "object")
        return null;
    const o = u;
    return {
        id: o._id?.toString() ?? "",
        name: o.name ?? "",
        email: o.email ?? "",
        avatar: o.avatar ?? "",
    };
}
function mapChurchInvite(inv) {
    const user = mapPopulatedInviteUser(inv.user);
    return {
        id: inv._id.toString(),
        user,
        status: inv.status,
        invitedBy: {
            id: inv.invitedBy?._id?.toString() ??
                "",
            name: inv.invitedBy?.name ?? "",
            avatar: inv.invitedBy?.avatar ?? "",
        },
        invitedAt: inv.createdAt,
    };
}
export async function inviteUsersToChurch(churchId, inviterId, opts) {
    if (!mongoose.isValidObjectId(churchId)) {
        const err = new Error("Invalid church ID");
        err.statusCode = 400;
        throw err;
    }
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    // 1. Allow church owners/admins to invite
    const isCreator = church.createdBy?.toString() === inviterId;
    let isManager = isCreator;
    if (!isManager) {
        const member = await ChurchMember.findOne({
            church: churchId,
            user: inviterId,
            role: { $in: ["owner", "admin"] },
        });
        if (member)
            isManager = true;
    }
    if (!isManager) {
        const err = new Error("Only church owners and administrators can send invitations");
        err.statusCode = 403;
        throw err;
    }
    // 2. Validate selected user IDs
    const rawUserIds = Array.isArray(opts) ? opts : (opts?.userIds ?? []);
    const rawEmails = Array.isArray(opts) ? [] : (opts?.emails ?? []);
    const targetIds = new Set();
    for (const rawId of rawUserIds) {
        const uid = String(rawId || "").trim();
        if (mongoose.isValidObjectId(uid) && uid !== inviterId) {
            targetIds.add(uid);
        }
    }
    for (const rawEmail of rawEmails) {
        const trimmed = String(rawEmail || "").trim().toLowerCase();
        if (!trimmed)
            continue;
        const u = await User.findOne({ email: trimmed }).select("_id").lean();
        if (u && u._id.toString() !== inviterId) {
            targetIds.add(u._id.toString());
        }
    }
    if (targetIds.size === 0) {
        return {
            message: "Invitations sent successfully",
            invited: 0,
        };
    }
    // Ensure user records actually exist in database
    const objectIds = Array.from(targetIds).map((id) => new mongoose.Types.ObjectId(id));
    const existingUsers = await User.find({ _id: { $in: objectIds } })
        .select("_id")
        .lean();
    const validUserIds = existingUsers.map((u) => u._id.toString());
    if (validUserIds.length === 0) {
        return {
            message: "Invitations sent successfully",
            invited: 0,
        };
    }
    // 3. Prevent duplicate invitations and invitations to existing followers & members
    const [existingFollowers, existingMembers, existingInvites] = await Promise.all([
        ChurchFollow.find({
            church: churchId,
            user: { $in: validUserIds },
        })
            .select("user")
            .lean(),
        ChurchMember.find({
            church: churchId,
            user: { $in: validUserIds },
        })
            .select("user")
            .lean(),
        ChurchInvite.find({
            church: churchId,
            user: { $in: validUserIds },
        }),
    ]);
    const followerIds = new Set(existingFollowers.map((f) => f.user.toString()));
    const memberIds = new Set(existingMembers.map((m) => m.user.toString()));
    const inviteMap = new Map();
    for (const inv of existingInvites) {
        inviteMap.set(inv.user.toString(), inv);
    }
    // 4. Create pending invitations for the selected users
    let invited = 0;
    for (const uid of validUserIds) {
        if (followerIds.has(uid))
            continue;
        if (memberIds.has(uid))
            continue;
        const existingInvite = inviteMap.get(uid);
        if (existingInvite?.status === "pending" ||
            existingInvite?.status === "accepted") {
            continue;
        }
        if (existingInvite) {
            existingInvite.status = "pending";
            existingInvite.invitedBy = new mongoose.Types.ObjectId(inviterId);
            await existingInvite.save();
        }
        else {
            await ChurchInvite.create({
                church: churchId,
                user: uid,
                invitedBy: inviterId,
                status: "pending",
            });
        }
        invited += 1;
        // Send in-app notification to the invited user
        await createNotification({
            userId: uid,
            actorId: inviterId,
            title: "Church Invitation",
            body: `You were invited to follow ${church.name}`,
            kind: "church_invite",
            refType: "church",
            refId: String(churchId),
        }).catch(() => null);
    }
    // 5. Return expected response
    return {
        message: "Invitations sent successfully",
        invited,
    };
}
function mapChurchEvent(e) {
    return {
        id: e._id.toString(),
        churchId: e.churchId?._id ? e.churchId._id.toString() : (e.churchId?.toString() ?? ""),
        churchName: e.churchName ?? "",
        title: e.title,
        description: e.description ?? "",
        eventDate: e.eventDate,
        eventEndDate: e.eventEndDate,
        startTime: e.startTime ?? "",
        endTime: e.endTime ?? "",
        timezone: e.timezone ?? "UTC",
        location: e.location ?? "",
        eventType: e.eventType || (e.type?.toLowerCase() === "physical" ? "in_person" : (e.type?.toLowerCase() || "in_person")),
        coverImage: e.coverImage ?? "",
        status: (e.status ?? "published").toLowerCase(),
        attendees: e.attendees ?? 0,
        maxAttendees: e.maxAttendees ?? 0,
        meetingUrl: e.meetingUrl ?? "",
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
    };
}
function mapReceivedChurchInvite(inv) {
    const c = inv.church;
    return {
        id: inv._id.toString(),
        church: c
            ? {
                id: c._id?.toString() ?? "",
                name: c.name ?? "",
                image: c.image ?? "",
                bannerImage: c.bannerImage || c.image || "",
                locationShort: c.locationShort ?? "",
                followerCount: c.followerCount ?? 0,
                city: c.city ?? "",
                state: c.state ?? "",
            }
            : null,
        invitedBy: {
            id: inv.invitedBy?._id?.toString() ?? "",
            name: inv.invitedBy?.name ?? "",
            avatar: inv.invitedBy?.avatar ?? "",
        },
        status: inv.status,
        createdAt: inv.createdAt,
    };
}
export async function unfollowChurch(userId, churchId) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const ex = await ChurchFollow.findOne({ user: userId, church: churchId });
    if (ex) {
        await ex.deleteOne();
        church.followerCount = Math.max(0, (church.followerCount || 0) - 1);
        await church.save();
    }
    return {
        following: false,
        followerCount: church.followerCount || 0,
        followersLabel: formatCountLabel(church.followerCount || 0, "followers"),
    };
}
export async function listChurchInviteCandidates(churchId, inviterId, q) {
    await assertChurchPermission(churchId, inviterId, "canManageInvitations");
    const friendRequests = await FriendRequest.find({
        status: "accepted",
        $or: [{ from: inviterId }, { to: inviterId }],
    })
        .populate("from", "name email avatar deletedAt")
        .populate("to", "name email avatar deletedAt")
        .lean();
    const blocks = await UserBlock.find({
        $or: [{ blocker: inviterId }, { blocked: inviterId }],
    }).lean();
    const blockedIds = new Set();
    for (const b of blocks) {
        if (b.blocker.toString() === inviterId)
            blockedIds.add(b.blocked.toString());
        else
            blockedIds.add(b.blocker.toString());
    }
    const [existingFollowers, existingMembers, pendingInvites] = await Promise.all([
        ChurchFollow.find({ church: churchId }).select("user").lean(),
        ChurchMember.find({ church: churchId }).select("user").lean(),
        ChurchInvite.find({ church: churchId, status: "pending" }).select("user").lean(),
    ]);
    const excludeIds = new Set([
        ...existingFollowers.map((f) => f.user.toString()),
        ...existingMembers.map((m) => m.user.toString()),
        ...pendingInvites.map((i) => i.user.toString()),
        inviterId,
        ...blockedIds,
    ]);
    const search = q?.trim().toLowerCase();
    const candidates = [];
    for (const fr of friendRequests) {
        const friendObj = fr.from._id.toString() === inviterId ? fr.to : fr.from;
        if (!friendObj || friendObj.deletedAt)
            continue;
        const friendId = friendObj._id.toString();
        if (excludeIds.has(friendId))
            continue;
        if (search) {
            const name = (friendObj.name || "").toLowerCase();
            const email = (friendObj.email || "").toLowerCase();
            if (!name.includes(search) && !email.includes(search)) {
                continue;
            }
        }
        candidates.push({
            id: friendId,
            name: friendObj.name || "",
            email: friendObj.email || "",
            avatar: friendObj.avatar || "",
        });
    }
    candidates.sort((a, b) => a.name.localeCompare(b.name));
    return { users: candidates };
}
export async function listSentChurchFollowInvites(churchId, actorId, status = "all") {
    await assertChurchPermission(churchId, actorId, "canManageInvitations");
    const filter = { church: churchId };
    if (status && status !== "all") {
        if (status === "declined" || status === "rejected") {
            filter.status = { $in: ["declined", "rejected"] };
        }
        else {
            filter.status = status;
        }
    }
    const invites = await ChurchInvite.find(filter)
        .populate("user", "name email avatar")
        .populate("invitedBy", "name avatar")
        .sort({ createdAt: -1 })
        .lean();
    return {
        invites: invites.filter((i) => i.user != null).map(mapChurchInvite),
    };
}
export async function listReceivedChurchFollowInvites(userId) {
    const invites = await ChurchInvite.find({
        user: userId,
        status: "pending",
    })
        .populate("church", "name image bannerImage locationShort followerCount city state")
        .populate("invitedBy", "name avatar")
        .sort({ createdAt: -1 })
        .lean();
    return {
        invites: invites.filter((i) => i.church != null).map(mapReceivedChurchInvite),
    };
}
export async function acceptChurchFollowInvite(paramId, userId, explicitInviteId) {
    const query = {};
    if (explicitInviteId && mongoose.isValidObjectId(explicitInviteId)) {
        query._id = explicitInviteId;
    }
    else if (mongoose.isValidObjectId(paramId)) {
        query.$or = [{ _id: paramId }, { church: paramId, user: userId }];
    }
    else {
        const err = new Error("Invalid invite or church ID");
        err.statusCode = 400;
        throw err;
    }
    const invite = await ChurchInvite.findOne(query);
    if (!invite) {
        const err = new Error("Invitation not found");
        err.statusCode = 404;
        throw err;
    }
    if (invite.user.toString() !== userId) {
        const err = new Error("You can only accept your own invitation");
        err.statusCode = 403;
        throw err;
    }
    invite.status = "accepted";
    await invite.save();
    const church = await Church.findById(invite.church);
    if (church) {
        const isFollowing = await ChurchFollow.exists({ church: church._id, user: userId });
        if (!isFollowing) {
            await ChurchFollow.create({ church: church._id, user: userId });
            church.followerCount = (church.followerCount || 0) + 1;
            await church.save();
        }
    }
    if (invite.invitedBy) {
        const inviterId = invite.invitedBy.toString();
        const user = await User.findById(userId).select("name").lean();
        await createNotification({
            userId: inviterId,
            actorId: userId,
            title: "Invitation Accepted",
            body: `${user?.name || "A user"} accepted your invitation to follow ${church?.name || "the church"}`,
            kind: "church_invite_accepted",
            refType: "church",
            refId: invite.church.toString(),
        }).catch(() => null);
    }
    return {
        message: "Invitation accepted",
        following: true,
        followerCount: church?.followerCount || 0,
    };
}
export async function declineChurchFollowInvite(paramId, userId, explicitInviteId) {
    const query = {};
    if (explicitInviteId && mongoose.isValidObjectId(explicitInviteId)) {
        query._id = explicitInviteId;
    }
    else if (mongoose.isValidObjectId(paramId)) {
        query.$or = [{ _id: paramId }, { church: paramId, user: userId }];
    }
    else {
        const err = new Error("Invalid invite or church ID");
        err.statusCode = 400;
        throw err;
    }
    const invite = await ChurchInvite.findOne(query);
    if (!invite) {
        const err = new Error("Invitation not found");
        err.statusCode = 404;
        throw err;
    }
    if (invite.user.toString() !== userId) {
        const err = new Error("You can only decline your own invitation");
        err.statusCode = 403;
        throw err;
    }
    invite.status = "declined";
    await invite.save();
    return { message: "Invitation declined" };
}
export async function cancelChurchFollowInvite(paramId, actorId, explicitInviteId) {
    let invite = null;
    if (explicitInviteId && mongoose.isValidObjectId(explicitInviteId)) {
        invite = await ChurchInvite.findById(explicitInviteId);
    }
    else if (mongoose.isValidObjectId(paramId)) {
        invite = await ChurchInvite.findOne({ $or: [{ _id: paramId }, { user: paramId }] });
    }
    if (!invite) {
        const err = new Error("Invitation not found");
        err.statusCode = 404;
        throw err;
    }
    await assertChurchPermission(invite.church.toString(), actorId, "canManageInvitations");
    invite.status = "cancelled";
    await invite.save();
    return { message: "Invitation cancelled" };
}
export async function resendChurchFollowInvite(paramId, actorId, explicitInviteId) {
    let invite = null;
    if (explicitInviteId && mongoose.isValidObjectId(explicitInviteId)) {
        invite = await ChurchInvite.findById(explicitInviteId);
    }
    else if (mongoose.isValidObjectId(paramId)) {
        invite = await ChurchInvite.findOne({ $or: [{ _id: paramId }, { user: paramId }] });
    }
    if (!invite) {
        const err = new Error("Invitation not found");
        err.statusCode = 404;
        throw err;
    }
    const { church } = await assertChurchPermission(invite.church.toString(), actorId, "canManageInvitations");
    invite.status = "pending";
    invite.invitedBy = new mongoose.Types.ObjectId(actorId);
    await invite.save();
    await createNotification({
        userId: invite.user.toString(),
        actorId,
        title: "Church Invitation",
        body: `You were invited to follow ${church.name}`,
        kind: "church_invite",
        refType: "church",
        refId: invite.church.toString(),
    }).catch(() => null);
    return { message: "Invitation resent successfully" };
}
export async function getChurchRoleLimits(churchId, userId) {
    await assertChurchPermission(churchId, userId, "canEditChurch");
    const activeSub = await UserSubscription.findOne({
        church: churchId,
        status: "Active",
    }).lean();
    const maxAdmins = activeSub ? 10 : 3;
    const maxEditors = activeSub ? 25 : 5;
    const [adminCount, editorCount] = await Promise.all([
        ChurchMember.countDocuments({ church: churchId, role: "admin" }),
        ChurchMember.countDocuments({ church: churchId, role: "editor" }),
    ]);
    return {
        plan: activeSub ? (activeSub.planName || "Premium") : "Standard",
        limits: {
            admins: {
                max: maxAdmins,
                current: adminCount,
                remaining: Math.max(0, maxAdmins - adminCount),
            },
            editors: {
                max: maxEditors,
                current: editorCount,
                remaining: Math.max(0, maxEditors - editorCount),
            },
        },
    };
}
export async function listChurchStaff(churchId, userId) {
    await assertChurchPermission(churchId, userId, "canEditChurch");
    const church = await Church.findById(churchId).lean();
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const members = await ChurchMember.find({
        church: churchId,
        role: { $in: ["owner", "admin", "editor"] },
    })
        .populate("user", "name email avatar")
        .sort({ createdAt: 1 })
        .lean();
    const staffList = members
        .filter((m) => m.user != null)
        .map((m) => ({
        id: m._id.toString(),
        user: {
            id: m.user?._id?.toString() ?? "",
            name: m.user?.name ?? "",
            email: m.user?.email ?? "",
            avatar: m.user?.avatar ?? "",
        },
        role: m.role,
        createdAt: m.createdAt,
    }));
    if (church.createdBy) {
        const creatorId = church.createdBy.toString();
        const hasCreator = staffList.some((s) => s.user.id === creatorId);
        if (!hasCreator) {
            const creatorUser = await User.findById(creatorId).select("name email avatar").lean();
            if (creatorUser) {
                staffList.unshift({
                    id: `creator_${creatorId}`,
                    user: {
                        id: creatorUser._id.toString(),
                        name: creatorUser.name ?? "",
                        email: creatorUser.email ?? "",
                        avatar: creatorUser.avatar ?? "",
                    },
                    role: "owner",
                    createdAt: church.createdAt,
                });
            }
        }
    }
    return { staff: staffList };
}
export async function addChurchStaff(churchId, actorId, body) {
    const role = body.role;
    if (role !== "admin" && role !== "editor") {
        const err = new Error("Role must be 'admin' or 'editor'");
        err.statusCode = 400;
        throw err;
    }
    if (role === "admin") {
        await assertChurchPermission(churchId, actorId, "canManageAdmins");
    }
    else {
        await assertChurchPermission(churchId, actorId, "canManageEditors");
    }
    let targetUserId = body.userId?.trim();
    if (!targetUserId && body.email?.trim()) {
        const u = await User.findOne({ email: body.email.trim().toLowerCase() }).select("_id").lean();
        if (!u) {
            const err = new Error("User not found for that email");
            err.statusCode = 404;
            throw err;
        }
        targetUserId = u._id.toString();
    }
    if (!targetUserId || !mongoose.isValidObjectId(targetUserId)) {
        const err = new Error("Valid userId or email is required");
        err.statusCode = 400;
        throw err;
    }
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (church.createdBy?.toString() === targetUserId) {
        const err = new Error("Cannot assign staff role to the church owner");
        err.statusCode = 400;
        throw err;
    }
    const roleLimits = await getChurchRoleLimits(churchId, actorId);
    const targetLimit = role === "admin" ? roleLimits.limits.admins : roleLimits.limits.editors;
    if (targetLimit.remaining <= 0) {
        const err = new Error(`Staff limit reached for ${role}s under your ${roleLimits.plan} plan. Upgrade to add more staff.`);
        err.statusCode = 403;
        throw err;
    }
    let member = await ChurchMember.findOne({ church: churchId, user: targetUserId });
    if (member) {
        member.role = role;
        await member.save();
    }
    else {
        member = await ChurchMember.create({ church: churchId, user: targetUserId, role });
        church.memberCount = (church.memberCount ?? 0) + 1;
        await church.save();
    }
    const u = await User.findById(targetUserId).select("name email avatar").lean();
    return {
        message: "Staff member added successfully",
        member: {
            id: member._id.toString(),
            user: {
                id: targetUserId,
                name: u?.name ?? "",
                email: u?.email ?? "",
                avatar: u?.avatar ?? "",
            },
            role,
            createdAt: member.createdAt,
        },
    };
}
export async function updateChurchStaffRole(churchId, actorId, targetUserId, role) {
    if (role !== "admin" && role !== "editor") {
        const err = new Error("Role must be 'admin' or 'editor'");
        err.statusCode = 400;
        throw err;
    }
    if (role === "admin") {
        await assertChurchPermission(churchId, actorId, "canManageAdmins");
    }
    else {
        await assertChurchPermission(churchId, actorId, "canManageEditors");
    }
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (church.createdBy?.toString() === targetUserId) {
        const err = new Error("Cannot change role of church owner");
        err.statusCode = 400;
        throw err;
    }
    const member = await ChurchMember.findOne({ church: churchId, user: targetUserId });
    if (!member) {
        const err = new Error("Staff member not found");
        err.statusCode = 404;
        throw err;
    }
    if (member.role !== role && role === "admin") {
        const roleLimits = await getChurchRoleLimits(churchId, actorId);
        if (roleLimits.limits.admins.remaining <= 0) {
            const err = new Error(`Admin limit reached. Upgrade to add more admins.`);
            err.statusCode = 403;
            throw err;
        }
    }
    member.role = role;
    await member.save();
    const u = await User.findById(targetUserId).select("name email avatar").lean();
    return {
        message: "Staff role updated successfully",
        member: {
            id: member._id.toString(),
            user: {
                id: targetUserId,
                name: u?.name ?? "",
                email: u?.email ?? "",
                avatar: u?.avatar ?? "",
            },
            role,
            updatedAt: member.updatedAt,
        },
    };
}
export async function removeChurchStaff(churchId, actorId, targetUserId) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    if (church.createdBy?.toString() === targetUserId) {
        const err = new Error("Cannot remove church owner");
        err.statusCode = 400;
        throw err;
    }
    const member = await ChurchMember.findOne({ church: churchId, user: targetUserId });
    if (!member) {
        const err = new Error("Staff member not found");
        err.statusCode = 404;
        throw err;
    }
    if (member.role === "admin") {
        await assertChurchPermission(churchId, actorId, "canManageAdmins");
    }
    else {
        await assertChurchPermission(churchId, actorId, "canManageEditors");
    }
    await member.deleteOne();
    church.memberCount = Math.max(1, (church.memberCount ?? 1) - 1);
    await church.save();
    return { message: "Staff member removed successfully" };
}
export async function listChurchEvents(churchId, opts = {}) {
    const church = await Church.findById(churchId);
    if (!church) {
        const err = new Error("Church not found");
        err.statusCode = 404;
        throw err;
    }
    const query = { churchId: new mongoose.Types.ObjectId(churchId) };
    const now = new Date();
    if (opts.filter === "upcoming") {
        query.eventDate = { $gte: now };
    }
    else if (opts.filter === "past") {
        query.eventDate = { $lt: now };
    }
    if (opts.status && opts.status !== "all") {
        query.status = new RegExp(`^${opts.status}$`, "i");
    }
    const sortOrder = opts.filter === "past" ? { eventDate: -1 } : { eventDate: 1 };
    const limit = Math.min(100, Math.max(1, opts.limit || 50));
    const page = Math.max(1, opts.page || 1);
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
        ChurchEvent.find(query).sort(sortOrder).skip(skip).limit(limit).lean(),
        ChurchEvent.countDocuments(query),
    ]);
    return {
        events: events.map(mapChurchEvent),
        total,
        page,
        limit,
    };
}
export async function getChurchEvent(churchId, eventId) {
    if (!mongoose.isValidObjectId(eventId)) {
        const err = new Error("Invalid event ID");
        err.statusCode = 400;
        throw err;
    }
    const event = await ChurchEvent.findOne({
        _id: eventId,
        churchId,
    }).lean();
    if (!event) {
        const err = new Error("Event not found");
        err.statusCode = 404;
        throw err;
    }
    return { event: mapChurchEvent(event) };
}
export async function createChurchEvent(churchId, userId, data) {
    const { church } = await assertChurchPermission(churchId, userId, "canManageEvents");
    if (!data?.title?.trim()) {
        const err = new Error("Event title is required");
        err.statusCode = 400;
        throw err;
    }
    const eventDate = data.eventDate ? new Date(data.eventDate) : new Date();
    const eventEndDate = data.eventEndDate ? new Date(data.eventEndDate) : null;
    const doc = await ChurchEvent.create({
        title: data.title.trim(),
        description: data.description?.trim() || "",
        churchId: new mongoose.Types.ObjectId(churchId),
        churchName: church.name,
        createdBy: new mongoose.Types.ObjectId(userId),
        location: data.location?.trim() || "",
        eventDate,
        eventEndDate,
        startTime: data.startTime || "",
        endTime: data.endTime || "",
        timezone: data.timezone || "UTC",
        eventType: data.eventType || (data.type?.toLowerCase() === "physical" ? "in_person" : "in_person"),
        coverImage: data.coverImage || "",
        meetingUrl: data.meetingUrl || "",
        status: data.status || "published",
        type: data.type || (data.eventType === "in_person" ? "Physical" : "Online"),
        maxAttendees: Number(data.maxAttendees) || 0,
        tags: Array.isArray(data.tags) ? data.tags : [],
    });
    void (async () => {
        try {
            const followers = await ChurchFollow.find({ church: churchId }).select("user").lean();
            const followerIds = followers.map((f) => f.user.toString());
            if (followerIds.length > 0) {
                await notifyMany(followerIds, {
                    actorId: userId,
                    title: "New Church Event",
                    body: `${church.name}: ${doc.title}`,
                    kind: "church_event",
                    refType: "church_event",
                    refId: doc._id.toString(),
                });
            }
        }
        catch (e) {
            console.error("Failed to notify followers about church event:", e);
        }
    })();
    return {
        message: "Event created successfully",
        event: mapChurchEvent(doc.toObject()),
    };
}
export async function updateChurchEvent(churchId, eventId, userId, data) {
    await assertChurchPermission(churchId, userId, "canManageEvents");
    if (!mongoose.isValidObjectId(eventId)) {
        const err = new Error("Invalid event ID");
        err.statusCode = 400;
        throw err;
    }
    const event = await ChurchEvent.findOne({ _id: eventId, churchId });
    if (!event) {
        const err = new Error("Event not found");
        err.statusCode = 404;
        throw err;
    }
    if (data.title !== undefined)
        event.title = data.title.trim();
    if (data.description !== undefined)
        event.description = data.description.trim();
    if (data.location !== undefined)
        event.location = data.location.trim();
    if (data.eventDate !== undefined)
        event.eventDate = new Date(data.eventDate);
    if (data.eventEndDate !== undefined)
        event.eventEndDate = data.eventEndDate ? new Date(data.eventEndDate) : null;
    if (data.startTime !== undefined)
        event.startTime = data.startTime;
    if (data.endTime !== undefined)
        event.endTime = data.endTime;
    if (data.timezone !== undefined)
        event.timezone = data.timezone;
    if (data.eventType !== undefined)
        event.eventType = data.eventType;
    if (data.coverImage !== undefined)
        event.coverImage = data.coverImage;
    if (data.meetingUrl !== undefined)
        event.meetingUrl = data.meetingUrl;
    if (data.status !== undefined)
        event.status = data.status;
    if (data.maxAttendees !== undefined)
        event.maxAttendees = Number(data.maxAttendees) || 0;
    if (Array.isArray(data.tags))
        event.tags = data.tags;
    await event.save();
    return {
        message: "Event updated successfully",
        event: mapChurchEvent(event.toObject()),
    };
}
export async function deleteChurchEvent(churchId, eventId, userId) {
    await assertChurchPermission(churchId, userId, "canManageEvents");
    if (!mongoose.isValidObjectId(eventId)) {
        const err = new Error("Invalid event ID");
        err.statusCode = 400;
        throw err;
    }
    const result = await ChurchEvent.deleteOne({ _id: eventId, churchId });
    if (result.deletedCount === 0) {
        const err = new Error("Event not found");
        err.statusCode = 404;
        throw err;
    }
    return { message: "Event deleted successfully" };
}
export async function getLiveStreamSettings(sourceType, sourceId, userId) {
    if (sourceType === "church") {
        const { church } = await getChurchUserRole(sourceId, userId);
        if (!church) {
            const err = new Error("Church not found");
            err.statusCode = 404;
            throw err;
        }
    }
    let doc = await LiveStreamSettings.findOne({
        sourceType,
        sourceId: new mongoose.Types.ObjectId(sourceId),
    }).lean();
    if (!doc) {
        return {
            settings: {
                sourceType,
                sourceId,
                enabled: true,
                allowedRoles: ["owner", "admin"],
                liveChatEnabled: true,
                superChatsEnabled: true,
                donationsEnabled: true,
                reactionsEnabled: true,
                replayEnabled: true,
                moderationEnabled: true,
            },
        };
    }
    return {
        settings: {
            sourceType: doc.sourceType,
            sourceId: doc.sourceId.toString(),
            enabled: doc.enabled,
            allowedRoles: doc.allowedRoles,
            liveChatEnabled: doc.liveChatEnabled,
            superChatsEnabled: doc.superChatsEnabled,
            donationsEnabled: doc.donationsEnabled,
            reactionsEnabled: doc.reactionsEnabled,
            replayEnabled: doc.replayEnabled,
            moderationEnabled: doc.moderationEnabled,
        },
    };
}
export async function updateLiveStreamSettings(sourceType, sourceId, userId, patch) {
    if (sourceType === "church") {
        await assertChurchPermission(sourceId, userId, "canManageLiveStreams");
    }
    const update = {};
    if (typeof patch.enabled === "boolean")
        update.enabled = patch.enabled;
    if (Array.isArray(patch.allowedRoles))
        update.allowedRoles = patch.allowedRoles;
    if (typeof patch.liveChatEnabled === "boolean")
        update.liveChatEnabled = patch.liveChatEnabled;
    if (typeof patch.superChatsEnabled === "boolean")
        update.superChatsEnabled = patch.superChatsEnabled;
    if (typeof patch.donationsEnabled === "boolean")
        update.donationsEnabled = patch.donationsEnabled;
    if (typeof patch.reactionsEnabled === "boolean")
        update.reactionsEnabled = patch.reactionsEnabled;
    if (typeof patch.replayEnabled === "boolean")
        update.replayEnabled = patch.replayEnabled;
    if (typeof patch.moderationEnabled === "boolean")
        update.moderationEnabled = patch.moderationEnabled;
    const doc = await LiveStreamSettings.findOneAndUpdate({ sourceType, sourceId: new mongoose.Types.ObjectId(sourceId) }, { $set: update }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    return {
        message: "Live stream settings updated successfully",
        settings: {
            sourceType: doc.sourceType,
            sourceId: doc.sourceId.toString(),
            enabled: doc.enabled,
            allowedRoles: doc.allowedRoles,
            liveChatEnabled: doc.liveChatEnabled,
            superChatsEnabled: doc.superChatsEnabled,
            donationsEnabled: doc.donationsEnabled,
            reactionsEnabled: doc.reactionsEnabled,
            replayEnabled: doc.replayEnabled,
            moderationEnabled: doc.moderationEnabled,
        },
    };
}
export async function listChurchInvites(churchId, userId, status = "all") {
    await assertChurchManager(churchId, userId);
    const filter = { church: churchId };
    if (status === "pending" || status === "accepted" || status === "rejected") {
        filter.status = status;
    }
    const invites = await ChurchInvite.find(filter)
        .populate("user", "name email avatar")
        .populate("invitedBy", "name avatar")
        .sort({ createdAt: -1 })
        .lean();
    return invites
        .filter((inv) => inv.user != null)
        .map(mapChurchInvite)
        .filter((inv) => inv.user != null);
}
export async function cancelChurchInvite(churchId, userId, targetUserId) {
    return cancelChurchFollowInvite(churchId, userId, targetUserId);
}
export async function acceptChurchInvite(churchId, userId) {
    return acceptChurchFollowInvite(churchId, userId);
}
export async function declineChurchInvite(churchId, userId) {
    return declineChurchFollowInvite(churchId, userId);
}
