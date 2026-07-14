import React, { useState, useEffect } from 'react';
import { MessageSquare, User, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabase';
import InquiryReplies from './InquiryReplies';

export default function InquiryKanban({ inquiries }) {
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [userInfo, setUserInfo] = useState({ id: '', name: '', role: '' });
  const [agentNames, setAgentNames] = useState({});
  const [tenantProfiles, setTenantProfiles] = useState({});
  const [userLoaded, setUserLoaded] = useState(false);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [tenantsLoaded, setTenantsLoaded] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUserInfo({
        id: u.id || u.profile_id || '',
        name: u.full_name || u.name || 'User',
        role: u.role || 'renter',
      });
    }).catch(() => {}).finally(() => setUserLoaded(true));
  }, []);

  // Fetch agent names from profiles table for all inquiries (using agent_id)
  useEffect(() => {
    if (!inquiries.length) {
      setAgentsLoaded(true);
      return;
    }
    const agentIds = [...new Set(inquiries.map(i => i.agent_id).filter(Boolean))];
    if (!agentIds.length) {
      setAgentsLoaded(true);
      return;
    }

    const fetchAgentNames = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', agentIds);
        
        if (data) {
          const nameMap = {};
          data.forEach(p => { 
            nameMap[p.id] = p.full_name || p.email || 'Agent'; 
          });
          setAgentNames(nameMap);
        }
      } catch (err) {
        console.error('Failed to fetch agent names:', err);
      } finally {
        setAgentsLoaded(true);
      }
    };
    fetchAgentNames();
  }, [inquiries]);

  // Fetch tenant names from profiles table using tenant_id
  useEffect(() => {
    if (!inquiries.length) {
      setTenantsLoaded(true);
      return;
    }
    const tenantIds = [...new Set(inquiries.map(i => i.tenant_id).filter(Boolean))];
    if (!tenantIds.length) {
      setTenantsLoaded(true);
      return;
    }

    const fetchTenantNames = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', tenantIds);
        
        if (data) {
          const profileMap = {};
          data.forEach(p => { 
            profileMap[p.id] = p; 
          });
          setTenantProfiles(profileMap);
        }
      } catch (err) {
        console.error('Failed to fetch tenant names:', err);
      } finally {
        setTenantsLoaded(true);
      }
    };
    fetchTenantNames();
  }, [inquiries]);

  // Both async sources must be loaded before we render the list
  const isReady = userLoaded && agentsLoaded && tenantsLoaded;

  if (inquiries.length === 0) {
    return (
      <div className="text-center py-16">
        <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="font-semibold text-lg">No inquiries yet</p>
        <p className="text-muted-foreground text-sm mt-1">Inquiries from your listings will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[70vh] border rounded-xl overflow-hidden bg-white">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r overflow-y-auto">
        <div className="p-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Conversations ({inquiries.length})</h3>
        </div>
        <div className="divide-y">
          {!isReady ? (
            /* Show skeleton placeholders while user role & agent names load */
            Array.from({ length: Math.min(inquiries.length, 5) }).map((_, i) => (
              <div key={i} className="p-3 flex gap-3 items-start">
                <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))
          ) : (
            inquiries.map(inq => {
              // Determine display name based on user role
              let displayName;
              let displaySubtitle = inq.listing_title || 'Listing';

              if (userInfo.role === 'agent') {
                // Agent sees the renter/tenant name
                displayName = inq.tenant_id ? (tenantProfiles[inq.tenant_id]?.full_name || tenantProfiles[inq.tenant_id]?.email || 'User') : (inq.name || 'User');
              } else {
                // Owner and renter both see agent info
                displayName = agentNames[inq.agent_id] || 'Agent';
                displaySubtitle = inq.listing_title ? 'Inquiry for ' + inq.listing_title : 'Agent';
              }

              return (
                <button
                  key={inq.id}
                  onClick={() => setSelectedInquiry(inq)}
                  className={`w-full text-left p-3 hover:bg-accent/5 transition-colors flex gap-3 items-start ${
                    selectedInquiry?.id === inq.id ? 'bg-accent/10 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-sm truncate">{displayName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(inq.created_date), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {displaySubtitle}
                    </p>
                    {userInfo.role === 'agent' && inq.message && (
                      <p className="text-xs text-muted-foreground truncate mt-1 opacity-70">
                        {inq.message}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedInquiry ? (
          <InquiryReplies
            inquiry={{
              ...selectedInquiry,
              name: selectedInquiry.name || tenantProfiles[selectedInquiry.tenant_id]?.full_name,
              email: selectedInquiry.email || tenantProfiles[selectedInquiry.tenant_id]?.email,
              agent_name: agentNames[selectedInquiry.agent_id]
            }}
            currentUserId={userInfo.id}
            currentUserName={userInfo.name}
            currentUserRole={userInfo.role}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}