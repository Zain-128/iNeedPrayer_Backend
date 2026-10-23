import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";
import { Group } from "../models/group.model.js";
import { Church } from "../models/church.model.js";
import { mapPost, mapAuthor } from "../utils/mappers.js";

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
      query: "",
      counts: {
        posts: 0,
        prayers: 0,
        praises: 0,
        people: 0,
        groups: 0,
        churches: 0,
        total: 0,
      },
      results: {
        posts: [],
        people: [],
        groups: [],
        churches: [],
      },
      page,
      limit,
    };
  }

  const rx = new RegExp(escapeRegex(q), "i");
  const isValidId = mongoose.isValidObjectId(q);
  const idFilter = isValidId ? { _id: new mongoose.Types.ObjectId(q) } : null;

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

  const postCondText: Record<string, unknown>[] = [{ text: rx }];
  if (idFilter) postCondText.push(idFilter);

  // Run searches depending on type filter
  let postsDocs: any[] = [];
  let postsCount = 0;
  let prayersCount = 0;
  let praisesCount = 0;

  let peopleDocs: any[] = [];
  let peopleCount = 0;

  let groupDocs: any[] = [];
  let groupsCount = 0;

  let churchDocs: any[] = [];
  let churchesCount = 0;

  if (typeFilter === "all" || typeFilter === "posts" || typeFilter === "prayers" || typeFilter === "praises") {
    const postQuery: Record<string, unknown> = { $or: postCondText };
    if (typeFilter === "prayers") postQuery.mode = "prayer";
    if (typeFilter === "praises") postQuery.mode = "praise";

    const [totalPosts, prayerTotal, praiseTotal, docs] = await Promise.all([
      Post.countDocuments({ $or: postCondText }),
      Post.countDocuments({ $or: postCondText, mode: "prayer" }),
      Post.countDocuments({ $or: postCondText, mode: "praise" }),
      Post.find(postQuery)
        .populate("author", "name avatar bio city state")
        .sort({ createdAt: -1 })
        .skip(typeFilter === "all" ? 0 : skip)
        .limit(typeFilter === "all" ? limit : limit)
        .lean(),
    ]);

    postsCount = totalPosts;
    prayersCount = prayerTotal;
    praisesCount = praiseTotal;
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

  const mappedPosts = postsDocs.map((p) => mapPost(p, { viewerId: params.currentUserId }));
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

  const total = postsCount + peopleCount + groupsCount + churchesCount;

  return {
    query: q,
    counts: {
      posts: postsCount,
      prayers: prayersCount,
      praises: praisesCount,
      people: peopleCount,
      groups: groupsCount,
      churches: churchesCount,
      total,
    },
    results: {
      posts: mappedPosts,
      people: mappedPeople,
      groups: mappedGroups,
      churches: mappedChurches,
    },
    page,
    limit,
  };
}
