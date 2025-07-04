import React, { useState } from 'react';
import { Plus, Send, X, Clock, AlertCircle, Info, CheckCircle, AlertTriangle, Feather, Scroll } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import RippleButton from './RippleButton';

interface AnnouncementManagerProps {
  onClose: () => void;
}

const AnnouncementManager: React.FC<AnnouncementManagerProps> = ({ onClose }) => {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success' | 'urgent',
    duration: 30 // seconds
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const announcementTypes = [
    { value: 'info', label: 'General Notice', icon: Info, color: 'text-vintage-blue', description: 'Standard information bulletin' },
    { value: 'success', label: 'Official Commendation', icon: CheckCircle, color: 'text-vintage-green', description: 'Positive announcement or achievement' },
    { value: 'warning', label: 'Important Notice', icon: AlertTriangle, color: 'text-vintage-gold', description: 'Cautionary or advisory message' },
    { value: 'urgent', label: 'Urgent Bulletin', icon: AlertCircle, color: 'text-vintage-red', description: 'Critical alert requiring immediate attention' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      showError('Validation Error', 'Please provide both headline and article content.');
      return;
    }

    setIsSubmitting(true);

    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + formData.duration);

      console.log('Publishing notice:', {
        title: formData.title.trim(),
        message: formData.message.trim(),
        type: formData.type,
        expires_at: expiresAt.toISOString()
      });

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: formData.title.trim(),
          message: formData.message.trim(),
          type: formData.type,
          expires_at: expiresAt.toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Notice published successfully:', data);
      showSuccess('Notice Published', 'Your announcement has been distributed to all detective teams instantly.');
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        type: 'info',
        duration: 30
      });
      
      onClose();
    } catch (error) {
      console.error('Error publishing notice:', error);
      showError('Publication Failed', 'Failed to publish notice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="vintage-card rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-4 border-double border-vintage-brown p-6 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-vintage-gold to-vintage-brown rounded-full flex items-center justify-center border-4 border-vintage-brown">
                <Feather className="w-6 h-6 text-vintage-cream" />
              </div>
              <div>
                <h3 className="vintage-headline text-3xl font-playfair">Notice Composition Desk</h3>
                <p className="text-vintage-gray font-crimson italic">Official Publication Department</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="vintage-btn p-2 rounded-lg transition-colors duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Headline */}
          <div>
            <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair uppercase tracking-wide">
              Notice Headline *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="vintage-input w-full px-4 py-3 rounded-lg font-playfair text-lg placeholder-vintage-gray focus:outline-none"
              placeholder="Enter compelling headline..."
              maxLength={100}
              required
            />
            <div className="text-right text-xs text-vintage-gray mt-1 font-crimson">
              {formData.title.length}/100 characters
            </div>
          </div>

          {/* Notice Type */}
          <div>
            <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair uppercase tracking-wide">
              Publication Category
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcementTypes.map((type) => {
                const IconComponent = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value as any }))}
                    className={`vintage-card p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                      formData.type === type.value
                        ? 'border-vintage-brown bg-vintage-brown/10'
                        : 'border-vintage-gray hover:border-vintage-brown'
                    }`}
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <IconComponent className={`w-6 h-6 ${type.color}`} />
                      <span className="font-playfair font-semibold text-vintage-black">{type.label}</span>
                    </div>
                    <p className="text-sm text-vintage-gray font-crimson">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Article Content */}
          <div>
            <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair uppercase tracking-wide">
              Article Content *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              className="vintage-input w-full px-4 py-3 rounded-lg font-crimson text-lg placeholder-vintage-gray focus:outline-none resize-none"
              rows={6}
              placeholder="Compose your official notice content here. This will appear as the main article body in the newspaper format..."
              maxLength={500}
              required
            />
            <div className="text-right text-xs text-vintage-gray mt-1 font-crimson">
              {formData.message.length}/500 characters
            </div>
          </div>

          {/* Publication Duration */}
          <div>
            <label className="block text-vintage-brown text-sm font-semibold mb-2 font-playfair uppercase tracking-wide">
              Distribution Duration
            </label>
            <div className="vintage-card rounded-lg p-4">
              <div className="flex items-center space-x-4 mb-3">
                <Clock className="w-5 h-5 text-vintage-brown" />
                <span className="font-crimson text-vintage-black">Notice will remain active for:</span>
                <span className="font-playfair font-bold text-vintage-brown text-lg">
                  {formData.duration} seconds
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="5"
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                className="w-full h-2 bg-vintage-brown/20 rounded-lg appearance-none cursor-pointer vintage-progress"
              />
              <div className="flex justify-between text-xs text-vintage-gray mt-2 font-crimson">
                <span>10s</span>
                <span>Quick Notice</span>
                <span>Standard</span>
                <span>Extended</span>
                <span>5m</span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="vintage-card rounded-lg p-6">
            <h4 className="vintage-headline text-lg font-playfair mb-4 flex items-center space-x-2">
              <Scroll className="w-5 h-5 text-vintage-brown" />
              <span>Publication Preview</span>
            </h4>
            
            {/* Mini Newspaper Preview */}
            <div className="newspaper-column rounded-lg p-4 max-w-md mx-auto">
              <div className="border-4 border-double border-vintage-brown p-4 rounded-lg bg-vintage-cream">
                {/* Preview Header */}
                <div className="text-center mb-4">
                  <h5 className="font-playfair text-lg font-black text-vintage-black">THE SIGNAL GAZETTE</h5>
                  <div className="text-xs text-vintage-brown font-crimson">SPECIAL EDITION</div>
                </div>
                
                {/* Preview Category */}
                <div className="text-center mb-3">
                  <span className={`inline-block px-3 py-1 rounded border text-xs font-playfair font-bold ${
                    formData.type === 'urgent' ? 'border-vintage-red bg-vintage-red/20 text-vintage-red' :
                    formData.type === 'warning' ? 'border-vintage-gold bg-vintage-gold/20 text-vintage-gold' :
                    formData.type === 'success' ? 'border-vintage-green bg-vintage-green/20 text-vintage-green' :
                    'border-vintage-blue bg-vintage-blue/20 text-vintage-blue'
                  }`}>
                    {announcementTypes.find(t => t.value === formData.type)?.label.toUpperCase()}
                  </span>
                </div>

                {/* Preview Content */}
                <div className="border-t-2 border-vintage-brown pt-3">
                  <h6 className="font-playfair font-bold text-vintage-black mb-2 text-center">
                    {formData.title || 'Your Headline Will Appear Here'}
                  </h6>
                  <p className="text-sm text-vintage-black font-crimson leading-relaxed">
                    {formData.message || 'Your article content will be displayed here in proper newspaper format with elegant typography and professional layout...'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-6 border-t-2 border-vintage-brown">
            <RippleButton
              type="button"
              onClick={onClose}
              className="vintage-btn flex-1 px-6 py-3 rounded-lg font-crimson font-semibold transition-all duration-200"
            >
              Cancel Publication
            </RippleButton>
            <RippleButton
              type="submit"
              disabled={isSubmitting || !formData.title.trim() || !formData.message.trim()}
              className="vintage-btn bg-vintage-brown/20 border-vintage-brown text-vintage-brown hover:bg-vintage-brown/30 disabled:opacity-50 flex-1 px-6 py-3 rounded-lg font-crimson font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
              rippleColor="rgba(139, 69, 19, 0.3)"
            >
              <Send className="w-5 h-5" />
              <span>{isSubmitting ? 'Publishing...' : 'Publish Notice'}</span>
            </RippleButton>
          </div>
        </form>

        {/* Publication Info */}
        <div className="mt-6 vintage-card bg-vintage-blue/10 border-vintage-blue rounded-lg p-4">
          <h5 className="text-vintage-blue font-semibold mb-2 font-playfair">📰 Official Publication System</h5>
          <ul className="text-vintage-blue text-sm space-y-1 font-crimson">
            <li>• Notices appear instantly to all detective teams in authentic newspaper format</li>
            <li>• Teams can examine the notice or it will automatically expire after the set duration</li>
            <li>• Urgent bulletins feature special visual effects and require acknowledgment</li>
            <li>• Real-time distribution ensures immediate communication throughout the Empire</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementManager;