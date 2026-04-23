export type BlockType = 'text' | 'h1' | 'h2' | 'h3' | 'bullet_list' | 'todo_list' | 'quote' | 'divider' | 'code' | 'table';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  data?: any;
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
    status: 'Not Started' | 'In Progress' | 'Done' | null;
  };
}
