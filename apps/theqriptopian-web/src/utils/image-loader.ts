/**
 * Image Loader with Queue and Retry Logic
 * Prevents overwhelming the API with concurrent cover image decrypt requests
 */

type LoadTask = {
  url: string;
  resolve: (url: string) => void;
  reject: (error: Error) => void;
  retries: number;
};

class ImageLoadQueue {
  private queue: LoadTask[] = [];
  private activeLoads = 0;
  private maxConcurrent = 3; // Only 3 concurrent decrypt requests
  private maxRetries = 3;
  private retryDelay = 2000; // 2 seconds between retries

  async load(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject, retries: 0 });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.activeLoads >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeLoads++;

    try {
      const response = await fetch(task.url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Create object URL from blob for caching
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      task.resolve(objectUrl);
    } catch (error) {
      if (task.retries < this.maxRetries) {
        // Retry with exponential backoff
        console.log(`[ImageLoader] Retry ${task.retries + 1}/${this.maxRetries} for ${task.url}`);
        task.retries++;
        
        setTimeout(() => {
          this.queue.unshift(task); // Put back at front of queue
          this.processQueue();
        }, this.retryDelay * (task.retries + 1));
      } else {
        console.error(`[ImageLoader] Failed after ${this.maxRetries} retries:`, task.url, error);
        task.reject(error as Error);
      }
    } finally {
      this.activeLoads--;
      this.processQueue(); // Process next item
    }
  }

  clear() {
    this.queue = [];
  }

  get queueSize() {
    return this.queue.length;
  }

  get activeCount() {
    return this.activeLoads;
  }
}

// Global singleton
const imageLoader = new ImageLoadQueue();

/**
 * Load image with queuing and retry logic
 * Returns object URL for the loaded image
 */
export async function loadImageWithQueue(url: string): Promise<string> {
  return imageLoader.load(url);
}

/**
 * Get queue stats for debugging
 */
export function getImageLoaderStats() {
  return {
    queueSize: imageLoader.queueSize,
    activeLoads: imageLoader.activeCount,
  };
}

/**
 * Clear the queue (useful when navigating away)
 */
export function clearImageQueue() {
  imageLoader.clear();
}
