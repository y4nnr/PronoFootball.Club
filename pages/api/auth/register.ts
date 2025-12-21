import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, password, confirmPassword } = req.body;

  // Validation
  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingEmail) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Check if username already exists in the username field
  if (username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return res.status(400).json({ error: 'Username already taken' });
    }
  }

  // Check if the name (username) already exists - this is the main login field
  const existingName = await prisma.user.findFirst({
    where: {
      name: { equals: username, mode: 'insensitive' }
    }
  });

  if (existingName) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a profile picture URL using the email as seed
    // This ensures each user gets a unique but consistent avatar
    // Using pravatar.cc which generates avatars based on a seed
    const profilePictureUrl = `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;

    // Create user (inactive by default)
    // Use username as name since we don't have firstName anymore
    const user = await prisma.user.create({
      data: {
        name: username,
        username: username,
        email,
        hashedPassword,
        isActive: false, // User must be activated by admin
        role: 'user',
        profilePictureUrl, // Assign random profile picture
      },
    });

    console.log('[REGISTER] User created with profile picture:', {
      email: user.email,
      profilePictureUrl: user.profilePictureUrl
    });

    return res.status(201).json({ 
      message: 'Account created successfully. Please wait for admin approval before logging in.',
      userId: user.id
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

