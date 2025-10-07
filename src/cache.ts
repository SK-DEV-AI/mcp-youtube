/**
 * Simple file-based cache for YouTube MCP Server
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export class SimpleCache {
  private cacheDir: string;
  private defaultTTL: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(os.tmpdir(), 'youtube-mcp-cache');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCacheFile(key: string): string {
    // Create a safe filename from the key
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    const cacheFile = this.getCacheFile(key);

    try {
      if (!fs.existsSync(cacheFile)) {
        return null;
      }

      const content = fs.readFileSync(cacheFile, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(content);

      if (Date.now() > entry.expiresAt) {
        // Cache expired, remove it
        fs.unlinkSync(cacheFile);
        return null;
      }

      return entry.data;
    } catch (error) {
      // If cache file is corrupted, remove it
      try {
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
        }
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const cacheFile = this.getCacheFile(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttl || this.defaultTTL)
    };

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(entry, null, 2));
    } catch (error) {
      // If we can't write cache, just continue without it
      console.warn('Failed to write cache:', error);
    }
  }

  async delete(key: string): Promise<void> {
    const cacheFile = this.getCacheFile(key);
    try {
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  async clear(): Promise<void> {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  // Clean up expired entries
  async cleanup(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return;
      }

      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const cacheFile = path.join(this.cacheDir, file);
        try {
          const content = fs.readFileSync(cacheFile, 'utf8');
          const entry: CacheEntry<any> = JSON.parse(content);

          if (now > entry.expiresAt) {
            fs.unlinkSync(cacheFile);
          }
        } catch {
          // If file is corrupted, remove it
          fs.unlinkSync(cacheFile);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Global cache instance
export const cache = new SimpleCache();