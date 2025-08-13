import jwt from "jsonwebtoken";
import { Socket } from "socket.io";
import { TokenService } from "../utils/token-service";

interface DecodedToken {
  clientId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedSocket extends Socket {
  decoded?: DecodedToken;
} 

export const authenticateSocket = async (
  socket: AuthenticatedSocket, 
  next: (err?: Error) => void
) => {
  try {
    const { token, refreshToken } = socket.handshake.query as { 
      token?: string; 
      refreshToken?: string; 
    };
    
    console.log('Authentication attempt:', { 
      hasToken: !!token, 
      hasRefreshToken: !!refreshToken,
      socketId: socket.id 
    });

    if (!token) {
      console.log('No auth token provided');
      return next(new Error("NO_AUTH_TOKEN"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
      socket.decoded = decoded;
      console.log(`Successfully authenticated ${decoded.role}: ${decoded.clientId}`);
      return next();
    } catch (tokenError) {
      console.log('Main token verification failed:', tokenError.message);
      
      if (refreshToken) {
        try {
          const newTokens = verifyRefreshToken(refreshToken);
          socket.emit('token_refreshed', newTokens);
          
          const decoded = jwt.verify(newTokens.accessToken, process.env.JWT_SECRET as string) as DecodedToken;
          socket.decoded = decoded;
          console.log(`Token refreshed and authenticated ${decoded.role}: ${decoded.clientId}`);
          return next();
        } catch (refreshError) {
          console.log('Refresh token verification failed:', refreshError.message);
          return next(new Error("INVALID_REFRESH_TOKEN"));
        }
      }
      
      return next(new Error("INVALID_TOKEN"));
    }
  } catch (err) {
    console.error('Socket authentication error:', err);
    return next(new Error("AUTHENTICATION_FAILED"));
  }
};

const verifyRefreshToken = (
  refreshToken: string
): { accessToken: string; refreshToken: string } => {
  try {
    const decoded = TokenService.verifyRefreshToken(refreshToken);
    return TokenService.generateTokens(decoded.clientId, decoded.role);
  } catch (error) {
    throw new Error("Invalid refresh token");
  }
};