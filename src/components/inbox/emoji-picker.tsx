"use client";

import { useState, useMemo } from "react";
import { Smile, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕"]
  },
  {
    name: "Gestures",
    emojis: ["👍", "👎", "✊", "👊", "🤛", "🤜", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙", "💪", "🦾", "🖕", "✍️", "🙏", "🤝", "👏", "🙌", "👐", "🤲", "💅", "🤳", "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴", "👀", "👁️", "👅", "👄", "💋", "🩸"]
  },
  {
    name: "Hearts & Fun",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "🎉", "🎊", "🎈", "🎂", "🎁", "🎗️", "🎟️", "🎫", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "⭐", "🌟", "✨", "⚡", "💥", "🔥", "🌈", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌧️", "⛈️", "🌩️", "❄️", "💨", "🌊", "💧", "💤", "💬", "💭"]
  },
  {
    name: "Office & Signs",
    emojis: ["✔️", "❌", "⚠️", "🚫", "⭕", "💯", "🔴", "🟢", "🔵", "🟡", "ℹ️", "📢", "📣", "🔔", "🔕", "📍", "📌", "🔍", "🔎", "✉️", "📧", "📩", "📦", "📫", "📂", "📁", "📅", "📆", "📊", "📈", "📉", "📝", "💼", "📎", "✂️", "🔒", "🔓", "🔑", "🛡️", "⚙️", "🔧", "🔨", "🪛", "🛒", "🛍️", "💰", "💳", "📱", "💻", "📞", "🌐"]
  }
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPicker({ onSelect, disabled }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const query = search.trim();
    return EMOJI_CATEGORIES.map(category => ({
      ...category,
      emojis: category.emojis.filter(emoji => 
        emoji.includes(query)
      )
    })).filter(category => category.emojis.length > 0);
  }, [search]);

  const searchedEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase().trim();
    
    const keywords: Record<string, string[]> = {
      heart: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟"],
      love: ["❤️", "😍", "🥰", "😘", "💋", "💕"],
      like: ["👍", "👌", "👏", "🙌"],
      yes: ["👍", "✔️", "🟢", "👌"],
      no: ["👎", "❌", "🚫", "🔴"],
      warn: ["⚠️", "🚫", "🛑"],
      fire: ["🔥", "⚡", "💥"],
      smile: ["😀", "😃", "😄", "😁", "😆", "😅", "😊", "😇", "🙂"],
      laugh: ["😂", "🤣", "😆"],
      cry: ["😭", "😢", "🥺", "💔"],
      think: ["🤔", "🤨", "🧐"],
      star: ["⭐", "🌟", "✨"],
      party: ["🎉", "🎊", "🥳", "🎈", "🎂"],
      gift: ["🎁", "🛍️"],
      check: ["✔️", "✅", "🟢"],
      cross: ["❌", "🚫", "🔴"],
      call: ["📞", "📱", "🌐"],
      mail: ["✉️", "📧", "📩"],
      search: ["🔍", "🔎"],
      alert: ["⚠️", "🚨", "📢", "📣"],
      clock: ["📅", "📆", "⏰", "⏳", "⏱️"]
    };

    const results: string[] = [];
    for (const key in keywords) {
      if (key.includes(q)) {
        results.push(...keywords[key]);
      }
    }

    const matchedDirectly: string[] = [];
    EMOJI_CATEGORIES.forEach(cat => {
      cat.emojis.forEach(emoji => {
        if (emoji === q) matchedDirectly.push(emoji);
      });
    });

    const combined = Array.from(new Set([...matchedDirectly, ...results]));
    return combined.length > 0 ? combined : null;
  }, [search]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        disabled={disabled}
        title="Insert Emoji"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none disabled:opacity-50"
      >
        <Smile className="h-4.5 w-4.5" />
      </PopoverTrigger>
      
      <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border shadow-md rounded-lg flex flex-col gap-2 z-50">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji (e.g. heart, like)..."
            className="pl-8 h-8 text-xs border-border bg-muted/50 text-foreground placeholder:text-muted-foreground/60 focus:bg-muted focus:outline-none focus:ring-0 focus:border-border"
          />
        </div>
        
        <ScrollArea className="h-48 pr-1">
          {searchedEmojis ? (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground">Search Results</div>
              <div className="grid grid-cols-7 gap-1">
                {searchedEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-muted transition-colors active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : filteredCategories.length > 0 ? (
            <div className="space-y-3">
              {filteredCategories.map((category) => (
                <div key={category.name} className="space-y-1">
                  <div className="text-[10px] font-semibold text-muted-foreground sticky top-0 bg-popover py-0.5 z-10">
                    {category.name}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {category.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onSelect(emoji);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-muted transition-colors active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8">
              No emojis found.
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
