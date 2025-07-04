import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Announcement } from '../components/AnnouncementModal';

export const useAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [shownAnnouncements, setShownAnnouncements] = useState<Set<string>>(new Set());

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const activeAnnouncements = (data || []).filter(announcement => {
        // Check if announcement has expired
        if (announcement.expires_at) {
          const expiresAt = new Date(announcement.expires_at).getTime();
          const now = new Date().getTime();
          return now < expiresAt;
        }
        return true;
      });

      setAnnouncements(activeAnnouncements);

      // Show the latest announcement that hasn't been shown yet
      const latestAnnouncement = activeAnnouncements.find(
        announcement => !shownAnnouncements.has(announcement.id)
      );

      if (latestAnnouncement && !currentAnnouncement) {
        setCurrentAnnouncement(latestAnnouncement);
        setShownAnnouncements(prev => new Set([...prev, latestAnnouncement.id]));
      }
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  }, [shownAnnouncements, currentAnnouncement]);

  const dismissAnnouncement = useCallback(() => {
    setCurrentAnnouncement(null);
  }, []);

  const markAnnouncementAsRead = useCallback(async (announcementId: string) => {
    try {
      // In a real app, you might want to track which users have seen which announcements
      // For now, we'll just mark it as shown locally
      setShownAnnouncements(prev => new Set([...prev, announcementId]));
    } catch (error) {
      console.error('Error marking announcement as read:', error);
    }
  }, []);

  useEffect(() => {
    // Load initial announcements
    loadAnnouncements();

    // Set up real-time subscription for new announcements with a unique channel name
    const channelName = `announcements_${Date.now()}_${Math.random()}`;
    
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'announcements',
          filter: 'is_active=eq.true'
        },
        (payload) => {
          console.log('New announcement received:', payload);
          const newAnnouncement = payload.new as Announcement;
          
          // Add to announcements list
          setAnnouncements(prev => [newAnnouncement, ...prev]);
          
          // Show new announcement immediately if no announcement is currently showing
          if (!currentAnnouncement && !shownAnnouncements.has(newAnnouncement.id)) {
            console.log('Showing new announcement:', newAnnouncement.title);
            setCurrentAnnouncement(newAnnouncement);
            setShownAnnouncements(prev => new Set([...prev, newAnnouncement.id]));
          }
        }
      )
      .on('postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'announcements' 
        },
        (payload) => {
          console.log('Announcement updated:', payload);
          loadAnnouncements();
        }
      )
      .on('postgres_changes',
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'announcements' 
        },
        (payload) => {
          console.log('Announcement deleted:', payload);
          loadAnnouncements();
        }
      )
      .subscribe((status) => {
        console.log('Announcements subscription status:', status);
      });

    // Clean up expired announcements every 30 seconds
    const cleanupInterval = setInterval(() => {
      const now = new Date().getTime();
      
      setAnnouncements(prev => prev.filter(announcement => {
        if (announcement.expires_at) {
          const expiresAt = new Date(announcement.expires_at).getTime();
          return now < expiresAt;
        }
        return true;
      }));

      // Close current announcement if it has expired
      if (currentAnnouncement?.expires_at) {
        const expiresAt = new Date(currentAnnouncement.expires_at).getTime();
        if (now >= expiresAt) {
          setCurrentAnnouncement(null);
        }
      }
    }, 30000);

    // Also check for new announcements every 10 seconds as a fallback
    const pollInterval = setInterval(() => {
      loadAnnouncements();
    }, 10000);

    return () => {
      console.log('Cleaning up announcements subscription');
      supabase.removeChannel(subscription);
      clearInterval(cleanupInterval);
      clearInterval(pollInterval);
    };
  }, []); // Remove dependencies to prevent recreation

  // Separate effect to handle showing announcements when current one is dismissed
  useEffect(() => {
    if (!currentAnnouncement) {
      // Find next announcement to show
      const nextAnnouncement = announcements.find(
        announcement => !shownAnnouncements.has(announcement.id)
      );
      
      if (nextAnnouncement) {
        setTimeout(() => {
          setCurrentAnnouncement(nextAnnouncement);
          setShownAnnouncements(prev => new Set([...prev, nextAnnouncement.id]));
        }, 1000); // Small delay before showing next announcement
      }
    }
  }, [currentAnnouncement, announcements, shownAnnouncements]);

  return {
    announcements,
    currentAnnouncement,
    dismissAnnouncement,
    markAnnouncementAsRead,
    loadAnnouncements
  };
};