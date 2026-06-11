import * as subscriptionService from "../services/subscription.service.js";
export const getStatus = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const subscription = await subscriptionService.getSubscriptionStatus(req.userId);
        return res.json({ subscription });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
export const subscribe = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const subscription = await subscriptionService.subscribeStub(req.userId);
        return res.json({ subscription });
    }
    catch (err) {
        const e = err;
        return res.status(e.statusCode ?? 500).json({ message: e.message });
    }
};
