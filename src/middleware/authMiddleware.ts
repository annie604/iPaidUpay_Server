import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

export interface AuthRequest extends Request {
    user?: {
        userId: number;
        username: string;
        iat: number;
        exp: number;
    };
}

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    // EXPECTED HEADER: "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        res.sendStatus(401);
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            res.sendStatus(403);
            return;
        }
        (req as AuthRequest).user = user as any; // user payload: { userId, username, iat, exp }
        next();
    });
};

export default authenticateToken;
