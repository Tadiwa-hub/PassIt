import { supabase } from './supabase';

const API_BASE = '/api';

export const api = {
  /**
   * Initiates a Paynow payment
   */
  async initiatePayment({ subjectId, subjectTitle, phone, paymentMethod }) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('initiate-payment', {
      body: { 
        subjectId, 
        subjectTitle, 
        phone, 
        paymentMethod,
        userId: session.user.id,
        userEmail: session.user.email
      }
    });

    if (error) {
      // Try to extract the actual error message from the response
      let errorMsg = error.message || 'Payment initiation failed';
      
      // The error context may contain the response body with details
      if (error.context && typeof error.context.json === 'function') {
        try {
          const errBody = await error.context.json();
          errorMsg = errBody.error || errorMsg;
        } catch (_) { /* ignore parse error */ }
      }
      
      console.error('Payment error details:', errorMsg);
      throw new Error(errorMsg);
    }

    if (data && data.error) {
      throw new Error(data.error);
    }

    return data;
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
