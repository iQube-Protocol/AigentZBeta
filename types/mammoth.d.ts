declare module 'mammoth' {
  interface ExtractRawTextOptions {
    buffer?: Buffer;
    path?: string;
  }

  interface Result {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function extractRawText(options: ExtractRawTextOptions): Promise<Result>;
  export function convertToHtml(options: ExtractRawTextOptions): Promise<Result>;
}
