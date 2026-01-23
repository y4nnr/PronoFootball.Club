import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from '../hooks/useTranslation';
import Image from 'next/image';
import { UserIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  profilePictureUrl: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { t } = useTranslation('common');
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userStats, setUserStats] = useState<{
    totalPoints: number;
    totalPredictions: number;
    accuracy: number;
    competitionsWon: number;
  } | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profilePictureMethod, setProfilePictureMethod] = useState<'url' | 'upload'>('url');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setProfile(data);
      setName(data.name);
      setEmail(data.email);
      setProfilePictureUrl(data.profilePictureUrl || '');
      
      // Fetch user stats for display
      try {
        const statsResponse = await fetch('/api/user/dashboard');
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setUserStats({
            totalPoints: statsData.stats?.totalPoints || 0,
            totalPredictions: statsData.stats?.totalPredictions || 0,
            accuracy: statsData.stats?.accuracy || 0,
            competitionsWon: statsData.stats?.competitionsWon || 0,
          });
        }
      } catch (statsError) {
        console.error('Error fetching stats:', statsError);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setErrorMessage(t('profile.messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error(t('profile.messages.fileTooLarge'));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result.length > 500000) { // ~500KB base64 limit
          reject(new Error('Processed image is too large. Please use a smaller image or URL instead.'));
        } else {
          resolve(result);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleSave = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    
    if (!name || !email) {
      setErrorMessage(t('profile.messages.nameEmailRequired'));
      return;
    }
    
    // Validate passwords if they are provided
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setErrorMessage('Les mots de passe ne correspondent pas');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
    }
    
    setSaving(true);
    
    try {
      let finalProfilePictureUrl = profilePictureUrl;
      
      // Handle file upload if upload method is selected
      if (profilePictureMethod === 'upload' && selectedFile) {
        try {
          finalProfilePictureUrl = await uploadFile(selectedFile);
        } catch (uploadError: unknown) {
          const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
          setErrorMessage(message || t('profile.messages.uploadError'));
          setSaving(false);
          return;
        }
      }
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          password: password || undefined,
          profilePictureUrl: finalProfilePictureUrl 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setPassword(''); // Clear password field
      setConfirmPassword(''); // Clear confirm password field
      setSelectedFile(null);
      setPreviewUrl('');
      setEditing(false);
      setSuccessMessage(t('profile.messages.updateSuccess'));
      
      // Update the session with new user data including profile picture
      await update({
        ...session,
        user: {
          ...session?.user,
          name: updatedProfile.name,
          email: updatedProfile.email,
          profilePictureUrl: finalProfilePictureUrl || null
        }
      });
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message || t('profile.messages.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setProfilePictureUrl(profile.profilePictureUrl || '');
    }
    setPassword('');
    setConfirmPassword('');
    setSelectedFile(null);
    setPreviewUrl('');
    setErrorMessage('');
    setSuccessMessage('');
    setEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        setErrorMessage(t('profile.messages.fileTooLarge'));
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setErrorMessage('');
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-xl text-neutral-700 dark:text-gray-300">{t('dashboard.loading') || 'Loading...'}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-xl text-red-600 dark:text-red-400">{t('profile.messages.loadError')}</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-20 md:pb-8">
      <div className="max-w-7xl mx-auto pt-8 px-4 sm:px-6 lg:px-8">
        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 dark:border-green-400 rounded-lg shadow-sm">
            <p className="text-green-800 dark:text-green-300 font-medium">{successMessage}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400 rounded-lg shadow-sm">
            <p className="text-red-800 dark:text-red-300 font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Edit Button - Centered */}
        {!editing && (
          <div className="flex justify-center mb-4">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition-all duration-200 shadow-md font-medium"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Modifier le profil
            </button>
          </div>
        )}

        {/* Profile Header Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
          <div className="px-8 py-6">
            {/* User Name and Info */}
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{profile.name}</h1>
              <div className="flex items-center space-x-4 text-gray-600 dark:text-gray-400">
                <span className="text-sm">{profile.email}</span>
                <span className="text-gray-400 dark:text-gray-500">•</span>
                <span className="text-sm capitalize">{profile.role}</span>
                <span className="text-gray-400 dark:text-gray-500">•</span>
                <span className="text-sm">
                  Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR', { 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Row */}
        {!editing && userStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-primary-600 dark:text-accent-dark-400 mb-1">{userStats.totalPoints}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Points totaux</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-primary-600 dark:text-accent-dark-400 mb-1">{userStats.totalPredictions}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pronostics</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-primary-600 dark:text-accent-dark-400 mb-1">{userStats.accuracy.toFixed(1)}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Précision</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 text-center">
              <div className="text-xl md:text-2xl lg:text-3xl font-bold text-primary-600 dark:text-accent-dark-400 mb-1">{userStats.competitionsWon}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Compétitions gagnées</div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile Information */}
          <div className="lg:col-span-2">
            {!editing ? (
              /* View Mode - Timeline/About Section */
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">À propos</h2>
                </div>
                <div className="px-6 py-6">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Nom complet</div>
                      <div className="text-gray-900 dark:text-gray-100">{profile.name}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Adresse e-mail</div>
                      <div className="text-gray-900 dark:text-gray-100">{profile.email}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Rôle</div>
                      <div className="text-gray-900 dark:text-gray-100 capitalize">{profile.role}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Membre depuis</div>
                      <div className="text-gray-900 dark:text-gray-100">
                        {new Date(profile.createdAt).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Modifier le profil</h2>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 shadow-sm font-medium"
                      >
                        <XMarkIcon className="h-4 w-4 mr-2" />
                        {t('profile.cancel') || 'Annuler'}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 dark:bg-accent-dark-600 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-accent-dark-700 transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md font-medium"
                      >
                        <CheckIcon className="h-4 w-4 mr-2" />
                        {saving ? (t('profile.saving') || 'Enregistrement...') : (t('profile.saveChanges') || 'Enregistrer')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 space-y-6">
                  {/* Personal Information Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">Informations personnelles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.fullName') || 'Nom complet'} <span className="text-red-500 dark:text-red-400">*</span></label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
                        placeholder={t('profile.placeholders.fullName') || 'Entrez votre nom complet'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.emailAddress') || 'Adresse e-mail'} <span className="text-red-500 dark:text-red-400">*</span></label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200"
                        placeholder={t('profile.placeholders.email') || 'Entrez votre e-mail'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.role') || 'Rôle'}</label>
                      <input
                        type="text"
                        value={profile.role}
                        disabled
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 capitalize cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('profile.helpText.role') || 'Le rôle ne peut pas être modifié'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.memberSince') || 'Membre depuis'}</label>
                      <input
                        type="text"
                        value={new Date(profile.createdAt).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                        disabled
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Security Section */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">Sécurité</h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('profile.newPassword') || 'Nouveau mot de passe'}</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 ${
                          password && confirmPassword && password !== confirmPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder={t('profile.placeholders.password') || 'Entrez votre nouveau mot de passe'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirmer le mot de passe</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 ${
                          password && confirmPassword && password !== confirmPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="Confirmez votre nouveau mot de passe"
                      />
                      {password && confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Les mots de passe ne correspondent pas</p>
                      )}
                      {password && confirmPassword && password === confirmPassword && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Les mots de passe correspondent</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.helpText.password') || 'Laissez vide pour conserver votre mot de passe actuel'}</p>
                  </div>
                </div>

                {/* Profile Picture Section */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">{t('profile.profilePicture') || 'Photo de profil'}</h3>
                  
                  {/* Method Selection */}
                  <div className="flex space-x-6 mb-4">
                    <label className="flex items-center text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        value="url"
                        checked={profilePictureMethod === 'url'}
                        onChange={(e) => setProfilePictureMethod(e.target.value as 'url' | 'upload')}
                        className="mr-2 text-primary-600 dark:text-accent-dark-500 focus:ring-primary-500 dark:focus:ring-accent-dark-500"
                      />
                      {t('profile.useUrl') || 'Utiliser une URL'}
                    </label>
                    <label className="flex items-center text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        value="upload"
                        checked={profilePictureMethod === 'upload'}
                        onChange={(e) => setProfilePictureMethod(e.target.value as 'url' | 'upload')}
                        className="mr-2 text-primary-600 dark:text-accent-dark-500 focus:ring-primary-500 dark:focus:ring-accent-dark-500"
                      />
                      {t('profile.uploadFile') || 'Téléverser un fichier'}
                    </label>
                  </div>

                  {profilePictureMethod === 'url' && (
                    <div>
                      <input
                        type="url"
                        value={profilePictureUrl}
                        onChange={(e) => setProfilePictureUrl(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-accent-dark-500 focus:border-primary-500 dark:focus:border-accent-dark-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        placeholder={t('profile.placeholders.profileUrl') || 'https://example.com/image.jpg'}
                      />
                    </div>
                  )}

                  {profilePictureMethod === 'upload' && (
                    <div>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors bg-gray-50 dark:bg-gray-900/30">
                        <div className="space-y-1 text-center">
                          {!selectedFile ? (
                            <>
                              <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                                <label className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-primary-600 dark:text-accent-dark-400 hover:text-primary-500 dark:hover:text-accent-dark-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500 dark:focus-within:ring-accent-dark-500">
                                  <span>{t('profile.uploadFileText') || 'Téléverser un fichier'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="sr-only"
                                  />
                                </label>
                                <p className="pl-1">{t('profile.dragDrop') || 'ou glisser-déposer'}</p>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t('profile.fileTypes') || 'PNG, JPG, GIF jusqu\'à 2MB'}</p>
                            </>
                          ) : (
                            <div className="space-y-2">
                              {previewUrl && (
                                <Image
                                  src={previewUrl}
                                  alt="Preview"
                                  className="mx-auto h-20 w-20 rounded-full object-cover"
                                  width={80}
                                  height={80}
                                  unoptimized
                                />
                              )}
                              <p className="text-sm text-gray-800 dark:text-gray-200">{selectedFile.name}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPreviewUrl('');
                                }}
                                className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300"
                              >
                                {t('profile.remove') || 'Supprimer'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar (for future content) */}
          <div className="lg:col-span-1">
            {!editing && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Statistiques</h2>
                </div>
                <div className="px-6 py-6">
                  {userStats ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Points totaux</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{userStats.totalPoints}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Pronostics</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{userStats.totalPredictions}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Précision</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{userStats.accuracy.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Compétitions gagnées</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{userStats.competitionsWon}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 dark:text-gray-400 text-sm">Chargement des statistiques...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

