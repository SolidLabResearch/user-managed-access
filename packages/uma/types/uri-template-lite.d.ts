// Unfortunately the published types are wrong
declare module 'uri-template-lite' {
  export function expand(template: string, data: Record<string, unknown>): string;

  export default class Template {
    public constructor(template: string);
    public expand: (data: Record<string, unknown>) => string;
    public match: (template: string) => Record<string, string>;
  }
}
