export interface TagSpec { id: string; name: string; category: string; keywords: string[]; excludeKeywords?: string[]; }
export interface CategoryDef { id: string; name: string; color: { bg: string; text: string; border: string }; }
