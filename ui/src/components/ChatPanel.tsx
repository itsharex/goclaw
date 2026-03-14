import { useState, useEffect, useRef } from 'react';
import { useChannels } from '../hooks/useChannels';
import { useWebSocket } from '../hooks/useWebSocket';
import { rpc } from '../services/rpc';
import { Message, Channel } from '../types';

const ChatPanel: React.FC = () => {
  const { channels } = useChannels();
  const { status: wsStatus, lastMessage } = useWebSocket(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [chatId, setChatId] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 兼容 channel 数据，可能是字符串或对象
  const getChannelName = (channel: Channel | string): string => {
    return typeof channel === 'string' ? channel : (channel.name ?? '');
  };

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(getChannelName(channels[0]));
    }
  }, [channels, selectedChannel]);

  useEffect(() => {
    if (lastMessage?.method === 'message.inbound') {
      const params = lastMessage.params as { channel: string; chat_id: string; content: string };
      if (params.channel === selectedChannel && params.chat_id === chatId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'user',
            content: params.content,
            timestamp: Date.now() / 1000,
          },
        ]);
      }
    }
    if (lastMessage?.method === 'message.outbound') {
      const params = lastMessage.params as { channel: string; chat_id: string; content: string };
      if (params.channel === selectedChannel && params.chat_id === chatId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: params.content,
            timestamp: Date.now() / 1000,
          },
        ]);
      }
    }
  }, [lastMessage, selectedChannel, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !selectedChannel || !chatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now() / 1000,
    };

    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    try {
      await rpc.sendMessage(selectedChannel, chatId, message);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
      setMessage('');
    }
  };

  const handleAgentSend = async () => {
    if (!message.trim() || !selectedChannel || !chatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now() / 1000,
    };

    setMessages((prev) => [...prev, userMessage]);
    setWaiting(true);

    try {
      const result = await rpc.agentWait(selectedChannel, chatId, message);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: Date.now() / 1000,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Failed to send to agent:', err);
    } finally {
      setWaiting(false);
      setMessage('');
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-500">{wsStatus}</span>
        </div>
      </div>

      {/* Channel and Chat ID Selection */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Channel</label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900"
            >
              {channels.map((channel) => (
                <option key={getChannelName(channel)} value={getChannelName(channel)}>
                  {getChannelName(channel)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Enter chat ID"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={clearChat}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 w-full"
            >
              Clear Chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-lg border border-gray-200 h-[400px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Select a channel and chat ID, then send a message</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className={`text-xs mb-1 capitalize ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                    {msg.role}
                  </div>
                  <p>{msg.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..."
              disabled={sending || waiting || !selectedChannel || !chatId}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !message.trim() || !selectedChannel || !chatId}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 rounded-lg text-white"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={handleAgentSend}
              disabled={waiting || !message.trim() || !selectedChannel || !chatId}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 rounded-lg text-white"
            >
              {waiting ? 'Waiting...' : 'Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;