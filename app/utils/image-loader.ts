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
  private maxConcurrent = 3;
  private maxRetries = 3;
  private retryDelay = 2000;

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
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image/') && !contentType.includes('application/octet-stream')) {
        const text = await response.text();
        console.error(`[ImageLoader] Expected image, got ${contentType}. Body:`, text.slice(0, 200));
        throw new Error(`Expected image, got ${contentType}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      task.resolve(objectUrl);
    } catch (error) {
      if (task.retries < this.maxRetries) {
        task.retries++;
        setTimeout(() => {
          this.queue.unshift(task);
          this.activeLoads--;
          this.processQueue();
        }, this.retryDelay * (task.retries + 1));
      } else {
        task.reject(error as Error);
        this.activeLoads--;
        this.processQueue();
      }
      return;
    }

    this.activeLoads--;
    this.processQueue();
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

const imageLoader = new ImageLoadQueue();

export async function loadImageWithQueue(url: string): Promise<string> {
  return imageLoader.load(url);
}

export function getImageLoaderStats() {
  return {
    queueSize: imageLoader.queueSize,
    activeLoads: imageLoader.activeCount,
  };
}

export function clearImageQueue() {
  imageLoader.clear();
}
