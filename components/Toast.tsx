"use client";

// No React imports needed for this component as of now
import { X, AlertCircle } from "lucide-react";

export interface ToastMessage {
  id: string;
  message: string;
  type: "error" | "info" | "success";
}

export default function ToastContainer({ messages, onRemove }: { messages: ToastMessage[], onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 max-w-md w-full">
      {messages.map((msg) => (
        <div 
          key={msg.id}
          className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 shadow-2xl flex items-start gap-4 animate-in slide-in-from-right duration-300"
        >
          <div className={`mt-0.5 ${msg.type === 'error' ? 'text-red-500' : 'text-[#7c3aed]'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-200 font-medium leading-relaxed">
              {msg.message}
            </p>
          </div>
          <button 
            onClick={() => onRemove(msg.id)}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
