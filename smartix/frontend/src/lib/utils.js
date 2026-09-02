import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Hors ligne';
  
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastSeenDate = new Date(date);
  lastSeenDate.setHours(0, 0, 0, 0);
  
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  if (diffMins < 1) {
    return 'en ligne il y a quelques instants';
  }
  
  if (diffMins < 60) {
    return `en ligne il y a ${diffMins} min`;
  }
  
  if (diffHours < 24 && lastSeenDate.getTime() === today.getTime()) {
    return `vu aujourd'hui à ${timeStr}`;
  }
  
  if (lastSeenDate.getTime() === yesterday.getTime()) {
    return `vu hier à ${timeStr}`;
  }
  
  return `vu le ${date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

export function getUserStatus(isOnline, lastSeen) {
  if (isOnline) {
    return { text: 'En ligne', isOnline: true };
  }
  return { text: formatLastSeen(lastSeen), isOnline: false };
}
