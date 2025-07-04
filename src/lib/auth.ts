import { supabase } from './supabase';

export const createAdminUser = async () => {
  try {
    // Call the edge function to create admin user
    const { data, error } = await supabase.functions.invoke('admin-auth', {
      body: { action: 'create' }
    });

    if (error) {
      console.error('Error creating admin user:', error);
      return false;
    }

    return data?.success || false;
  } catch (error) {
    console.error('Error in createAdminUser:', error);
    return false;
  }
};

export const signInAdmin = async (username: string, password: string) => {
  try {
    // Call the edge function to verify admin credentials
    const { data, error } = await supabase.functions.invoke('admin-auth', {
      body: { 
        action: 'login',
        username,
        password
      }
    });

    if (error) {
      console.error('Admin sign in error:', error);
      return false;
    }

    // If credentials are valid, sign in with Supabase auth
    if (data?.valid) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: password
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        return false;
      }

      return authData.user !== null;
    }

    return false;
  } catch (error) {
    console.error('Error in signInAdmin:', error);
    return false;
  }
};

export const signOutAdmin = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Admin sign out error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in signOutAdmin:', error);
    return false;
  }
};

export const getCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};