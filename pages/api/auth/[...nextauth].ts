import NextAuth from "next-auth";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

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
          console.error('[AUTH] Missing credentials');
          throw new Error("Missing credentials");
        }

        // Try to find user by email or name (case-insensitive)
        // Note: 'name' is the username field that existing users use (e.g., "Yann", "Fifi")
        // The new 'username' field is optional and can be used as an alias
        const searchTerm = credentials.emailOrUsername;
        console.log('[AUTH] Attempting login with:', searchTerm);
        
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
          console.log('[AUTH] User not found by email/name, trying username field');
          user = await prisma.user.findFirst({
            where: {
              username: { equals: searchTerm, mode: 'insensitive' }
            }
          });
        }

        if (!user) {
          console.error('[AUTH] No user found for:', searchTerm);
          // Let's also check what users exist in the database for debugging
          const allUsers = await prisma.user.findMany({
            select: { email: true, name: true, username: true, isActive: true }
          });
          console.log('[AUTH] Available users in DB:', allUsers);
          throw new Error("No user found");
        }

        console.log('[AUTH] User found:', {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
          isActive: user.isActive
        });

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          console.error('[AUTH] Invalid password for user:', user.email);
          throw new Error("Invalid password");
        }

        console.log('[AUTH] Password valid, checking activation status...');

        // Check if user is active (unless admin)
        // For existing users created before isActive was added, allow login if isActive is null/undefined
        // Only block if isActive is explicitly false
        if (user.role.toLowerCase() !== 'admin' && user.isActive === false) {
          console.error('[AUTH] Account not active for user:', user.email, 'isActive:', user.isActive);
          throw new Error("Account is pending admin approval. Please wait for activation.");
        }
        
        console.log('[AUTH] Authentication successful for user:', user.email, 'isActive:', user.isActive);

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
          console.log('[SESSION] Fetching profile picture for user:', user?.email, 'profilePictureUrl:', user?.profilePictureUrl);
          session.user.profilePictureUrl = user?.profilePictureUrl || null;
        } catch (error) {
          console.error('[SESSION] Error fetching profile picture in session callback:', error);
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

