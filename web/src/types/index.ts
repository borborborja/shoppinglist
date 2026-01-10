export interface LocalizedItem {
    es: string;
    ca: string;
    en: string;
    [key: string]: string;
}

export interface CategoryItem {
    icon: string;
    items: LocalizedItem[];
    color?: string;
}

export interface Categories {
    [key: string]: CategoryItem;
}

export interface ShopItem {
    id: number;
    name: string;
    checked: boolean;
    note: string;
    category: string;
    updatedAt?: number;
}

export type AppMode = 'planning' | 'shopping';
export type ViewMode = 'list' | 'compact' | 'grid';
export type Lang = 'ca' | 'es' | 'en';
export type SettingsTab = 'account' | 'catalog' | 'other' | 'about';

export interface AuthState {
    isLoggedIn: boolean;
    email: string | null;
    userId: string | null;
    username: string | null;
}

export interface PresenceUser {
    id: string;
    username: string;
    lastActiveAt: string;
}
