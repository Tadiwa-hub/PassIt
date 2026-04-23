import { supabase } from './supabase';

const API_BASE = '/api';

export const api = {
  /**
   * Initiates a Paynow payment
   */
  async initiatePayment({ subjectId, subjectTitle, phone, paymentMethod }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE}/initiate-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ subjectId, subjectTitle, phone, paymentMethod }),
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment initiation failed');
      return data;
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.slice(0, 100)}`);
    }
  },

  /**
   * Polls payment status
   */
  async checkPayment(pollUrl) {
    const response = await fetch(`${API_BASE}/check-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollUrl }),
    });

    const text = await response.text();
    if (!response.ok) throw new Error('Failed to check payment status');
    return new URLSearchParams(text);
  },

  /**
   * Fetches user profile with subscription info
   */
  async getFullProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        user_subscriptions (
          *,
          subjects (*)
        )
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Updates lesson progress
   */
  async updateProgress(lessonId, isCompleted) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        lesson_id: lessonId,
        is_completed: isCompleted,
        last_watched_at: new Date().toISOString()
      }, { onConflict: 'user_id, lesson_id' });

    if (error) throw error;
  }
};
