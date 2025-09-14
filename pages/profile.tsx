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
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      setSelectedFile(null);
      setPreviewUrl('');
      setEditing(false);
      setSuccessMessage(t('profile.messages.updateSuccess'));
      
      // Update the session with new user data
      await update({
        ...session,
        user: {
          ...session?.user,
          name: updatedProfile.name,
          email: updatedProfile.email
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
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-xl text-neutral-700">{t('dashboard.loading') || 'Loading...'}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
        <div className="text-xl text-red-600">{t('profile.messages.loadError')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-primary-500 rounded-xl shadow-modern">
              <UserIcon className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold gradient-text-profile">
              {t('profile.title') || 'My Profile'}
            </h1>
          </div>
          <p className="subtitle-text">
            {t('profile.subtitle') || 'Manage your personal information and account settings'}
          </p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 bg-gradient-to-br from-accent-50 to-accent-100 border border-accent-200/50 rounded-2xl shadow-modern">
            <p className="text-accent-800">{successMessage}</p>
          </div>
        )}
        
        {errorMessage && (
          <div className="mb-6 p-4 bg-gradient-to-br from-warm-50 to-warm-100 border border-warm-200/50 rounded-2xl shadow-modern">
            <p className="text-warm-800">{errorMessage}</p>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-white shadow-modern-lg rounded-2xl overflow-hidden border border-neutral-200/50">
          {/* Profile Header */}
          <div className="bg-gradient-hero px-6 py-8">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Image
                  src={profile.profilePictureUrl || "https://i.pravatar.cc/150"}
                  alt="Profile"
                  className="h-24 w-24 rounded-full border-4 border-white shadow-modern object-cover"
                  width={96}
                  height={96}
                />
                {editing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <PencilIcon className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>
              <div className="text-white">
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                <p className="text-primary-100">{profile.email}</p>
                <p className="text-primary-200 text-sm capitalize">{profile.role}</p>
              </div>
            </div>
          </div>

          {/* Profile Content */}
          <div className="px-6 py-6">
            {!editing ? (
              /* View Mode */
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900">{t('profile.information')}</h3>
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all duration-200 shadow-modern hover:shadow-modern-lg hover:scale-105"
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    {t('profile.editProfile')}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.fullName')}</label>
                    <p className="text-neutral-900 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200/50">{profile.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.emailAddress')}</label>
                    <p className="text-neutral-900 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200/50">{profile.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.role')}</label>
                    <p className="text-neutral-900 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200/50 capitalize">{profile.role}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.memberSince')}</label>
                    <p className="text-neutral-900 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200/50">
                      {new Date(profile.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900">{t('profile.editMode')}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 bg-neutral-600 text-white rounded-xl hover:bg-neutral-700 transition-all duration-200 disabled:opacity-50 shadow-modern"
                    >
                      <XMarkIcon className="h-4 w-4 mr-2" />
                      {t('profile.cancel')}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 bg-accent-600 text-white rounded-xl hover:bg-accent-700 transition-all duration-200 disabled:opacity-50 shadow-modern hover:shadow-modern-lg hover:scale-105"
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      {saving ? t('profile.saving') : t('profile.saveChanges')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.fullName')} *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-neutral-900 transition-all duration-200"
                      placeholder={t('profile.placeholders.fullName')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.emailAddress')} *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-neutral-900 transition-all duration-200"
                      placeholder={t('profile.placeholders.email')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.newPassword')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-neutral-900 transition-all duration-200"
                      placeholder={t('profile.placeholders.password')}
                    />
                    <p className="text-xs text-neutral-700 mt-1">{t('profile.helpText.password')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-800 mb-1">{t('profile.role')}</label>
                    <input
                      type="text"
                      value={profile.role}
                      disabled
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl bg-neutral-100 text-neutral-600 capitalize"
                    />
                    <p className="text-xs text-neutral-700 mt-1">{t('profile.helpText.role')}</p>
                  </div>
                </div>

                {/* Profile Picture Section */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-neutral-800 mb-3">{t('profile.profilePicture')}</label>
                  
                  {/* Method Selection */}
                  <div className="flex space-x-4 mb-4">
                    <label className="flex items-center text-neutral-800">
                      <input
                        type="radio"
                        value="url"
                        checked={profilePictureMethod === 'url'}
                        onChange={(e) => setProfilePictureMethod(e.target.value as 'url' | 'upload')}
                        className="mr-2"
                      />
                      {t('profile.useUrl')}
                    </label>
                    <label className="flex items-center text-neutral-800">
                      <input
                        type="radio"
                        value="upload"
                        checked={profilePictureMethod === 'upload'}
                        onChange={(e) => setProfilePictureMethod(e.target.value as 'url' | 'upload')}
                        className="mr-2"
                      />
                      {t('profile.uploadFile')}
                    </label>
                  </div>

                  {profilePictureMethod === 'url' && (
                    <div>
                      <input
                        type="url"
                        value={profilePictureUrl}
                        onChange={(e) => setProfilePictureUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-neutral-900"
                        placeholder={t('profile.placeholders.profileUrl')}
                      />
                    </div>
                  )}

                  {profilePictureMethod === 'upload' && (
                    <div>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-neutral-300 border-dashed rounded-md hover:border-neutral-400 transition-colors">
                        <div className="space-y-1 text-center">
                          {!selectedFile ? (
                            <>
                              <svg className="mx-auto h-12 w-12 text-neutral-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <div className="flex text-sm text-neutral-600">
                                <label className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                                  <span>{t('profile.uploadFileText')}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="sr-only"
                                  />
                                </label>
                                <p className="pl-1">{t('profile.dragDrop')}</p>
                              </div>
                              <p className="text-xs text-neutral-700">{t('profile.fileTypes')}</p>
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
                                />
                              )}
                              <p className="text-sm text-neutral-800">{selectedFile.name}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPreviewUrl('');
                                }}
                                className="text-sm text-red-600 hover:text-red-500"
                              >
                                {t('profile.remove')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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

