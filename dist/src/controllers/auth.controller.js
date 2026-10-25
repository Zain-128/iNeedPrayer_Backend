import * as authService from "../services/auth.service.js";
export const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({
                message: "Please provide email, password, and name",
            });
        }
        const result = await authService.register({ email, password, name });
        return res.status(201).json(result);
    }
    catch (err) {
        const e = err;
        const status = e.statusCode ?? 500;
        return res.status(status).json({ message: e.message ?? "Registration failed" });
    }
};
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                message: "Please provide email and password",
            });
        }
        const result = await authService.login({ email, password });
        return res.status(200).json(result);
    }
    catch (err) {
        const e = err;
        const status = e.statusCode ?? 500;
        return res.status(status).json({ message: e.message ?? "Login failed" });
    }
};
export const getMe = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const user = await authService.getMe(req.userId);
        return res.status(200).json({ user });
    }
    catch (err) {
        const e = err;
        const status = e.statusCode ?? 500;
        return res.status(status).json({ message: e.message ?? "Failed to get user" });
    }
};
