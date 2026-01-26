'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Send, 
  Upload, 
  Download, 
  FileJson, 
  Target, 
  Package, 
  RefreshCcw,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Bot,
  Users
} from 'lucide-react';
import { QubeTalkClient, type QubeTalkMessage, type QubeTalkChannel } from '@/sdk/external/QubeTalkClient';

// Glass effect styling
const GLASS_CARD = "bg-slate-950/60 backdrop-blur-xl ring-1 ring-white/10 shadow-xl";
const GLASS_HOVER = "hover:bg-slate-900/80 hover:ring-white/20 transition-all duration-300";

interface MarketaContent {
  id: string;
  type: 'campaign' | 'partner' | 'content' | 'iqube' | 'config_json';
  name: string;
  data: any;
  metadata?: any;
  created_at: string;
}

interface QubeTalkTransfer {
  id: string;
  from_agent: string;
  to_agent: string;
  content_type: string;
  content: MarketaContent;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  created_at: string;
  iqube_ref?: string;
}

export default function MarketaQubeTalk() {
  const [activeTab, setActiveTab] = useState('messages');
  const [messages, setMessages] = useState<QubeTalkMessage[]>([]);
  const [channels, setChannels] = useState<QubeTalkChannel[]>([]);
  const [transfers, setTransfers] = useState<QubeTalkTransfer[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [qubetalkClient, setQubetalkClient] = useState<QubeTalkClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resolveContext = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get('tenant') || window.localStorage.getItem('marketa_tenant_id') || 'metaproof';
    const personaId =
      params.get('persona') ||
      window.localStorage.getItem('marketa_persona_id') ||
      // Dev fallback only (requires CRM persona UUID that matches tenant_id)
      '5ffe87a0-bd7f-49ba-aa11-d45bc2f6a009';
    return { tenantId, personaId };
  }, []);

  // Initialize QubeTalk client
  useEffect(() => {
    const { personaId } = resolveContext();
    const client = new QubeTalkClient({
      baseUrl: '',
      apiKey: process.env.MARKETA_JWT_SECRET || 'demo-key',
      agentId: 'marketa-agq', // Updated to reflect AGQ agent
      personaId
    });
    setQubetalkClient(client);
    
    // Load initial data
    loadChannels(client);
    loadTransfers(client);
  }, [resolveContext]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (channelId?: string) => {
    const channelToLoad = channelId || selectedChannel;
    if (!channelToLoad) return;
    
    try {
      // Use real API call
      if (qubetalkClient) {
        const { tenantId } = resolveContext();
        const result = await qubetalkClient.getMessages({
          channelId: channelToLoad,
          tenantId
        });
        
        if (result.success) {
          setMessages(result.messages || []);
        }
      } else {
        // Fallback to mock data - filter messages by channel
        let mockMessages: QubeTalkMessage[] = [];
        
        // Define messages for each channel
        const allMessages: { [key: string]: QubeTalkMessage[] } = {
          'marketa-agq-marketa-lvb': [
            {
              message_id: 'msg-from-lvb-1',
              from_agent: {
                id: 'marketa-lvb',
                type: 'thin-client',
                name: 'Marketa (LVB)'
              },
              content: {
                type: 'text',
                text: 'Test message from Marketa (LVB) to Marketa (AGQ) - QubeTalk integration test',
                metadata: {
                  sent_from: 'lovable-thin-client',
                  test_message: true
                }
              },
              message_type: 'incoming',
              created_at: new Date().toISOString()
            }
          ],
          'aigent-z-marketa-agq': [
            {
              message_id: 'msg-aigent-z-1',
              from_agent: {
                id: 'aigent-z',
                type: 'system',
                name: 'Aigent Z'
              },
              content: {
                type: 'text',
                text: 'System status: All platforms operational',
                metadata: {
                  system_status: 'operational'
                }
              },
              message_type: 'incoming',
              created_at: new Date(Date.now() - 300000).toISOString()
            }
          ],
          'aigent-z-marketa-lvb': [
            {
              message_id: 'msg-aigent-z-lvb-1',
              from_agent: {
                id: 'aigent-z',
                type: 'system',
                name: 'Aigent Z'
              },
              content: {
                type: 'text',
                text: 'Thin client coordination initialized',
                metadata: {
                  coordination_status: 'active'
                }
              },
              message_type: 'incoming',
              created_at: new Date(Date.now() - 600000).toISOString()
            }
          ],
          'aigent-z-nextjs-app-cp': [
            {
              message_id: 'msg-nextjs-cp-1',
              from_agent: {
                id: 'aigent-z',
                type: 'system',
                name: 'Aigent Z'
              },
              content: {
                type: 'text',
                text: 'Sending KB updates to Next.js App Copilot',
                metadata: {
                  update_type: 'knowledge_base',
                  target: 'nextjs-app-cp'
                }
              },
              message_type: 'incoming',
              created_at: new Date(Date.now() - 900000).toISOString()
            },
            {
              message_id: 'msg-nextjs-cp-2',
              from_agent: {
                id: 'nextjs-app-cp',
                type: 'copilot',
                name: 'Next.js App CP'
              },
              content: {
                type: 'text',
                text: 'KB updates received and integrated successfully',
                metadata: {
                  kb_version: '2.1.0',
                  integration_status: 'complete'
                }
              },
              message_type: 'incoming',
              created_at: new Date(Date.now() - 850000).toISOString()
            }
          ],
          'aigent-z-thin-client': [
            {
              message_id: 'msg-thin-client-1',
              from_agent: {
                id: 'aigent-z',
                type: 'system',
                name: 'Aigent Z'
              },
              content: {
                type: 'text',
                text: 'Relaying message to thin client via Next.js App Copilot',
                metadata: {
                  proxy_via: 'nextjs-app-cp',
                  target_client: 'lovable',
                  message_type: 'relay'
                }
              },
              message_type: 'incoming',
              created_at: new Date(Date.now() - 1200000).toISOString()
            }
          ]
        };
        
        mockMessages = allMessages[channelToLoad] || [];
        setMessages(mockMessages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Fallback to empty messages on error
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!selectedChannel) return;
    loadMessages(selectedChannel);
  }, [selectedChannel, qubetalkClient]);

  const loadChannels = async (clientOverride?: QubeTalkClient) => {
    try {
      const client = clientOverride || qubetalkClient;

      if (client) {
        const { tenantId } = resolveContext();
        const result = await client.listChannels({ tenantId, limit: 50 });
        if (result.success) {
          setChannels(result.channels || []);
          if ((result.channels || []).length > 0) {
            setSelectedChannel(result.channels[0].channel_id);
          }
          return;
        }
      }

      // Channels for Marketa (AGQ) - Thick Platform
      const mockChannels: QubeTalkChannel[] = [
        // In-platform channels (Aigent Z ecosystem) - Blue theme
        {
          channel_id: 'aigent-z-marketa-agq',
          tenant_id: resolveContext().tenantId,
          participants: ['aigent-z', 'marketa-agq'],
          created_at: new Date().toISOString(),
          allows_external: false,
          is_in_platform: true
        },
        {
          channel_id: 'aigent-z-marketa-lvb',
          tenant_id: resolveContext().tenantId,
          participants: ['aigent-z', 'marketa-lvb'],
          created_at: new Date().toISOString(),
          allows_external: false,
          is_in_platform: true
        },
        {
          channel_id: 'aigent-z-nextjs-app-cp',
          tenant_id: resolveContext().tenantId,
          participants: ['aigent-z', 'nextjs-app-cp'],
          created_at: new Date().toISOString(),
          allows_external: false,
          is_in_platform: true
        },
        // Off-platform channels (External communication) - Rose theme
        {
          channel_id: 'marketa-agq-marketa-lvb',
          tenant_id: resolveContext().tenantId,
          participants: ['marketa-agq', 'marketa-lvb'],
          created_at: new Date().toISOString(),
          allows_external: true,
          is_in_platform: false
        },
        {
          channel_id: 'aigent-z-thin-client',
          tenant_id: resolveContext().tenantId,
          participants: ['aigent-z', 'thin-client'],
          created_at: new Date().toISOString(),
          allows_external: true,
          is_in_platform: false,
          is_optional: true
        }
      ];
      setChannels(mockChannels);
      if (mockChannels.length > 0) {
        // Select the channel with the LVB test message by default
        setSelectedChannel('marketa-agq-marketa-lvb');
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const getChannelDisplayName = (channelId: string) => {
    const channelNames: { [key: string]: string } = {
      // In-platform channels (Aigent Z ecosystem)
      'aigent-z-marketa-agq': 'Aigent Z - Marketa (AGQ)',
      'aigent-z-marketa-lvb': 'Aigent Z - Marketa (LVB)',
      'aigent-z-nextjs-app-cp': 'Aigent Z - Next.js App CP',
      // Off-platform channels (External communication)
      'marketa-agq-marketa-lvb': 'Marketa (AGQ) - Marketa (LVB)',
      'aigent-z-thin-client': 'Aigent Z - Thin Client'
    };
    return channelNames[channelId] || channelId;
  };

  const getChannelDescription = (channelId: string) => {
    const descriptions: { [key: string]: string } = {
      // In-platform channels (Aigent Z ecosystem)
      'aigent-z-marketa-agq': 'System orchestration and platform management',
      'aigent-z-marketa-lvb': 'Thin client coordination and control',
      'aigent-z-nextjs-app-cp': 'Direct Aigent Z to Next.js App Copilot communication',
      // Off-platform channels (External communication)
      'marketa-agq-marketa-lvb': 'Configuration sync and data exchange with thin client',
      'aigent-z-thin-client': 'Thin client communication via Copilot proxy (Lovable, etc.)'
    };
    return descriptions[channelId] || '';
  };

  const getChannelColor = (channelId: string, isInPlatform?: boolean) => {
    if (isInPlatform) {
      // Blue theme for in-platform channels
      return {
        selected: 'bg-blue-500/20 border border-blue-500/50 text-white',
        unselected: 'bg-slate-800/50 border border-white/10 text-slate-300 hover:bg-blue-900/30 hover:border-blue-500/30',
        icon: 'text-blue-400'
      };
    } else {
      // Rose theme for off-platform channels
      return {
        selected: 'bg-rose-500/20 border border-rose-500/50 text-white',
        unselected: 'bg-slate-800/50 border border-white/10 text-slate-300 hover:bg-rose-900/30 hover:border-rose-500/30',
        icon: 'text-rose-400'
      };
    }
  };

  const loadTransfers = async (clientOverride?: QubeTalkClient) => {
    try {
      const client = clientOverride || qubetalkClient;

      if (client) {
        const { tenantId } = resolveContext();
        const result = await client.getTransfers({ tenantId, limit: 50 });
        if (result.success) {
          setTransfers(result.transfers || []);
          return;
        }
      }

      // Mock transfers - replace with actual API call
      const mockTransfers: QubeTalkTransfer[] = [
        {
          id: 'transfer-from-lvb-1',
          from_agent: 'marketa-lvb',
          to_agent: 'marketa-agq',
          content_type: 'config_json',
          content: {
            id: 'thin-client-config-1',
            type: 'config_json',
            name: 'Marketa (LVB) Configuration - Multi-Tenant Enabled',
            data: {
              client_version: '1.0.0',
              ui_components: ['thin-header', 'minimal-dashboard', 'quick-campaigns'],
              feature_flags: {
                advanced_analytics: true,  // Updated: false -> true (AGQ provides analytics)
                multi_tenant: true,       // Updated: false -> true (Now supports multi-tenant)
                custom_branding: true,
                real_time_sync: true       // New: Real-time sync with AGQ
              },
              styling_config: {
                theme: 'minimal',
                primary_color: '#3b82f6',
                layout: 'compact'
              },
              lovable_environment: {
                build_version: 'lovable-build-123',
                deployment_target: 'development'
              },
              // New: Multi-tenant configuration
              multi_tenant_config: {
                enabled: true,
                tenant_context: {
                  tenant_id: 'auto-detected',
                  persona_id: 'auto-detected',
                  role: 'partner'
                },
                capabilities: {
                  create_campaigns: true,
                  view_analytics: true,
                  manage_partners: false,
                  deploy_multi_tenant: false // Only AGQ can deploy multi-tenant
                },
                bridge_config: {
                  api_endpoint: '/api/marketa/lvb/bridge',
                  sync_frequency: 'real-time',
                  source_of_truth: 'agq'
                }
              }
            },
            created_at: new Date().toISOString()
          },
          status: 'delivered',
          created_at: new Date().toISOString(),
          iqube_ref: 'iqube-thin-config-001'
        },
        {
          id: 'transfer-1',
          from_agent: 'marketa-agq',
          to_agent: 'marketa-lvb',
          content_type: 'campaign',
          content: {
            id: 'campaign-1',
            type: 'campaign',
            name: 'Q1 Product Launch - AGQ Version',
            data: {
              phase: 'codex1',
              status: 'active',
              budget: 50000,
              channels: ['email', 'social', 'web'],
              agq_features: {
                advanced_analytics: true,
                multi_tenant: true,
                custom_workflows: true
              }
            },
            created_at: new Date(Date.now() - 3600000).toISOString()
          },
          status: 'delivered',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          iqube_ref: 'iqube-campaign-agq-001'
        }
      ];
      setTransfers(mockTransfers);
    } catch (error) {
      console.error('Failed to load transfers:', error);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannel(channelId);
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
  }, []);

  const sendMessage = async () => {
    if (!messageInput.trim() || !qubetalkClient || !selectedChannel) return;

    const messageText = messageInput.trim(); // Store to prevent cursor loss
    setIsLoading(true);
    try {
      // Send message via QubeTalk
      const result = await qubetalkClient.sendMessage({
        channelId: selectedChannel,
        tenantId: resolveContext().tenantId,
        message: messageText,
        agentName: 'Marketa (AGQ)',
        priority: 'normal'
      });

      // Add to local messages immediately for better UX
      const newMessage: QubeTalkMessage = {
        message_id: result.message_id || `local-${Date.now()}`,
        from_agent: {
          id: 'marketa-agq',
          type: 'platform',
          name: 'Marketa (AGQ)'
        },
        content: {
          type: 'text',
          text: messageText,
          metadata: {
            sent_at: result.sent_at || new Date().toISOString(),
            channel: selectedChannel
          }
        },
        message_type: 'outgoing',
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, newMessage]);
      setMessageInput(''); // Clear input after successful send
    } catch (error) {
      console.error('Failed to send message:', error);
      // Show error message to user
      alert('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && messageInput.trim()) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendContent = async (content: MarketaContent, recipientAgent: string) => {
    if (!qubetalkClient || !selectedChannel) return;

    setIsLoading(true);
    try {
      // Create transfer record
      const transfer: QubeTalkTransfer = {
        id: `transfer-${Date.now()}`,
        from_agent: 'marketa-agq',
        to_agent: recipientAgent,
        content_type: content.type,
        content: content,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      // Send content as JSON message
      const contentMessage = JSON.stringify({
        type: 'content_transfer',
        content: content,
        transfer_id: transfer.id
      });

      await qubetalkClient.sendMessage({
        channelId: selectedChannel,
        tenantId: resolveContext().tenantId,
        message: contentMessage,
        agentName: 'Marketa (AGQ)',
        priority: 'high'
      });

      // Update transfer status
      transfer.status = 'sent';
      setTransfers(prev => [...prev, transfer]);
    } catch (error) {
      console.error('Failed to send content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const content: MarketaContent = {
        id: `upload-${Date.now()}`,
        type: file.name.includes('campaign') ? 'campaign' : 'content',
        name: file.name,
        data: JSON.parse(text),
        created_at: new Date().toISOString()
      };

      // Send to Aigent Z by default
      await sendContent(content, 'aigent-z');
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'sent':
        return <Send className="w-4 h-4 text-blue-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const GlassCard = ({ children, className = "" }: { 
    children: React.ReactNode; 
    className?: string; 
  }) => (
    <div className={`${GLASS_CARD} ${GLASS_HOVER} ${className} rounded-xl`}>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-rose-400 mb-2 flex items-center gap-3">
              <MessageSquare className="w-6 h-6" />
              QubeTalk Interface
            </h2>
            <p className="text-slate-300">
              Two-way communication with Aigent Z and Lovable thin client
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-slate-800/50 border-white/20 text-slate-300 hover:bg-slate-700/50"
              onClick={() => {
                loadChannels();
                loadTransfers();
                loadMessages(selectedChannel);
              }}
            >
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Main Interface */}
      <GlassCard className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-white/10">
            <TabsTrigger value="messages" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <MessageSquare className="w-4 h-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="transfers" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Package className="w-4 h-4 mr-2" />
              Content Transfer
            </TabsTrigger>
            <TabsTrigger value="iqubes" className="data-[state=active]:bg-rose-500 data-[state=active]:text-white">
              <Bot className="w-4 h-4 mr-2" />
              iQubes
            </TabsTrigger>
          </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Channel Selection */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-semibold text-white mb-4">Channels</h3>
              <div className="space-y-2">
                {channels.map((channel) => {
                  const colors = getChannelColor(channel.channel_id, (channel as any).is_in_platform);
                  return (
                    <button
                      key={channel.channel_id}
                      onClick={() => handleChannelSelect(channel.channel_id)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedChannel === channel.channel_id
                          ? colors.selected
                          : colors.unselected
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{getChannelDisplayName(channel.channel_id)}</span>
                        <Users className={`w-4 h-4 ${selectedChannel === channel.channel_id ? '' : colors.icon}`} />
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {getChannelDescription(channel.channel_id)}
                      </div>
                      {(channel as any).is_in_platform && (
                        <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          In-Platform
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Messages Area */}
            <div className="lg:col-span-3">
              <div className="bg-slate-800/30 rounded-lg p-4 h-96 overflow-y-auto mb-4">
                {messages.map((message) => (
                  <div
                    key={message.message_id}
                    className={`mb-4 p-3 rounded-lg ${
                      message.from_agent.id === 'marketa-agq'
                        ? 'bg-rose-500/20 border border-rose-500/30 ml-8'
                        : 'bg-slate-700/50 border border-white/10 mr-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white">
                        {message.from_agent.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-200">{message.content.text}</p>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

                {/* Message Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-rose-500/50"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={isLoading || !messageInput.trim()}
                    className="bg-rose-500 hover:bg-rose-600 text-white"
                  >
                    {isLoading ? (
                      <RefreshCcw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Content Transfer Tab */}
          <TabsContent value="transfers" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Upload Section */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Send Content</h3>
                <div className="space-y-4">
                  <GlassCard className="p-4">
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-slate-300 mb-4">Upload JSON files (campaigns, content, etc.)</p>
                      <input
                        type="file"
                        accept=".json"
                        onChange={uploadFile}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-block px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg cursor-pointer transition-colors"
                      >
                        Choose File
                      </label>
                    </div>
                  </GlassCard>

                  {/* Quick Actions */}
                  <GlassCard className="p-4">
                    <h4 className="font-medium text-white mb-3">Quick Send</h4>
                    <div className="space-y-2">
                      <Button
                        onClick={() => sendContent({
                          id: `campaign-${Date.now()}`,
                          type: 'campaign',
                          name: 'Sample Campaign from AGQ',
                          data: { 
                            phase: 'codex1', 
                            status: 'active', 
                            budget: 10000,
                            agq_features: {
                              advanced_analytics: true,
                              multi_tenant: true
                            }
                          },
                          created_at: new Date().toISOString()
                        }, 'marketa-lvb')}
                        className="w-full bg-slate-800/50 border border-white/20 text-slate-300 hover:bg-slate-700/50"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        Send Campaign to LVB
                      </Button>
                      <Button
                        onClick={() => sendContent({
                          id: `content-${Date.now()}`,
                          type: 'content',
                          name: 'AGQ Content Package',
                          data: { 
                            type: 'newsletter', 
                            sections: ['header', 'featured', 'cta'],
                            agq_enhancements: {
                              personalization: true,
                              analytics: true
                            }
                          },
                          created_at: new Date().toISOString()
                        }, 'marketa-lvb')}
                        className="w-full bg-slate-800/50 border border-white/20 text-slate-300 hover:bg-slate-700/50"
                      >
                        <FileJson className="w-4 h-4 mr-2" />
                        Send Content to LVB
                      </Button>
                      <Button
                        onClick={() => sendContent({
                          id: `system-${Date.now()}`,
                          type: 'config_json',
                          name: 'System Status to Aigent Z',
                          data: { 
                            status: 'operational',
                            active_channels: 2,
                            message_count: 10
                          },
                          created_at: new Date().toISOString()
                        }, 'aigent-z')}
                        className="w-full bg-slate-800/50 border border-white/20 text-slate-300 hover:bg-slate-700/50"
                      >
                        <Bot className="w-4 h-4 mr-2" />
                        Send Status to Aigent Z
                      </Button>
                    </div>
                  </GlassCard>
                </div>
              </div>

              {/* Transfers List */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Transfer History</h3>
                <div className="space-y-3">
                  {transfers.map((transfer) => (
                    <GlassCard key={transfer.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transfer.status)}
                          <span className="font-medium text-white">{transfer.content.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {transfer.content_type}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-400 mb-2">
                        {transfer.from_agent} → {transfer.to_agent}
                      </div>
                      {transfer.iqube_ref && (
                        <div className="text-xs text-slate-500">
                          iQube: {transfer.iqube_ref}
                        </div>
                      )}
                    </GlassCard>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* iQubes Tab */}
          <TabsContent value="iqubes" className="space-y-4 mt-6">
            <div className="text-center py-12">
              <Bot className="w-12 h-12 mx-auto text-slate-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">iQube Integration</h3>
              <p className="text-slate-400 mb-4">
                Advanced iQube transfer capabilities coming soon
              </p>
              <div className="space-y-2 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span>Raw JSON content transfer</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span>iQube packaging and validation</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span>Cross-chain iQube delivery</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </GlassCard>
    </div>
  );
}
