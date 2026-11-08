import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Group } from "../models/group.model.js";
import { Church } from "../models/church.model.js";
import { mapPost, mapAuthor } from "../utils/mappers.js";
import { excludedAuthorIds, reactionFlags } from "./posts.service.js";

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export type SearchTypeFilter = "all" | "posts" | "prayers" | "praises" | "people" | "groups" | "churches";

export async function searchAll(params: {
  q: string;
  type?: SearchTypeFilter;
  page?: number;
  limit?: number;
  currentUserId?: string;
}) {
  const q = (params.q || "").trim();
  const typeFilter = params.type || "all";
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  if (!q) {
    return {
      q: "",
      query: "",
      type: typeFilter,
      counts: {
        posts: 0,
        prayers: 0,
        praises: 0,
        people: 0,
        groups: 0,
        churches: 0,
        total: 0,
      },
      posts: [],
      people: [],
      groups: [],
      churches: [],
      results: {
        posts: [],
        people: [],
        groups: [],
        churches: [],
      },
      page,
      limit,
      total: 0,
      totalPages: 1,
    };
  }

  const rx = new RegExp(escapeRegex(q), "i");
  const isValidId = mongoose.isValidObjectId(q);
  const idFilter = isValidId ? { _id: new mongoose.Types.ObjectId(q) } : null;

  // Blocked / excluded users
  const exclude = await excludedAuthorIds(params.currentUserId);

  // Conditions
  const userCond: Record<string, unknown>[] = [
    { name: rx },
    { email: rx },
    { bio: rx },
    { city: rx },
    { state: rx },
  ];
  if (idFilter) userCond.push(idFilter);

  const groupCond: Record<string, unknown>[] = [
    { name: rx },
    { description: rx },
  ];
  if (idFilter) groupCond.push(idFilter);

  const churchCond: Record<string, unknown>[] = [
    { name: rx },
    { description: rx },
    { city: rx },
    { state: rx },
    { streetAddress: rx },
  ];
  if (idFilter) churchCond.push(idFilter);

  // Run searches depending on type filter
  let postsDocs: any[] = [];
  let postsCount = 0;
  let prayerTotal = 0;
  let praiseTotal = 0;

  let peopleDocs: any[] = [];
  let peopleCount = 0;

  let groupDocs: any[] = [];
  let groupsCount = 0;

  let churchDocs: any[] = [];
  let churchesCount = 0;

  if (typeFilter === "all" || typeFilter === "posts" || typeFilter === "prayers" || typeFilter === "praises") {
    // Also match author names
    const matchingUsers = await User.find({
      $or: [{ name: rx }, { email: rx }],
    })
      .select("_id")
      .lean();
    const matchingUserIds = matchingUsers.map((u) => u._id);

    const postOrCond: Record<string, unknown>[] = [{ text: rx }];
    if (matchingUserIds.length) {
      postOrCond.push({ author: { $in: matchingUserIds } });
    }
    if (idFilter) postOrCond.push(idFilter);

    const baseConditions: Record<string, unknown>[] = [
      { moderationStatus: { $ne: "Hidden" } },
      { $or: postOrCond },
    ];
    if (exclude.length) {
      baseConditions.push({ author: { $nin: exclude } });
    }

    const postQuery: Record<string, unknown> = { $and: baseConditions };
    if (typeFilter === "prayers") postQuery.mode = "prayer";
    if (typeFilter === "praises") postQuery.mode = "praise";

    const [totalMatchingPosts, matchingPrayers, matchingPraises, docs] = await Promise.all([
      Post.countDocuments(postQuery),
      Post.countDocuments({ ...postQuery, mode: "prayer" }),
      Post.countDocuments({ ...postQuery, mode: "praise" }),
      Post.find(postQuery)
        .populate("author", "name avatar bio city state country")
        .populate("group", "name image privacy")
        .populate("church", "name image")
        .sort({ createdAt: -1 })
        .skip(typeFilter === "all" ? 0 : skip)
        .limit(limit)
        .lean(),
    ]);

    postsCount = totalMatchingPosts;
    prayerTotal = matchingPrayers;
    praiseTotal = matchingPraises;
    postsDocs = docs;
  }

  if (typeFilter === "all" || typeFilter === "people") {
    const [total, docs] = await Promise.all([
      User.countDocuments({ $or: userCond }),
      User.find({ $or: userCond })
        .select("name email avatar bio city state countFollowers countFollowing role")
        .sort({ createdAt: -1 })
        .skip(typeFilter === "all" ? 0 : skip)
        .limit(limit)
        .lean(),
    ]);
    peopleCount = total;
    peopleDocs = docs;
  }

  if (typeFilter === "all" || typeFilter === "groups") {
    const [total, docs] = await Promise.all([
      Group.countDocuments({ $or: groupCond }),
      Group.find({ $or: groupCond })
        .sort({ createdAt: -1 })
        .skip(typeFilter === "all" ? 0 : skip)
        .limit(limit)
        .lean(),
    ]);
    groupsCount = total;
    groupDocs = docs;
  }

  if (typeFilter === "all" || typeFilter === "churches") {
    const [total, docs] = await Promise.all([
      Church.countDocuments({ $or: churchCond }),
      Church.find({ $or: churchCond })
        .sort({ createdAt: -1 })
        .skip(typeFilter === "all" ? 0 : skip)
        .limit(limit)
        .lean(),
    ]);
    churchesCount = total;
    churchDocs = docs;
  }

  // Filter posts with valid authors and map reaction flags
  const visiblePostDocs = postsDocs.filter((d) => d.author != null);
  const postIds = visiblePostDocs.map((p) => p._id.toString());
  const flags = await reactionFlags(params.currentUserId, postIds);

  const mappedPosts = visiblePostDocs.map((p) => {
    const f = flags.get(p._id.toString()) ?? { pray: false, praise: false, like: false };
    return mapPost(p as never, {
      prayed: f.pray,
      praised: f.praise,
      liked: f.like,
      viewerId: params.currentUserId,
    });
  });

  const mappedPeople = peopleDocs.map((u) => mapAuthor(u));
  const mappedGroups = groupDocs.map((g) => ({
    id: g._id.toString(),
    name: g.name,
    image: g.image || "",
    description: g.description || "",
    memberCount: g.memberCount || 0,
    privacy: g.privacy || "public",
  }));
  const mappedChurches = churchDocs.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    image: c.image || "",
    city: c.city || "",
    state: c.state || "",
    country: c.country || "",
    followerCount: c.followerCount || 0,
    isVerified: !!c.isVerified,
  }));

  const overallTotal = postsCount + peopleCount + groupsCount + churchesCount;
  const activeTotal =
    typeFilter === "posts" || typeFilter === "prayers" || typeFilter === "praises"
      ? postsCount
      : typeFilter === "people"
        ? peopleCount
        : typeFilter === "groups"
          ? groupsCount
          : typeFilter === "churches"
            ? churchesCount
            : overallTotal;

  const totalPages = Math.max(1, Math.ceil(activeTotal / limit));

  return {
    q,
    query: q,
    type: typeFilter,
    page,
    limit,
    total: activeTotal,
    totalPages,
    counts: {
      posts: postsCount,
      prayers: prayerTotal,
      praises: praiseTotal,
      people: peopleCount,
      groups: groupsCount,
      churches: churchesCount,
      total: overallTotal,
    },
    posts: mappedPosts,
    people: mappedPeople,
    groups: mappedGroups,
    churches: mappedChurches,
    results: {
      posts: mappedPosts,
      people: mappedPeople,
      groups: mappedGroups,
      churches: mappedChurches,
    },
  };
}
