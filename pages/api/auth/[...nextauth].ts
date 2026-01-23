import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import log from "../../../lib/logger";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      image: string | null;
      profilePictureUrl: string | null;
    };
  }
  
  interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    image: string | null;
    profilePictureUrl: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        emailOrUsername: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.emailOrUsername || !credentials?.password) {
          log.warn('Authentication attempt with missing credentials');
          throw new Error("Missing credentials");
        }

        // Try to find user by email or name (case-insensitive)
        // Note: 'name' is the username field that existing users use (e.g., "Yann", "Fifi")
        // The new 'username' field is optional and can be used as an alias
        const searchTerm = credentials.emailOrUsername;
        log.debug('Authentication attempt', { searchTerm });
        
        // First try by email (case-insensitive) or name (case-insensitive)
        // Note: For email, we need to use a case-insensitive search
        // However, Prisma's case-insensitive mode might not work for all databases
        // So we'll try both exact match and case-insensitive
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: searchTerm }, // Try exact match first (faster)
              { email: { equals: searchTerm, mode: 'insensitive' } }, // Then case-insensitive
              { name: { equals: searchTerm, mode: 'insensitive' } }
            ]
          }
        });
        
        // If not found, also check the optional username field
        if (!user && searchTerm) {
          log.debug('User not found by email/name, trying username field', { searchTerm });
          user = await prisma.user.findFirst({
            where: {
              username: { equals: searchTerm, mode: 'insensitive' }
            }
          });
        }

        if (!user) {
          log.warn('Authentication failed: user not found', { searchTerm });
          throw new Error("No user found");
        }

        log.debug('User found for authentication', {
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive
        });

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          log.warn('Authentication failed: invalid password', { userId: user.id, email: user.email });
          throw new Error("Invalid password");
        }

        log.debug('Password validated, checking activation status', { userId: user.id });

        // Check if user is active (unless admin)
        // For existing users created before isActive was added, allow login if isActive is null/undefined
        // Only block if isActive is explicitly false
        if (user.role.toLowerCase() !== 'admin' && user.isActive === false) {
          log.warn('Authentication failed: account not active', { userId: user.id, email: user.email });
          throw new Error("Account is pending admin approval. Please wait for activation.");
        }
        
        log.info('Authentication successful', { userId: user.id, email: user.email, role: user.role });

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? '',
          role: user.role,
          image: null,
          // Don't store profilePictureUrl in token to avoid cookie size issues
          // Will be fetched in session callback instead
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        // Don't store profilePictureUrl in token to avoid cookie size issues
        // Remove it if it exists (from old tokens)
        if (token.profilePictureUrl) {
          delete token.profilePictureUrl;
        }
      } else {
        // Clean up profilePictureUrl from existing tokens to reduce cookie size
        if (token.profilePictureUrl) {
          delete token.profilePictureUrl;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.image = null;
        // Always fetch profilePictureUrl from DB to avoid storing long URLs in cookies
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { profilePictureUrl: true, email: true }
          });
          log.debug('Fetched profile picture in session callback', { userId: token.id, hasProfilePicture: !!user?.profilePictureUrl });
          session.user.profilePictureUrl = user?.profilePictureUrl || null;
        } catch (error) {
          log.error('Error fetching profile picture in session callback', error, { userId: token.id });
          session.user.profilePictureUrl = null;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);

