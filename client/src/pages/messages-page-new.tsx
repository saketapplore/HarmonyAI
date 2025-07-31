import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User, Message, InsertMessage } from "@shared/schema";
import { Search, Send, ArrowLeft, Paperclip, Circle, MoreVertical, Phone, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

// Sample chat data for demonstration
const sampleChats = [
  {
    id: 1,
    name: "Sarah Johnson",
    username: "sarah.j",
    title: "Senior Developer",
    profileImageUrl: "",
    lastMessage: "Hey! How's the project going?",
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    unreadCount: 2,
    isOnline: true,
    isTyping: false,
    messages: [
      { id: 1, content: "Hi there! 👋", senderId: 2, createdAt: new Date(Date.now() - 30 * 60 * 1000) },
      { id: 2, content: "Hello! How are you?", senderId: 1, createdAt: new Date(Date.now() - 25 * 60 * 1000) },
      { id: 3, content: "I'm doing great! Working on the new feature", senderId: 2, createdAt: new Date(Date.now() - 20 * 60 * 1000) },
      { id: 4, content: "That sounds exciting! What's the timeline?", senderId: 1, createdAt: new Date(Date.now() - 15 * 60 * 1000) },
      { id: 5, content: "We're aiming for next week", senderId: 2, createdAt: new Date(Date.now() - 10 * 60 * 1000) },
      { id: 6, content: "Hey! How's the project going?", senderId: 2, createdAt: new Date(Date.now() - 5 * 60 * 1000) }
    ]
  },
  {
    id: 2,
    name: "Mike Chen",
    username: "mike.chen",
    title: "Product Manager",
    profileImageUrl: "",
    lastMessage: "The meeting is scheduled for tomorrow at 10 AM",
    lastMessageTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    unreadCount: 0,
    isOnline: false,
    isTyping: true,
    messages: [
      { id: 1, content: "Hi Mike! 👋", senderId: 1, createdAt: new Date(Date.now() - 45 * 60 * 1000) },
      { id: 2, content: "Hello! Ready for our discussion?", senderId: 2, createdAt: new Date(Date.now() - 40 * 60 * 1000) },
      { id: 3, content: "Absolutely! I have some ideas to share", senderId: 1, createdAt: new Date(Date.now() - 35 * 60 * 1000) },
      { id: 4, content: "Perfect! Let's schedule a meeting", senderId: 2, createdAt: new Date(Date.now() - 20 * 60 * 1000) },
      { id: 5, content: "The meeting is scheduled for tomorrow at 10 AM", senderId: 2, createdAt: new Date(Date.now() - 15 * 60 * 1000) }
    ]
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    username: "emily.r",
    title: "UX Designer",
    profileImageUrl: "",
    lastMessage: "The designs look amazing! 🎨",
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    unreadCount: 1,
    isOnline: true,
    isTyping: false,
    messages: [
      { id: 1, content: "Hi Emily! 😊", senderId: 1, createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
      { id: 2, content: "Hello! I've been working on the new designs", senderId: 3, createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000) },
      { id: 3, content: "Can't wait to see them!", senderId: 1, createdAt: new Date(Date.now() - 2.2 * 60 * 60 * 1000) },
      { id: 4, content: "The designs look amazing! 🎨", senderId: 3, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) }
    ]
  },
  {
    id: 4,
    name: "David Kim",
    username: "david.k",
    title: "Backend Engineer",
    profileImageUrl: "",
    lastMessage: "The API is ready for testing",
    lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    unreadCount: 0,
    isOnline: false,
    isTyping: false,
    messages: [
      { id: 1, content: "Hi David! How's the backend coming along?", senderId: 1, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
      { id: 2, content: "Going well! Almost done with the API", senderId: 4, createdAt: new Date(Date.now() - 24.5 * 60 * 60 * 1000) },
      { id: 3, content: "Great! When can we test it?", senderId: 1, createdAt: new Date(Date.now() - 24.2 * 60 * 60 * 1000) },
      { id: 4, content: "The API is ready for testing", senderId: 4, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    ]
  }
];

export default function MessagesPageNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use sample chats instead of connections for demonstration
  const [chats, setChats] = useState(sampleChats);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  
  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setChats(prevChats => 
        prevChats.map(chat => ({
          ...chat,
          lastMessageTime: new Date(chat.lastMessageTime.getTime() + Math.random() * 1000)
        }))
      );
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Simulate typing indicator
  useEffect(() => {
    if (selectedContact) {
      const chat = chats.find(c => c.id === selectedContact.id);
      if (chat?.isTyping) {
        const timeout = setTimeout(() => {
          setChats(prevChats => 
            prevChats.map(c => 
              c.id === selectedContact.id ? { ...c, isTyping: false } : c
            )
          );
        }, 3000);
        return () => clearTimeout(timeout);
      }
    }
  }, [selectedContact?.id, chats]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages]);

  // Handle typing indicator
  const handleTyping = () => {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    setIsTyping(true);
    
    const timeout = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
    
    setTypingTimeout(timeout);
  };

  // Handle sending a message
  const handleSendMessage = () => {
    if (!user || !selectedContact || !messageText.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      content: messageText.trim(),
      senderId: user.id,
      receiverId: selectedContact.id,
      createdAt: new Date()
    };
    
    // Add message to current conversation
    setCurrentMessages(prev => [...prev, newMessage]);
    
    // Update chat list with new message
    setChats(prevChats => 
      prevChats.map(chat => 
        chat.id === selectedContact.id 
          ? {
              ...chat,
              lastMessage: messageText.trim(),
              lastMessageTime: new Date(),
              unreadCount: 0
            }
          : chat
      )
    );
    
    setMessageText("");
    setIsTyping(false);
    
    // Simulate reply after 2-5 seconds
    setTimeout(() => {
      const replies = [
        "Thanks for the message! 👍",
        "Got it! Will get back to you soon.",
        "That sounds great! 😊",
        "I'll look into it right away.",
        "Perfect! Let's discuss this further.",
        "Thanks for sharing! 🙏"
      ];
      
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      
      const replyMessage = {
        id: Date.now() + 1,
        content: randomReply,
        senderId: selectedContact.id,
        receiverId: user.id,
        createdAt: new Date()
      };
      
      setCurrentMessages(prev => [...prev, replyMessage]);
      
      // Update chat list
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === selectedContact.id 
            ? {
                ...chat,
                lastMessage: randomReply,
                lastMessageTime: new Date(),
                unreadCount: 1
              }
            : chat
        )
      );
    }, 2000 + Math.random() * 3000);
  };

  // Filter chats based on search term
  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    chat.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format time for messages
  const formatTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Format last message time
  const formatLastMessageTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) {
      return 'now';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}m`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Load messages when contact is selected - Fixed to prevent infinite loop
  useEffect(() => {
    if (selectedContact) {
      const chat = chats.find(c => c.id === selectedContact.id);
      if (chat) {
        setCurrentMessages(chat.messages);
        // Mark as read - only if there are unread messages
        if (chat.unreadCount > 0) {
          setChats(prevChats => 
            prevChats.map(c => 
              c.id === selectedContact.id ? { ...c, unreadCount: 0 } : c
            )
          );
        }
      }
    } else {
      setCurrentMessages([]);
    }
  }, [selectedContact?.id]); // Only depend on selectedContact.id, not the entire chats array

  return (
    <Layout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-120px)] flex bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Left sidebar - Contact list (always visible) */}
        <div 
          className="w-80 border-r border-gray-200 flex flex-col relative shadow-lg bg-white"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-800 mb-4">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                className="pl-10 bg-white border-gray-200 shadow-sm hover:border-purple-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Contacts list */}
          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {filteredChats && filteredChats.length > 0 ? (
                filteredChats.map(chat => (
                  <div 
                    key={chat.id}
                    className={cn(
                      "flex items-center p-4 cursor-pointer transition-all duration-300 border-l-4 border-transparent hover:border-l-purple-500 hover:bg-gray-50",
                      selectedContact?.id === chat.id && "bg-purple-50 border-l-purple-500"
                    )}
                    onClick={() => setSelectedContact(chat as any)}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 mr-3">
                        <AvatarImage src={chat.profileImageUrl || ""} />
                        <AvatarFallback className="bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 font-medium shadow-sm">
                          {chat.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Online status indicator */}
                      {chat.isOnline && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full shadow-sm"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {chat.name}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatLastMessageTime(chat.lastMessageTime)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500 truncate flex-1">
                          {chat.isTyping ? (
                            <span className="text-purple-600 italic">typing...</span>
                          ) : (
                            chat.lastMessage
                          )}
                        </p>
                        {chat.unreadCount > 0 && (
                          <div className="ml-2 bg-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                  <div className="bg-purple-100 p-4 rounded-full mb-4">
                    <Search className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">Your Messages</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Connect with professionals to start messaging.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Chat area */}
        <div className="flex-1 flex flex-col bg-white">
          {!selectedContact ? (
            // Welcome message when no contact selected
            <div 
              className="flex-1 flex items-center justify-center relative bg-gray-50"
            >
              <div className="text-center px-6">
                <div className="bg-purple-100 p-6 rounded-full mb-6 mx-auto w-20 h-20 flex items-center justify-center">
                  <Send className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Welcome to Messages</h3>
                <p className="text-gray-600 text-base leading-relaxed max-w-md mx-auto mb-6">
                  Select a contact from the sidebar to start a conversation or continue an existing one.
                </p>
                
                {/* Real-time features showcase */}
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mb-2 mx-auto">
                      <Circle className="h-4 w-4 text-green-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">Real-time messaging</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full mb-2 mx-auto">
                      <Search className="h-4 w-4 text-purple-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">Instant search</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mb-2 mx-auto">
                      <Phone className="h-4 w-4 text-blue-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">Voice & video calls</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-center w-8 h-8 bg-orange-100 rounded-full mb-2 mx-auto">
                      <Paperclip className="h-4 w-4 text-orange-600" />
                    </div>
                    <p className="text-xs text-gray-600 text-center">File sharing</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Chat view
            <div className="flex flex-col h-full">
              {/* Chat header */}
              <div 
                className="p-4 flex items-center shadow-sm min-h-[80px] bg-white border-b border-gray-200"
              >
                <div className="flex items-center flex-1">
                  <Avatar className="h-12 w-12 mr-4 ring-2 ring-purple-200">
                    <AvatarImage src={selectedContact?.profileImageUrl || ""} />
                    <AvatarFallback className="bg-purple-100 text-purple-600 font-medium">
                      {(selectedContact?.name || selectedContact?.username || "U")?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 py-2">
                    <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
                      {selectedContact?.name || selectedContact?.username || "Contact"}
                    </h3>
                    <div className="flex items-center">
                      <p className="text-sm text-gray-600 leading-tight mr-2">
                        {selectedContact?.title || "Professional"}
                      </p>
                      {chats.find(c => c.id === selectedContact.id)?.isOnline && (
                        <div className="flex items-center text-green-600 text-xs">
                          <Circle className="h-3 w-3 mr-1" />
                          online
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages area with enhanced background */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-3 relative bg-gray-50"
              >
                {currentMessages.length > 0 ? (
                  <>
                    {currentMessages.map((message, index) => {
                      const isFromUser = message.senderId === user?.id;
                      const showAvatar = index === 0 || currentMessages[index - 1]?.senderId !== message.senderId;
                      
                      return (
                        <div key={message.id} className={cn("flex mb-4", isFromUser ? "justify-end" : "justify-start")}>
                          <div className={cn("flex items-end", isFromUser ? "flex-row-reverse space-x-reverse space-x-2" : "space-x-2")}>
                            {/* Avatar for other user */}
                            {!isFromUser && (
                              <div className="w-8 flex justify-center">
                                {showAvatar ? (
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={selectedContact.profileImageUrl || ""} />
                                    <AvatarFallback className="bg-purple-100 text-purple-600 text-xs">
                                      {(selectedContact.name || selectedContact.username)?.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="w-8 h-8" />
                                )}
                              </div>
                            )}
                            
                            <div className={cn("flex flex-col", isFromUser ? "items-end" : "items-start")}>
                              <div
                                className={cn(
                                  "max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-md",
                                  isFromUser
                                    ? "text-white rounded-br-md"
                                    : "bg-white text-gray-800 rounded-bl-md border border-gray-200"
                                )}
                                style={isFromUser ? {
                                  background: `linear-gradient(135deg, #8a3ffc 0%, #9333ea 100%)`,
                                  boxShadow: '0 4px 12px rgba(138, 63, 252, 0.25)'
                                } : {}}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              </div>
                              <span className="text-xs text-gray-500 mt-1 px-2">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Typing indicator */}
                    {chats.find(c => c.id === selectedContact.id)?.isTyping && (
                      <div className="flex justify-start mb-4">
                        <div className="flex items-end space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={selectedContact.profileImageUrl || ""} />
                            <AvatarFallback className="bg-purple-100 text-purple-600 text-xs">
                              {(selectedContact.name || selectedContact.username)?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="bg-white text-gray-800 rounded-2xl border border-gray-200 px-4 py-3">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <p className="text-gray-600 text-sm">
                        No messages yet. Say hello to start the conversation!
                      </p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 p-2 rounded-full transition-colors"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Type your message..."
                      value={messageText}
                      onChange={(e) => {
                        setMessageText(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="rounded-full border-gray-200 bg-white px-4 py-3 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all duration-200"
                    />
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                    className="rounded-full h-11 w-11 p-0 shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, #8a3ffc 0%, #9333ea 100%)`,
                      boxShadow: '0 4px 12px rgba(138, 63, 252, 0.3)'
                    }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}