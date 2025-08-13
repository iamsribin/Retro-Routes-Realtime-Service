import jwt from "jsonwebtoken";
import "dotenv/config";

export interface DecodedToken {
  clientId: string;
  role: string;
}

export class TokenService {
  static verifyAccessToken(token: string): DecodedToken {
    return jwt.verify(
      token,
      process.env.ACCESS_TOKEN || "retro-routes"
    ) as DecodedToken;
  }

  static verifyRefreshToken(token: string): DecodedToken {
    return jwt.verify(
      token,
      process.env.REFRESH_TOKEN || "retro-routes"
    ) as DecodedToken;
  }

  static generateTokens(clientId: string, role: string) {
    const accessToken = jwt.sign(
      { clientId, role },
      process.env.ACCESS_TOKEN || "retro-routes",
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { clientId, role },
      process.env.REFRESH_TOKEN || "retro-routes",
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }
}
