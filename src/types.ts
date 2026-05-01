export type BlockType = 'text' | 'h1' | 'h2' | 'h3' | 'bullet_list' | 'todo_list' | 'quote' | 'divider' | 'code' | 'table' | 'live_data' | 'ai_assistant';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  data?: any;
  language?: string;
  executionResult?: {
    output: string;
    error?: string;
    type: 'text' | 'html' | 'image';
  };
  timer?: {
    startTime: number | null;
    elapsed: number;
    isRunning: boolean;
  };
  blocker?: {
    reason: string;
    isBlocked: boolean;
  };
}

export interface Document {
  id: string;
  title: string;
  blocks: Block[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  order: number;
  parentId: string | null;
  properties?: {
    tags: string[];
    status: string | null;
    isFolder?: boolean;
    isLocked?: boolean;
    priority?: number;
  };
}
