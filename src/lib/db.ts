import Dexie, { Table } from 'dexie';
import type { Document } from '../types';

export interface SyncMetadata {
  id: string; // 'global' or document id
  lastSyncedAt: number;
}

export class TakeWinsDB extends Dexie {
  documents!: Table<Document>;
  syncMetadata!: Table<SyncMetadata>;

  constructor() {
    super('TakeWinsDB');
    this.version(1).stores({
      documents: 'id, parentId, updatedAt, isFavorite',
      syncMetadata: 'id'
    });
  }
}

export const db = new TakeWinsDB();
