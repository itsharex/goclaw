import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatEvent {
  run_id: string;
  seq: number;
  state: 'delta' | 'thinking' | 'tool' | 'final' | 'error';
  content: string;
  timestamp: number;
}

interface StreamingMessage {
  id: string;
  runId: string;
  content: string;
  thinking: string;
  toolCalls: { name: string; args?: string; result?: string }[];
  isComplete: boolean;
}

const ChatPanel: React.FC = () => {
  const { status: wsStatus, lastMessage, sendMessage } = useWebSocket(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingRequests = useRef<Map<string, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }>>(new Map());
  const sendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 监听连接建立，获取session_id
  useEffect(() => {
    if (lastMessage?.method === 'connected') {
      const params = lastMessage.params as { session_id: string };
      setSessionId(params.session_id);
      console.log('WebSocket connected with session:', params.session_id);
    }
  }, [lastMessage]);

  // 处理消息响应
  useEffect(() => {
    if (lastMessage?.id && pendingRequests.current.has(lastMessage.id)) {
      const pending = pendingRequests.current.get(lastMessage.id);
      if (pending) {
        if (lastMessage.error) {
          pending.reject(new Error(lastMessage.error.message));
        } else {
          pending.resolve(lastMessage.result);
        }
        pendingRequests.current.delete(lastMessage.id);
      }
    }

    // 监听聊天事件
    if (lastMessage?.method === 'chat.event') {
      const params = lastMessage.params as { data?: ChatEvent };
      const event = params.data;
      if (!event) return;

      console.log('Received chat.event:', event);

      if (event.state === 'delta') {
        // 增量文本
        setStreamingMessage((prev) => {
          if (!prev || prev.runId !== event.run_id) {
            return {
              id: event.run_id,
              runId: event.run_id,
              content: event.content,
              thinking: '',
              toolCalls: [],
              isComplete: false,
            };
          }
          return {
            ...prev,
            content: prev.content + event.content,
          };
        });
      } else if (event.state === 'thinking') {
        // 思考过程
        setStreamingMessage((prev) => {
          if (!prev || prev.runId !== event.run_id) {
            return {
              id: event.run_id,
              runId: event.run_id,
              content: '',
              thinking: event.content,
              toolCalls: [],
              isComplete: false,
            };
          }
          return {
            ...prev,
            thinking: prev.thinking + event.content,
          };
        });
      } else if (event.state === 'tool') {
        // 工具调用
        try {
          const toolInfo = JSON.parse(event.content);
          setStreamingMessage((prev) => {
            if (!prev || prev.runId !== event.run_id) {
              return {
                id: event.run_id,
                runId: event.run_id,
                content: '',
                thinking: '',
                toolCalls: [toolInfo],
                isComplete: false,
              };
            }
            return {
              ...prev,
              toolCalls: [...prev.toolCalls, toolInfo],
            };
          });
        } catch {
          // 忽略解析错误
        }
      } else if (event.state === 'final') {
        // 最终消息
        const finalContent = event.content;

        // 清除超时定时器
        if (sendingTimeoutRef.current) {
          clearTimeout(sendingTimeoutRef.current);
          sendingTimeoutRef.current = null;
        }

        // 添加到消息列表
        const assistantMessage: Message = {
          id: event.run_id,
          role: 'assistant',
          content: finalContent,
          timestamp: event.timestamp / 1000,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // 清除流式消息
        setStreamingMessage(null);
        setSending(false);
      } else if (event.state === 'error') {
        // 错误
        console.error('Chat error:', event.content);

        // 清除超时定时器
        if (sendingTimeoutRef.current) {
          clearTimeout(sendingTimeoutRef.current);
          sendingTimeoutRef.current = null;
        }

        setStreamingMessage(null);
        setSending(false);
      }
    }

    // 监听来自gateway的消息（旧格式兼容）
    if (lastMessage?.method === 'chat.response') {
      console.log('Received chat.response:', lastMessage);

      // 清除超时定时器
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
        sendingTimeoutRef.current = null;
      }

      const params = lastMessage.params as { data?: { content: string }; content?: string };
      const content = params.data?.content || params.content;
      if (content) {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: content,
          timestamp: Date.now() / 1000,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
      // 重置发送状态
      setSending(false);
    }
  }, [lastMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (sendingTimeoutRef.current) {
        clearTimeout(sendingTimeoutRef.current);
      }
    };
  }, []);

  // 发送消息
  const handleSend = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: Date.now() / 1000,
    };

    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    setMessage('');

    // 清除之前的超时定时器
    if (sendingTimeoutRef.current) {
      clearTimeout(sendingTimeoutRef.current);
    }

    // 设置超时保护，60秒后自动重置发送状态
    sendingTimeoutRef.current = setTimeout(() => {
      console.warn('Chat response timeout, resetting sending state');
      setSending(false);
      setStreamingMessage(null);
    }, 60000);

    // 发送消息（不等待响应，通过事件接收）
    sendMessage('chat', { content: userMessage.content });
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
          {sessionId && (
            <span className="text-xs text-gray-400 ml-2">
              Session: {sessionId.substring(0, 8)}...
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-lg border border-gray-200 h-[500px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p>直接与 Gateway 对话</p>
                <p className="text-sm mt-2">消息通过 WebSocket 实时传输</p>
              </div>
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
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
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
              placeholder="输入消息..."
              disabled={sending || wsStatus !== 'connected'}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={sending || !message.trim() || wsStatus !== 'connected'}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 rounded-lg text-white"
            >
              {sending ? '发送中...' : '发送'}
            </button>
            <button
              onClick={clearChat}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700"
            >
              清空
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;