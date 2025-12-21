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
          throw new Error("Missing credentials");
        }

        // Try to find user by email or username (case-insensitive)
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.emailOrUsername },
              { name: { equals: credentials.emailOrUsername, mode: 'insensitive' } }
            ]
          }
        });

        if (!user) {
          throw new Error("No user found");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

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
            select: { profilePictureUrl: true }
          });
          session.user.profilePictureUrl = user?.profilePictureUrl || null;
        } catch (error) {
          console.error('Error fetching profile picture in session callback:', error);
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

